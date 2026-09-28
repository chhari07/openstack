"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Logo } from "@/components/logo";
import { CheckIcon, ClockIcon, ExternalIcon } from "@/components/icons";
import { getSaved } from "@/lib/db";
import { isNative } from "@/lib/platform";
import { useStore } from "@/lib/use-store";
import { RESULT_KEY, type ShareResult } from "@/lib/share-in";

// "Saved" screen, shown when the share card's "Open in Stack" is tapped. The
// item was already imported (components/native-boot.tsx); this shows it.
export default function Page() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <Share />
    </Suspense>
  );
}

function Share() {
  const params = useSearchParams();
  const router = useRouter();
  const [result, setResult] = useState<ShareResult | null>(null);
  // Live Library entry, so the real title and picture appear once fetched.
  const [saved] = useStore(getSaved, []);

  useEffect(() => {
    const last = sessionStorage.getItem(RESULT_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult(last ? JSON.parse(last) : { kind: "error", message: "Nothing was shared." });
  }, [params]);

  const entry = result?.kind === "link" ? saved.find((a) => a.id === result.id) : undefined;
  const title = entry?.title ?? (result?.kind === "link" || result?.kind === "pdf" ? result.title : "");
  const image = entry?.image ?? (result?.kind === "link" ? result.image : undefined);

  // Back to the app the user shared from.
  const done = () => {
    if (isNative()) App.minimizeApp().catch(() => router.push("/library"));
    else router.push("/library");
  };

  return (
    <main className="screen flex flex-col px-5 pt-5 pb-[calc(max(env(safe-area-inset-bottom),20px)+28px)] md:px-10 md:pt-8">
      <div className="flex h-8 items-center">
        <Logo size={28} className="-ml-1" />
      </div>
      <div className="mx-auto flex w-full max-w-[560px] grow flex-col">
        {result && result.kind !== "error" && (
          <>
            <h1 className="display -ml-1.5 mt-4 text-[clamp(88px,30vw,150px)]">SAVED</h1>
            <p className="mt-3 flex items-center gap-2 text-[15px] text-muted">
              <CheckIcon size={18} className="text-news-text" />
              {result.kind === "link" && (result.video ? "Video saved to your Library" : "Saved to your Library to read later")}
              {result.kind === "pdf" && "Added to the “Shared” shelf"}
              {result.kind === "note" && "Saved as a note"}
            </p>
          </>
        )}

        {result?.kind === "link" && (
          <div className="relative mt-6 flex min-h-[200px] flex-col justify-end overflow-hidden rounded-2xl bg-soft p-5 text-white">
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="absolute inset-0 size-full object-cover opacity-50" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
            <span className="label relative text-[10px] text-white/70">{result.site}</span>
            <span className="relative mt-1.5 line-clamp-3 text-[20px] leading-tight font-bold">{title}</span>
          </div>
        )}
        {result?.kind === "pdf" && (
          <div className="mt-6 rounded-2xl bg-card p-5">
            <p className="font-serif text-[22px] leading-tight font-semibold">{result.title}</p>
            <p className="label mt-2 text-[10px] text-muted">PDF · {result.pages} pages</p>
          </div>
        )}
        {result?.kind === "note" && (
          <p className="mt-6 line-clamp-6 rounded-2xl bg-card p-5 text-[16px] leading-relaxed whitespace-pre-line">
            {result.text}
          </p>
        )}
        {result?.kind === "error" && (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <p className="font-serif text-[24px] italic">{result.message}</p>
            <Link href="/" className="label text-[11px] underline">Go to Today</Link>
          </div>
        )}

        {result && result.kind !== "error" && (
          <div className="mt-auto flex flex-col gap-2.5 pt-8">
            {result.kind === "link" && result.video && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-14 items-center justify-center gap-2 rounded-full bg-ink text-[16px] font-semibold text-on-ink"
              >
                Watch now <ExternalIcon size={16} />
              </a>
            )}
            {(result.kind === "pdf" || (result.kind === "link" && !result.video)) && (
              <Link
                href={result.kind === "pdf" ? `/library/read?id=${result.pdfId}` : `/read?id=${result.id}`}
                className="flex h-14 items-center justify-center rounded-full bg-ink text-[16px] font-semibold text-on-ink"
              >
                Read now
              </Link>
            )}
            {result.kind !== "note" && !(result.kind === "link" && result.video) && (
              <Link
                href={
                  result.kind === "pdf"
                    ? `/focus?kind=pdf&id=${result.pdfId}&title=${encodeURIComponent(result.title)}`
                    : `/focus?kind=article&id=${encodeURIComponent(result.id)}&title=${encodeURIComponent(title)}`
                }
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-card text-[15px] font-semibold"
              >
                <ClockIcon size={18} /> Focus on it
              </Link>
            )}
            {result.kind === "note" && (
              <Link
                href={`/notes/edit?id=${result.noteId}`}
                className="flex h-14 items-center justify-center rounded-full bg-ink text-[16px] font-semibold text-on-ink"
              >
                Open note
              </Link>
            )}
            <button onClick={done} className="h-12 rounded-full border border-ink/20 text-[15px] font-semibold">
              Done
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
