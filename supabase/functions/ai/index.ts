// Stack AI: the only place that talks to the AI engine. A Supabase Edge
// Function (Deno): it keeps the API key (never sent to the app), checks the
// Supabase sign-in, applies a daily limit per person and streams the answer
// back as NDJSON lines:
//   {"t":"text","v":"…"}   a piece of the answer as it's written
//   {"t":"reset"}          a fallback model took over: throw away the text so far
//   {"t":"done","blocks":[{"text":"…","cites":[…]}]}   the final answer
//   {"t":"error","code":"…","v":"…"}
// The engine is AI_PROVIDER: "openai" (OPENAI_API_KEY) or "anthropic" (Claude,
// ANTHROPIC_API_KEY). Those are this function's secrets (supabase/README.md).
// The Android app has no server of its own; it calls this function.
import Anthropic from "npm:@anthropic-ai/sdk@^0.129.0";
import OpenAI from "npm:openai@^7.23.0";
import { createClient } from "npm:@supabase/supabase-js@^2.117.2";

const env = (name: string) => Deno.env.get(name) ?? "";

type Task = "summary" | "tidy" | "ask" | "pdf";
type Source = { id: string; title: string; text: string };
type Turn = { q: string; a: string };
type Body = {
  task: Task;
  title?: string;
  text?: string; // summary: the article · tidy: the note
  question?: string;
  sources?: Source[]; // ask: the notes and highlights to answer from
  pdf?: string; // pdf: base64
  history?: Turn[]; // pdf: earlier questions in this chat
};
type Cite = { page?: number; source?: string; title?: string; cited: string };
type Block = { text: string; cites: Cite[] };

const PROVIDER = () => (env("AI_PROVIDER") || (env("OPENAI_API_KEY") ? "openai" : "anthropic")).toLowerCase();
// One model setting per task, so a cheaper model can be switched in without an app update.
const CLAUDE_MODEL = (task: Task) => env(`AI_MODEL_${task.toUpperCase()}`) || env("AI_MODEL") || "claude-opus-5-5";
const OPENAI_MODEL = (task: Task) => env(`OPENAI_MODEL_${task.toUpperCase()}`) || env("OPENAI_MODEL") || "gpt-5.5";
const LIMIT = Number(env("AI_DAILY_LIMIT") || 50);
const MAX_PDF_B64 = 30_000_000; // Claude takes up to 32 MB per request

// Page references the model writes: "(p. 4)", "(pp. 7–8)", "(p. 3, p. 4)",
// "(p. 87, 274)", "(page 12)", "(pages 3 and 5)". Each becomes a page link
// (the first page of a range) and the marker is taken out of the text.
function pageRefs(text: string, onPage: (page: number) => void) {
  return text.replace(/\s?\((\s*(?:pp?\.|pages?)\s*\d[^()]*)\)/gi, (whole, inside: string) => {
    // Only if the brackets hold nothing but page numbers.
    if (!/^[\s\d,;–—&-]*$/.test(inside.replace(/pp?\.|pages?|and/gi, ""))) return whole;
    for (const m of inside.matchAll(/(\d{1,4})(?:\s*[–—-]\s*\d{1,4})?/g)) onPage(Number(m[1]));
    return "";
  });
}

const PROMPTS: Record<Task, string> = {
  summary:
    "You summarise news and blog articles for a reading app. Reply with exactly three short bullet points (lines starting with \"- \") covering what matters most, then one line starting with \"Takeaway: \" saying why it matters to the reader. Plain text, no headings, no bold. Use the article's language.",
  tidy:
    "You tidy up quick notes in a notes app. Keep the writer's meaning, words and language; fix spelling, remove repetition, and give it structure. Reply in plain text: first line is a short title (no \"Title:\" label), then a blank line, then the note. Use \"- \" bullets for lists of ideas and \"[ ] \" lines for things to do. Never add facts that aren't in the note.",
  ask: "You answer questions using only the reader's own saved notes and highlights, provided as search results. Cite the notes you use. If the notes don't answer the question, say so briefly and suggest what they do cover. Keep answers short: a few sentences or a short list. Plain text, no headings.",
  pdf: "You help someone understand the PDF they are reading. Answer from the document and cite the pages you use. If the document doesn't cover the question, say so. Keep answers short and clear: a few sentences or a short list. Plain text, no headings.",
};
// OpenAI has no built-in citations, so it writes markers that are turned into links.
const OPENAI_CITE: Partial<Record<Task, string>> = {
  ask: " Each search result is numbered like [1]; after a sentence that uses one, write its number in square brackets, e.g. [2].",
  pdf: " After a sentence that uses the document, write the page in the form (p. 12).",
};

// ---- One description of each request, handed to either engine ----
type Part = { text: string } | { pdf: string; title: string } | { source: Source };
type Job = {
  task: Task;
  system: string;
  effort: "low" | "medium";
  maxTokens: number;
  turns: { role: "user" | "assistant"; parts: Part[] }[];
};

const clip = (s: string | undefined, max: number) => (s ?? "").slice(0, max);

function buildJob(b: Body): Job | string {
  const q = clip(b.question, 2000).trim();
  const job = (effort: Job["effort"], maxTokens: number, turns: Job["turns"]): Job => ({
    task: b.task,
    system: PROMPTS[b.task],
    effort,
    maxTokens,
    turns,
  });
  switch (b.task) {
    case "summary": {
      const text = clip(b.text, 120_000).trim();
      if (!text) return "Nothing to summarise.";
      return job("low", 2000, [{ role: "user", parts: [{ text: `Title: ${clip(b.title, 300)}\n\n${text}` }] }]);
    }
    case "tidy": {
      const text = clip(b.text, 20_000).trim();
      if (!text) return "The note is empty.";
      return job("low", 4000, [{ role: "user", parts: [{ text }] }]);
    }
    case "ask": {
      const sources = (b.sources ?? []).slice(0, 30);
      if (!q) return "Ask a question.";
      if (!sources.length) return "There are no notes to answer from yet.";
      const parts: Part[] = sources.map((s) => ({
        source: { id: clip(s.id, 200), title: clip(s.title, 200) || "Note", text: clip(s.text, 4000) || "(empty)" },
      }));
      return job("medium", 4000, [{ role: "user", parts: [...parts, { text: q }] }]);
    }
    case "pdf": {
      if (!q) return "Ask a question.";
      if (!b.pdf || b.pdf.length > MAX_PDF_B64) return "This PDF is too big to send (the limit is about 22 MB).";
      const history = (b.history ?? []).slice(-6);
      // The PDF goes first (and is cached by Claude), then the conversation.
      const turns: Job["turns"] = [
        { role: "user", parts: [{ pdf: b.pdf, title: clip(b.title, 200) || "PDF" }, { text: clip(history[0]?.q ?? q, 2000) }] },
      ];
      history.forEach((t, i) => {
        turns.push({ role: "assistant", parts: [{ text: clip(t.a, 8000) || "…" }] });
        turns.push({ role: "user", parts: [{ text: clip(i + 1 < history.length ? history[i + 1].q : q, 2000) }] });
      });
      return job("medium", 6000, turns);
    }
  }
}

type Emit = (o: object) => void;

// ---- Claude ----
let claude: Anthropic | null = null;

async function runClaude(job: Job, emit: Emit) {
  const messages: Anthropic.Beta.BetaMessageParam[] = job.turns.map((t) => ({
    role: t.role,
    content: t.parts.map((p): Anthropic.Beta.BetaContentBlockParam =>
      "pdf" in p
        ? {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: p.pdf },
            title: p.title,
            citations: { enabled: true },
            cache_control: { type: "ephemeral" },
          }
        : "source" in p
          ? {
              type: "search_result",
              source: p.source.id,
              title: p.source.title,
              content: [{ type: "text", text: p.source.text }],
              citations: { enabled: true },
            }
          : { type: "text", text: p.text },
    ),
  }));
  // Anthropic's default fallback: a declined request is retried on the model
  // recommended for that kind of decline, inside the same call.
  const s = (claude ??= new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") })).beta.messages.stream({
    model: CLAUDE_MODEL(job.task),
    max_tokens: job.maxTokens,
    output_config: { effort: job.effort },
    system: job.system,
    messages,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  for await (const e of s) {
    if (e.type === "content_block_start" && e.content_block.type === "fallback") emit({ t: "reset" });
    if (e.type === "content_block_delta" && e.delta.type === "text_delta") emit({ t: "text", v: e.delta.text });
  }
  const msg = await s.finalMessage();
  if (msg.stop_reason === "refusal") return emit({ t: "error", code: "refusal", v: "The AI couldn’t help with this one." });
  const blocks: Block[] = msg.content.flatMap((c) =>
    c.type === "text"
      ? [
          {
            text: c.text,
            cites: (c.citations ?? []).flatMap((x): Cite[] =>
              x.type === "page_location"
                ? [{ page: x.start_page_number, cited: x.cited_text }]
                : x.type === "search_result_location"
                  ? [{ source: x.source, title: x.title ?? undefined, cited: x.cited_text }]
                  : [],
            ),
          },
        ]
      : [],
  );
  emit({ t: "done", blocks, cut: msg.stop_reason === "max_tokens" });
}

// ---- OpenAI ----
let openai: OpenAI | null = null;

async function runOpenAI(job: Job, emit: Emit) {
  const sources: Source[] = [];
  const input = job.turns.map((t) =>
    t.role === "assistant"
      ? { role: "assistant" as const, content: t.parts.map((p) => ("text" in p ? p.text : "")).join("\n") }
      : {
          role: "user" as const,
          content: t.parts.map((p): OpenAI.Responses.ResponseInputContent => {
            if ("pdf" in p)
              return { type: "input_file", filename: `${p.title.replace(/[^\w .-]/g, "") || "document"}.pdf`, file_data: `data:application/pdf;base64,${p.pdf}` };
            if ("source" in p) {
              sources.push(p.source);
              return { type: "input_text", text: `[${sources.length}] ${p.source.title}\n${p.source.text}` };
            }
            return { type: "input_text", text: p.text };
          }),
        },
  );
  const s = (openai ??= new OpenAI({ apiKey: env("OPENAI_API_KEY") })).responses.stream({
    model: OPENAI_MODEL(job.task),
    instructions: job.system + (OPENAI_CITE[job.task] ?? ""),
    input,
    max_output_tokens: job.maxTokens * 2, // reasoning tokens count toward this too
    reasoning: { effort: job.effort },
  });
  for await (const e of s) {
    if (e.type === "response.output_text.delta") emit({ t: "text", v: e.delta });
  }
  const res = await s.finalResponse();
  const raw = res.output_text ?? "";
  if (!raw.trim()) return emit({ t: "error", code: "refusal", v: "The AI couldn’t help with this one." });

  // Turn the written markers into the same citations Claude gives.
  const cites: Cite[] = [];
  let text = raw;
  if (job.task === "ask")
    text = raw.replace(/\s?\[(\d{1,2})\](?!\()/g, (_, n) => {
      const src = sources[Number(n) - 1];
      if (src) cites.push({ source: src.id, title: src.title, cited: "" });
      return "";
    });
  if (job.task === "pdf")
    text = pageRefs(raw, (page) => {
      if (!cites.some((c) => c.page === page)) cites.push({ page, cited: "" });
    });
  emit({ t: "done", blocks: [{ text, cites }], cut: res.incomplete_details?.reason === "max_output_tokens" });
}

// ---- Sign-in and the daily limit (Supabase) ----
// A client that acts as the person who sent the request.
function asCaller(request: Request, token: string) {
  const key = env("SUPABASE_ANON_KEY") || request.headers.get("apikey") || "";
  return createClient(env("SUPABASE_URL"), key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// A short, readable reason for an API failure.
function explain(e: unknown) {
  const said =
    e instanceof Anthropic.APIError
      ? ((e.error as { error?: { message?: string } } | undefined)?.error?.message ?? e.message)
      : e instanceof OpenAI.APIError
        ? e.message
        : "";
  if (/credit balance|quota|billing/i.test(said)) return "Stack AI is paused: the AI account is out of credit.";
  if (e instanceof Anthropic.RateLimitError || e instanceof OpenAI.RateLimitError) return "Stack AI is busy. Try again in a minute.";
  if (e instanceof Anthropic.AuthenticationError || e instanceof OpenAI.AuthenticationError) return "The server’s AI API key isn’t valid.";
  if (e instanceof Anthropic.BadRequestError || e instanceof OpenAI.BadRequestError) return `The AI couldn’t read this request: ${said.slice(0, 140)}`;
  if (e instanceof Anthropic.APIError || e instanceof OpenAI.APIError) return `AI error ${e.status ?? ""}. Try again.`;
  return "Couldn’t reach the AI. Try again.";
}

// The website (npm run dev) calls from a browser, which asks permission first.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const NDJSON = { ...CORS, "content-type": "application/x-ndjson", "cache-control": "no-store" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const line = (o: unknown) => new TextEncoder().encode(`${JSON.stringify(o)}\n`);
  const fail = (code: string, v: string, status: number) =>
    new Response(`${JSON.stringify({ t: "error", code, v })}\n`, { status, headers: NDJSON });
  if (request.method !== "POST") return fail("bad", "Bad request.", 405);

  const provider = PROVIDER();
  const hasKey = provider === "openai" ? !!env("OPENAI_API_KEY") : !!env("ANTHROPIC_API_KEY");
  if (!hasKey) return fail("setup", "Stack AI isn’t set up on the server yet.", 503);
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "";
  const db = asCaller(request, token);
  const { data: who } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!who.user) return fail("signin", "Sign in to use Stack AI.", 401);

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return fail("bad", "Bad request.", 400);
  }
  if (!["summary", "tidy", "ask", "pdf"].includes(body?.task)) return fail("bad", "Unknown task.", 400);
  const job = buildJob(body);
  if (typeof job === "string") return fail("bad", job, 400);
  // The count lives in the database (supabase/schema.sql: ai_take), so it
  // holds however many copies of this function are running.
  const { data: allowed, error } = await db.rpc("ai_take", { lim: LIMIT });
  if (error) return fail("setup", "Stack AI isn’t set up on the server yet.", 503);
  if (!allowed) return fail("limit", `You’ve used today’s ${LIMIT} Stack AI requests. They reset at midnight (UTC).`, 429);

  const stream = new ReadableStream({
    async start(controller) {
      const emit: Emit = (o) => controller.enqueue(line(o));
      try {
        await (provider === "openai" ? runOpenAI(job, emit) : runClaude(job, emit));
      } catch (e) {
        emit({ t: "error", code: "api", v: explain(e) });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: NDJSON });
});
