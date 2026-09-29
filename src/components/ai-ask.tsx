"use client";

import { useEffect, useRef, useState } from "react";
import { aiAvailable, runAi, type Answer } from "@/lib/ai";
import { relevant, type Passage } from "@/lib/search";
import { AiErrorNote, AiLabel, AnswerView, useAiConsent } from "./ai-kit";
import { SparkleIcon } from "./stack-icons";

// "Ask your Stack" on the Search screen: Claude answers from your own notes,
// highlights, saved articles and PDFs, citing each one it used.
export function AiAsk({ question }: { question: string }) {
  const [asked, setAsked] = useState<string | null>(null);
  const [streaming, setStreaming] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [sources, setSources] = useState<Passage[]>([]);
  const [confirm, consentSheet] = useAiConsent();
  const stop = useRef<AbortController | null>(null);

  // A new question clears the old answer.
  useEffect(() => {
    stop.current?.abort();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAsked(null);
  }, [question]);

  if (!aiAvailable() || question.trim().length < 3) return null;

  const run = async () => {
    const q = question.trim();
    if (!(await confirm("ask", "your question and the notes, highlights and titles that match it"))) return;
    const found = await relevant(q);
    setSources(found);
    setAsked(q);
    setStreaming("");
    setAnswer(null);
    setError(null);
    stop.current = new AbortController();
    try {
      setAnswer(
        await runAi(
          { task: "ask", question: q, sources: found.map(({ id, title, text }) => ({ id, title, text })) },
          setStreaming,
          stop.current.signal,
        ),
      );
    } catch (e) {
      if (!stop.current.signal.aborted) setError(e);
    }
  };

  if (asked === null)
    return (
      <>
        <button
          onClick={run}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-ink/15 bg-card p-3.5 text-left"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-on-ink">
            <SparkleIcon size={20} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold">Ask your Stack</span>
            <span className="truncate text-[13px] text-muted">“{question.trim()}”</span>
          </span>
        </button>
        {consentSheet}
      </>
    );

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-card p-4">
      <AiLabel>Answer from your Stack · {sources.length} items read</AiLabel>
      {error !== null ? (
        <AiErrorNote error={error} />
      ) : (
        <AnswerView answer={answer} streaming={streaming} hrefOf={(s) => sources.find((x) => x.id === s)?.href} />
      )}
      {(answer !== null || error !== null) && (
        <button onClick={() => setAsked(null)} className="label self-start text-[10px] text-muted underline">
          Ask again
        </button>
      )}
    </div>
  );
}
