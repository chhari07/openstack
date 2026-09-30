"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { AI_ENGINE, AiError, aiConsented, setAiConsent, type Answer, type Cite } from "@/lib/ai";
import { Sheet } from "./sheet";
import { SparkleIcon } from "./stack-icons";

// Asks once per kind of AI feature before anything is sent to Claude.
export function useAiConsent() {
  const [ask, setAsk] = useState<{ kind: string; what: string } | null>(null);
  const done = useRef<(ok: boolean) => void>(() => {});
  const confirm = useCallback((kind: string, what: string) => {
    if (aiConsented(kind)) return Promise.resolve(true);
    setAsk({ kind, what });
    return new Promise<boolean>((resolve) => (done.current = resolve));
  }, []);
  const close = (ok: boolean) => {
    if (ok && ask) setAiConsent(ask.kind);
    setAsk(null);
    done.current(ok);
  };
  const sheet = (
    <Sheet open={!!ask} onClose={() => close(false)} title="Use Stack AI?">
      <p className="text-[15px] leading-relaxed">
        To do this, Stack sends <b>{ask?.what}</b> to <b>{AI_ENGINE}</b> through Stack’s server. It’s used
        only to write your answer.
      </p>
      <p className="text-[13px] leading-relaxed text-muted">
        AI answers can be wrong: check anything important. You’ll only be asked once for this feature.
      </p>
      <button
        onClick={() => close(true)}
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-on-ink"
      >
        <SparkleIcon size={17} /> Continue
      </button>
      <button onClick={() => close(false)} className="h-11 text-[14px] font-semibold text-muted">
        Not now
      </button>
    </Sheet>
  );
  return [confirm, sheet] as const;
}

export function AiLabel({ children = "Stack AI" }: { children?: ReactNode }) {
  return (
    <span className="label flex items-center gap-1.5 text-[10px] text-muted">
      <SparkleIcon size={13} />
      {children}
    </span>
  );
}

export function AiErrorNote({ error }: { error: unknown }) {
  const e = error instanceof AiError ? error : new AiError("api", "Something went wrong. Try again.");
  return (
    <p className="text-[14px] leading-relaxed text-music-text">
      {e.message}{" "}
      {e.code === "signin" && (
        <Link href="/account" className="underline">
          Sign in
        </Link>
      )}
    </p>
  );
}

// An answer with its citations: page chips for PDFs, links for your notes.
export function AnswerView({
  answer,
  streaming,
  onPage,
  hrefOf,
  className = "",
}: {
  answer: Answer | null;
  streaming?: string;
  onPage?: (page: number) => void;
  hrefOf?: (source: string) => string | undefined;
  className?: string;
}) {
  if (!answer)
    return (
      <p className={`text-[15px] leading-relaxed whitespace-pre-wrap ${className}`}>
        {streaming || <span className="animate-pulse text-muted">Thinking…</span>}
      </p>
    );
  return (
    <div className={`text-[15px] leading-relaxed whitespace-pre-wrap ${className}`}>
      {answer.blocks.map((b, i) => (
        <span key={i}>
          {b.text}
          {dedupe(b.cites).map((c, j) =>
            c.page && onPage ? (
              <button
                key={j}
                onClick={() => onPage(c.page!)}
                title={c.cited}
                className="label mx-0.5 inline-flex h-5 items-center rounded-full bg-pdf-tint px-1.5 align-middle text-[9px] text-pdf-deep"
              >
                p. {c.page}
              </button>
            ) : c.source && hrefOf?.(c.source) ? (
              <Link
                key={j}
                href={hrefOf(c.source)!}
                title={c.cited}
                className="label mx-0.5 inline-flex h-5 max-w-[160px] items-center truncate rounded-full bg-news-tint px-1.5 align-middle text-[9px] text-news-deep"
              >
                {c.title ?? "note"}
              </Link>
            ) : null,
          )}
        </span>
      ))}
      {answer.cut && <span className="text-muted"> …(cut short)</span>}
    </div>
  );
}

// One chip per page or note; pages in reading order.
const dedupe = (cites: Cite[]) => {
  const seen = new Set<string>();
  return cites
    .filter((c) => {
      const k = `${c.page ?? ""}|${c.source ?? ""}`;
      return !seen.has(k) && seen.add(k);
    })
    .sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
};
