"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { BackIcon, BookmarkIcon, ClockIcon, ExternalIcon } from "@/components/icons";
import { useFocus } from "@/components/focus-provider";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { QuoteNoteSheet } from "@/components/quote-note-sheet";
import { AiSummary } from "@/components/ai-summary";
import { useToast } from "@/components/toast";
import { addNote, getNotes, getSaved, toggleSaved } from "@/lib/db";
import { useStore } from "@/lib/use-store";
import { paintHighlights } from "@/lib/highlights";
import { safeImage } from "@/lib/use-news";
import { loadArticle } from "@/lib/platform";
import { markArticleRead, useReadingTimer } from "@/lib/reading";
import { cacheArticle, forgetArticle, getOfflineIndex } from "@/lib/offline";
import { CheckCircleIcon, DownloadIcon } from "@/components/stack-icons";
import { newsTime } from "@/lib/format";
import { ListenButton } from "@/components/listen-button";
import type { Article } from "@/lib/article";
import type { Story } from "@/lib/news";


const SOURCE_COLOR: Record<string, string> = {
  "Hacker News": "#F26522",
  "dev.to": "#3B49DF",
  BBC: "#B80000",
  "The Hindu": "#1D3F74",
  "Times of India": "#D12E27",
  "Indian Express": "#0F4C81",
  "Al Jazeera": "#C6982C",
  Mint: "#F58220",
  "The Guardian": "#052962",
};

function stampOf(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB").replace(/\//g, ".");
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

export default function Page() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <Reader />
    </Suspense>
  );
}

function Reader() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { session: focus } = useFocus();
  const toast = useToast();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [article, setArticle] = useState<(Article & { offlineAt?: number }) | null>(null);
  const [offline] = useStore(getOfflineIndex, {});
  const kept = !!offline[id]?.keep;
  const [failed, setFailed] = useState(false);
  const [noteQuote, setNoteQuote] = useState<string | null>(null);
  const [notes] = useStore(getNotes, []);
  const [saved] = useStore(getSaved, []);

  // Saved videos (Library, search) link here too; play them instead.
  useEffect(() => {
    if (id.startsWith("yt-")) router.replace(`/watch?v=${id.slice(3)}`);
  }, [id, router]);

  useEffect(() => {
    if (id.startsWith("yt-")) return;
    let alive = true;
    loadArticle(id)
      .then((a) => {
        if (!alive) return;
        if (a) setArticle(a);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [id]);

  // Re-draw this article's saved highlights whenever notes change.
  const quotes = notes.filter((n) => n.articleId === id && n.quote).map((n) => n.quote!);
  const quotesKey = quotes.join("\u0000");
  useEffect(() => {
    if (!article?.html) return;
    paintHighlights("stack-article", bodyRef.current, quotes);
    return () => paintHighlights("stack-article", null, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article, quotesKey]);

  // Reading stats: time on the page, and "read" once the end comes into view.
  useReadingTimer(!!article?.html);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = endRef.current;
    if (!article?.html || !el) return;
    const seen = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        markArticleRead(id);
        seen.disconnect();
      }
    });
    seen.observe(el);
    return () => seen.disconnect();
  }, [article, id]);

  const isSaved = saved.some((s) => s.id === id);
  // What the news list knew about this story (headline, image, summary).
  const [listed] = useState<Story | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`stack.story:${id}`) ?? "null");
    } catch {
      return null;
    }
  });
  const pageLoaded = !!article?.html || (article?.title && !/^(www\.)?[\w-]+(\.[\w-]+)+$/.test(article.title));
  const title = (pageLoaded ? article?.title : null) ?? listed?.title ?? article?.title;
  const img = safeImage(article?.image ?? listed?.image);

  const save = async (quote: string, body?: string) => {
    if (!article) return;
    await addNote({
      kind: "article",
      quote,
      body: body || undefined,
      highlight: !body,
      sourceTitle: title ?? article.title,
      sourceLabel: article.source,
      articleId: id,
      href: `/read?id=${id}`,
    });
    toast({
      text: (
        <>
          Saved to <b>Notes</b> with source link
        </>
      ),
      href: "/notes",
    });
  };

  const bookmark = async () => {
    if (!article) return;
    const now = await toggleSaved({ id, title: title ?? article.title, source: article.source, image: img });
    // Saved articles stay readable offline.
    if (now && article.html) await cacheArticle(article, true);
    toast(now ? { text: "Saved to your Library · available offline", href: "/library" } : { text: "Removed from saved" });
  };

  const download = async () => {
    if (!article?.html) return;
    if (kept) {
      await forgetArticle(id);
      toast({ text: "Removed the offline copy" });
    } else {
      await cacheArticle(article, true);
      toast({ text: "Downloaded · you can read this offline" });
    }
  };

  return (
    <main className="-mt-[env(safe-area-inset-top)] min-h-dvh bg-soft">
      {/* Dark header with the story's image behind it */}
      <header className="relative flex min-h-[330px] flex-col px-5 pt-[calc(env(safe-area-inset-top)+20px)] pb-12 text-white md:min-h-[420px] md:px-[max(40px,calc((100%-760px)/2))]">
        {img && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="" className="absolute inset-0 size-full object-cover opacity-45" />
            <div className="absolute inset-0 bg-gradient-to-t from-soft via-soft/60 to-soft/20" />
          </>
        )}
        <div className="relative flex h-11 items-center justify-between">
          <button
            aria-label="Back"
            onClick={() => (history.length > 1 ? router.back() : router.push("/news"))}
            className="-ml-2 flex size-11 items-center justify-center"
          >
            <BackIcon size={22} />
          </button>
          <div className="-mr-2 flex">
            {(!focus || focus.endedAt) && (
              <Link
                href={`/focus?kind=article&id=${encodeURIComponent(id)}&title=${encodeURIComponent(title ?? "")}`}
                aria-label="Start a focus session with this article"
                className="flex size-11 items-center justify-center"
              >
                <ClockIcon size={20} />
              </Link>
            )}
            {article?.html && (
              <ListenButton
                title={title ?? article.title}
                source={article.source}
                getText={() => `${title ?? article.title}.\n\n${bodyRef.current?.innerText ?? ""}`}
              />
            )}
            {article?.html && (
              <button
                aria-label={kept ? "Available offline (tap to remove)" : "Download for offline"}
                aria-pressed={kept}
                onClick={download}
                className="flex size-11 items-center justify-center"
              >
                {kept ? <CheckCircleIcon size={20} /> : <DownloadIcon size={20} />}
              </button>
            )}
            <button
              aria-label={isSaved ? "Remove bookmark" : "Bookmark"}
              aria-pressed={isSaved}
              onClick={bookmark}
              className="flex size-11 items-center justify-center"
            >
              <BookmarkIcon size={20} filled={isSaved} />
            </button>
          </div>
        </div>
        <div className="relative mt-auto pt-16 md:[&_h1]:text-[40px]">
          <span className="label text-[10px] text-[#BDBAB2]">
            {stampOf(article?.createdAt)}
            {article?.readMinutes ? ` · ${article.readMinutes} min read` : ""}
          </span>
          <h1 className="mt-2.5 text-[25px] leading-[1.2] font-bold">
            {title ?? (failed ? "Story not found" : "Loading…")}
          </h1>
          {article && (
            <div className="mt-3.5 flex items-center gap-2.5">
              <span className="size-7 rounded-md" style={{ background: SOURCE_COLOR[article.source] ?? "#6B6862" }} />
              <span className="label text-[10px]">
                {article.source}
                {article.author ? ` · ${article.author}` : ""}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="relative -mt-3 min-h-[60dvh] rounded-t-[26px] bg-paper px-[26px] pt-9 pb-32 md:px-[max(40px,calc((100%-760px)/2))] md:[&_.prose-stack]:text-[19px]">
        {article && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="label absolute -top-6 right-[22px] flex h-12 md:right-[max(40px,calc((100%-760px)/2))] items-center gap-2 rounded-full bg-news px-[22px] text-[11px] font-medium text-white shadow-[0_8px_20px_rgba(10,138,58,.35)]"
          >
            Original <ExternalIcon size={14} />
          </a>
        )}

        {!article && !failed && (
          <div aria-hidden className="flex animate-pulse flex-col gap-3">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-4 rounded bg-rule" style={{ width: `${70 + ((i * 37) % 30)}%` }} />
            ))}
          </div>
        )}

        {failed && listed?.url && (
          <div className="flex flex-col gap-4">
            {listed.summary && <p className="text-[17px] leading-relaxed">{listed.summary}</p>}
            <p className="text-[15px] text-muted">This story can’t be shown in reader mode here.</p>
            <a
              href={listed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-on-ink"
            >
              Read on {listed.domain ?? "the site"} <ExternalIcon size={15} />
            </a>
          </div>
        )}
        {failed && !listed?.url && (
          <p className="text-[15px] text-muted">
            This story couldn’t be loaded. <Link href="/news" className="underline">Back to news</Link>
          </p>
        )}

        {article && article.html === null && (
          <div className="flex flex-col gap-4">
            {listed?.summary && <p className="text-[17px] leading-relaxed">{listed.summary}</p>}
            <p className="text-[16px] leading-relaxed">
              This page can’t be shown in reader mode (it may be an app, a video or a paywalled site).
            </p>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-on-ink"
            >
              Open {new URL(article.url).hostname.replace(/^www\./, "")} <ExternalIcon size={16} />
            </a>
          </div>
        )}

        {article?.html && (
          <>
            <AiSummary id={id} title={title ?? article.title} html={article.html} source={article.source} />
            {article.offlineAt && (
              <p className="label mb-3 rounded-xl bg-news-tint px-3.5 py-2.5 text-[10px] text-news-deep">
                Offline copy · saved {newsTime(article.offlineAt)}
              </p>
            )}
            <p className="label mb-5 text-[10px] text-muted">Select text to highlight or add a note</p>
            <div
              ref={bodyRef}
              className="prose-stack"
              // Sanitised on the server (see api/article/route.ts).
              dangerouslySetInnerHTML={{ __html: article.html }}
            />
            <div ref={endRef} aria-hidden className="h-px" />
          </>
        )}
      </div>

      <SelectionToolbar
        container={bodyRef}
        accent="text-news-text"
        onHighlight={(t) => save(t)}
        onNote={(t) => setNoteQuote(t)}
      />
      <QuoteNoteSheet
        quote={noteQuote}
        tint="bg-news-tint"
        onClose={() => setNoteQuote(null)}
        onSave={(body) => {
          if (noteQuote) save(noteQuote, body);
          setNoteQuote(null);
        }}
      />
    </main>
  );
}
