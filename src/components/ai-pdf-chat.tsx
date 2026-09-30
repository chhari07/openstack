"use client";

import { useEffect, useRef, useState } from "react";
import { getPdf } from "@/lib/db";
import { aiAvailable, answerText, blobBase64, runAi, type Answer } from "@/lib/ai";
import { AiErrorNote, AiLabel, AnswerView, useAiConsent } from "./ai-kit";
import { Sheet } from "./sheet";
import { SparkleIcon } from "./stack-icons";

type Turn = { q: string; answer: Answer | null; streaming: string; error?: unknown };

const STARTERS = ["Summarize this document", "What are the key ideas?", "Explain this page simply"];

// "Ask this PDF": a chat about the open PDF. Answers cite pages; tapping one jumps there.
export function AiPdfButton({ id, title, page, onPage }: { id: string; title: string; page: number; onPage: (p: number) => void }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, consentSheet] = useAiConsent();
  const pdf = useRef<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  // Braces matter: newer browsers return a Promise from scrollIntoView, and an
  // effect may only return a cleanup function.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  if (!aiAvailable()) return null;

  const ask = async (raw: string) => {
    const question = raw.replace("this page", `page ${page}`).trim();
    if (!question || busy) return;
    if (!(await confirm("pdf", "this PDF file and your questions"))) return;
    setQ("");
    setBusy(true);
    const history = turns.filter((t) => t.answer).map((t) => ({ q: t.q, a: answerText(t.answer!) }));
    setTurns((all) => [...all, { q: question, answer: null, streaming: "" }]);
    const patch = (p: Partial<Turn>) => setTurns((all) => all.map((t, i) => (i === all.length - 1 ? { ...t, ...p } : t)));
    try {
      if (!pdf.current) {
        const found = await getPdf(id);
        if (!found) throw new Error("missing");
        pdf.current = await blobBase64(found.blob);
      }
      const answer = await runAi({ task: "pdf", title, pdf: pdf.current, question, history }, (s) => patch({ streaming: s }));
      patch({ answer });
    } catch (e) {
      patch({ error: e });
    }
    setBusy(false);
  };

  return (
    <>
      <button aria-label="Ask this PDF" onClick={() => setOpen(true)} className="flex size-11 items-center justify-center">
        <SparkleIcon size={21} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Ask this PDF">
        <div className="-mt-2 flex max-h-[55dvh] flex-col gap-4 overflow-y-auto">
          {turns.length === 0 && (
            <p className="text-[14px] leading-relaxed text-muted">
              Ask anything about <b className="text-ink">{title}</b>. Answers point to the pages they come from.
            </p>
          )}
          {turns.map((t, i) => (
            <div key={i} className="flex flex-col gap-2">
              <p className="self-end rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-[15px] text-on-ink">{t.q}</p>
              <div className="rounded-2xl rounded-bl-md bg-card p-3.5">
                {t.error ? (
                  <AiErrorNote error={t.error} />
                ) : (
                  <AnswerView
                    answer={t.answer}
                    streaming={t.streaming}
                    onPage={(p) => {
                      onPage(p);
                      setOpen(false);
                    }}
                  />
                )}
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="h-9 rounded-full border border-ink/20 px-3 text-[13px] font-medium">
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
          className="flex gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask a question…"
            aria-label="Question about this PDF"
            enterKeyHint="send"
            className="h-12 min-w-0 grow rounded-full border border-ink/15 bg-card px-4 text-[15px] outline-none focus:border-ink"
          />
          <button
            disabled={!q.trim() || busy}
            className="h-12 shrink-0 rounded-full bg-ink px-5 text-[15px] font-semibold text-on-ink disabled:opacity-40"
          >
            {busy ? "…" : "Ask"}
          </button>
        </form>
        <AiLabel>The AI reads the whole PDF · answers can be wrong</AiLabel>
      </Sheet>
      {consentSheet}
    </>
  );
}
