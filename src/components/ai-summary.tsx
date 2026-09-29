"use client";

import { useRef, useState } from "react";
import { addNote } from "@/lib/db";
import { aiAvailable, answerText, runAi, type Answer } from "@/lib/ai";
import { AiErrorNote, AiLabel, AnswerView, useAiConsent } from "./ai-kit";
import { SparkleIcon } from "./stack-icons";
import { useToast } from "./toast";

// "Summarize" at the top of an article: three bullets and a takeaway.
export function AiSummary({ id, title, html, source }: { id: string; title: string; html: string; source: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [streaming, setStreaming] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [confirm, consentSheet] = useAiConsent();
  const toast = useToast();
  const stop = useRef<AbortController | null>(null);

  if (!aiAvailable()) return null;

  const run = async () => {
    if (!(await confirm("summary", "the article’s text"))) return;
    const text = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
    setState("busy");
    setStreaming("");
    setAnswer(null);
    stop.current = new AbortController();
    try {
      setAnswer(await runAi({ task: "summary", title, text }, setStreaming, stop.current.signal));
      setState("done");
    } catch (e) {
      setError(e);
      setState("error");
    }
  };

  const save = async () => {
    if (!answer) return;
    await addNote({
      kind: "article",
      title: `Summary · ${title}`,
      body: answerText(answer),
      sourceTitle: title,
      sourceLabel: source,
      articleId: id,
      href: `/read?id=${id}`,
    });
    setSaved(true);
    toast({ text: "Summary saved to Notes", href: "/notes" });
  };

  return (
    <>
      {state === "idle" ? (
        <button
          onClick={run}
          className="mb-6 flex h-11 items-center gap-2 rounded-full border border-ink/15 px-4 text-[14px] font-semibold"
        >
          <SparkleIcon size={17} /> Summarize
        </button>
      ) : (
        <div className="mb-7 flex flex-col gap-3 rounded-2xl bg-card p-4">
          <AiLabel>Summary · Stack AI</AiLabel>
          {state === "error" ? (
            <AiErrorNote error={error} />
          ) : (
            <AnswerView answer={answer} streaming={streaming} className="font-serif text-[17px]" />
          )}
          <div className="flex gap-2">
            {state === "done" && (
              <button
                onClick={save}
                disabled={saved}
                className="h-10 rounded-full bg-ink px-4 text-[14px] font-semibold text-on-ink disabled:opacity-50"
              >
                {saved ? "Saved" : "Save to Notes"}
              </button>
            )}
            {state === "busy" ? (
              <button onClick={() => stop.current?.abort()} className="h-10 px-2 text-[14px] font-semibold text-muted">
                Stop
              </button>
            ) : (
              <button onClick={run} className="h-10 px-2 text-[14px] font-semibold text-muted">
                {state === "error" ? "Try again" : "Redo"}
              </button>
            )}
          </div>
        </div>
      )}
      {consentSheet}
    </>
  );
}
