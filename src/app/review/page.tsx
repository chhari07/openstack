"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BackIcon, CheckIcon, ExternalIcon } from "@/components/icons";
import { canGoBack } from "@/lib/nav";
import { grade, reviewStreak, todaysReview, type Grade } from "@/lib/review";
import { useStore } from "@/lib/use-store";
import { noteTime } from "@/lib/format";

export default function Review() {
  const router = useRouter();
  const [{ items, done }, ready] = useStore(todaysReview, { items: [], done: [] });
  const [busy, setBusy] = useState(false);
  const back = () => (canGoBack() ? router.back() : router.push("/"));

  const left = items.filter((n) => !done.includes(n.id));
  const current = left[0];
  const position = items.length - left.length + 1;

  const answer = async (g: Grade) => {
    if (!current || busy) return;
    setBusy(true);
    await grade(current, g);
    setBusy(false);
  };

  return (
    <main className="screen flex flex-col px-5 pt-5 pb-[calc(max(env(safe-area-inset-bottom),20px)+20px)] md:px-10 md:pt-8">
      <div className="flex h-8 items-center justify-between">
        <button aria-label="Back" onClick={back} className="-ml-2.5 flex size-11 items-center justify-center">
          <BackIcon size={22} />
        </button>
        {current && (
          <span className="label text-[10px]">
            {position} / {items.length}
          </span>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-[600px] grow flex-col">
        <h1 className="display -ml-1.5 mt-3 text-[clamp(84px,28vw,150px)]">RECALL</h1>
        <p className="label mt-2.5 text-[10px] text-muted">Daily review · {items.length || "no"} highlights today</p>

        {/* Progress dots */}
        {items.length > 0 && (
          <div className="mt-5 flex gap-1.5" aria-hidden>
            {items.map((n) => (
              <span
                key={n.id}
                className={`h-1 grow rounded-full ${done.includes(n.id) ? "bg-news" : n.id === current?.id ? "bg-ink" : "bg-rule"}`}
              />
            ))}
          </div>
        )}

        {current && (
          <>
            <figure
              key={current.id}
              className={`mt-6 flex flex-col gap-4 rounded-[22px] p-6 ${current.kind === "pdf" ? "bg-pdf-tint" : "bg-news-tint"}`}
            >
              <blockquote
                className={
                  current.kind === "pdf"
                    ? "font-serif text-[24px] leading-[1.3] italic"
                    : "text-[21px] leading-[1.4] font-semibold"
                }
              >
                “{current.quote}”
              </blockquote>
              {current.body && (
                <p className="border-t border-ink/10 pt-3 text-[15px] leading-relaxed text-prose">{current.body}</p>
              )}
              <figcaption className="label text-[10px] text-muted">
                {current.sourceTitle ?? "Highlight"}
                {current.page ? ` · p. ${current.page}` : ""} · {noteTime(current.createdAt)}
              </figcaption>
            </figure>
            {current.href && (
              <Link href={current.href} className="label mt-3 flex items-center gap-1.5 self-start text-[10px] underline">
                Open where you read it <ExternalIcon size={12} />
              </Link>
            )}

            <div className="mt-auto flex flex-col gap-2.5 pt-8">
              <p className="text-center text-[14px] text-muted">Do you remember why this mattered?</p>
              <div className="flex gap-2.5">
                <button
                  disabled={busy}
                  onClick={() => answer("again")}
                  className="h-14 grow rounded-full border border-ink/20 text-[15px] font-semibold"
                >
                  Show again soon
                </button>
                <button
                  disabled={busy}
                  onClick={() => answer("got")}
                  className="flex h-14 grow items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-on-ink"
                >
                  <CheckIcon size={18} /> Got it
                </button>
              </div>
              <button
                disabled={busy}
                onClick={() => answer("off")}
                className="label h-10 text-[10px] text-muted underline"
              >
                Stop showing this one
              </button>
            </div>
          </>
        )}

        {ready && !current && items.length > 0 && (
          <div className="mt-10 flex flex-col gap-3">
            <p className="font-serif text-[30px] leading-tight italic">All caught up.</p>
            <p className="text-[15px] leading-relaxed text-muted">
              {items.length} highlight{items.length > 1 ? "s" : ""} reviewed today
              {reviewStreak() > 1 ? ` · ${reviewStreak()}-day streak` : ""}. The next ones come tomorrow.
            </p>
            <Link href="/" className="mt-4 flex h-12 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-on-ink">
              Back to Today
            </Link>
          </div>
        )}

        {ready && items.length === 0 && (
          <div className="mt-10 flex flex-col gap-3">
            <p className="font-serif text-[26px] leading-tight italic">Nothing to review today.</p>
            <p className="text-[15px] leading-relaxed text-muted">
              Highlight lines in articles and PDFs. From the next day, a few of them come back here each day, so what
              you read stays with you.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
