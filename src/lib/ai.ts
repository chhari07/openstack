"use client";

// Stack AI on the device: sends a task to the "ai" Supabase function
// (supabase/functions/ai, which holds the AI key) with your sign-in, and reads
// the answer as it streams. NEXT_PUBLIC_AI_URL is that function's address,
// https://<project>.supabase.co/functions/v1/ai; without it AI is hidden.
import { accessToken, cloudConfigured, cloudKey } from "./cloud";

export type Cite = { page?: number; source?: string; title?: string; cited: string };
export type AnswerBlock = { text: string; cites: Cite[] };
export type Answer = { blocks: AnswerBlock[]; cut?: boolean };
export type AiTask =
  | { task: "summary"; title: string; text: string }
  | { task: "tidy"; text: string }
  | { task: "ask"; question: string; sources: { id: string; title: string; text: string }[] }
  | { task: "pdf"; title: string; pdf: string; question: string; history: { q: string; a: string }[] };

export class AiError extends Error {
  constructor(
    public code: "signin" | "setup" | "limit" | "refusal" | "offline" | "bad" | "api",
    message: string,
  ) {
    super(message);
  }
}

const ENDPOINT = process.env.NEXT_PUBLIC_AI_URL ?? "";

// AI needs an account (to keep the shared key safe) and the function's address.
export const aiSetUp = () => cloudConfigured() && !!ENDPOINT;

// Settings → Stack AI: off hides every AI button (summaries, PDF questions,
// "Ask your Stack", tidy note) and nothing is ever sent.
const OFF_KEY = "stack.ai.off";
export function aiTurnedOn() {
  try {
    return localStorage.getItem(OFF_KEY) !== "1";
  } catch {
    return true;
  }
}
export function setAiTurnedOn(on: boolean) {
  try {
    if (on) localStorage.removeItem(OFF_KEY);
    else localStorage.setItem(OFF_KEY, "1");
  } catch {}
}

export const aiAvailable = () => aiSetUp() && aiTurnedOn();

export async function runAi(body: AiTask, onText?: (textSoFar: string) => void, signal?: AbortSignal): Promise<Answer> {
  const token = await accessToken();
  if (!token) throw new AiError("signin", "Sign in to use Stack AI.");
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: cloudKey() },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (signal?.aborted) throw new AiError("bad", "Stopped.");
    throw new AiError("offline", "Couldn’t reach Stack AI. Check your connection.");
  }

  let text = "";
  let answer: Answer | null = null;
  let error: AiError | null = null;
  const onLine = (line: string) => {
    if (!line.trim()) return;
    let m: { t: string; v?: string; code?: AiError["code"]; blocks?: AnswerBlock[]; cut?: boolean };
    try {
      m = JSON.parse(line);
    } catch {
      return;
    }
    if (m.t === "text") onText?.((text += m.v ?? ""));
    else if (m.t === "reset") onText?.((text = ""));
    else if (m.t === "done") answer = { blocks: m.blocks ?? [], cut: m.cut };
    else if (m.t === "error") error = new AiError(m.code ?? "api", m.v ?? "Something went wrong.");
  };

  // Stream line by line where the platform allows it (the website); otherwise
  // the whole answer arrives at once.
  if (res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      lines.forEach(onLine);
    }
    onLine(buf);
  } else {
    (await res.text()).split("\n").forEach(onLine);
  }
  if (error) throw error;
  if (!answer) throw new AiError("api", res.ok ? "The answer was cut off. Try again." : `Stack AI error ${res.status}.`);
  return answer;
}

// Who answers, for the "ask first" sheet (set with the server's AI_PROVIDER).
export const AI_ENGINE = process.env.NEXT_PUBLIC_AI_ENGINE || "an AI service";

export const answerText = (a: Answer) => a.blocks.map((b) => b.text).join("").trim();

// ---- Asking first ----
// Each kind of AI feature asks once before sending anything to Claude.
const CONSENT = "stack.ai.ok";
export function aiConsented(kind: string) {
  try {
    return (JSON.parse(localStorage.getItem(CONSENT) ?? "[]") as string[]).includes(kind);
  } catch {
    return false;
  }
}
export function setAiConsent(kind: string) {
  try {
    const all = JSON.parse(localStorage.getItem(CONSENT) ?? "[]") as string[];
    localStorage.setItem(CONSENT, JSON.stringify([...new Set([...all, kind])]));
  } catch {}
}

// Base64 of a PDF blob for the "pdf" task.
export const blobBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
