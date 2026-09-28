"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TabBar } from "@/components/tab-bar";
import { Chips } from "@/components/sheet";
import { HeroStory, StoryRow, StorySkeleton } from "@/components/story";
import { NewsCards } from "@/components/news-cards";
import { RefreshLogo, usePullToRefresh } from "@/components/pull-refresh";
import { useToast } from "@/components/toast";
import { Logo } from "@/components/logo";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { useNews, type Topic } from "@/lib/use-news";
import { isTopic, TOPICS } from "@/lib/news";
import { dayStamp } from "@/lib/format";

const TOPIC_KEY = "stack.news-topic";
const VIEW_KEY = "stack.news-view";
type View = "cards" | "list";

export default function News() {
  const [topic, setTopicState] = useState<Topic>("top");
  // Remember the last topic between visits.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TOPIC_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && isTopic(saved)) setTopicState(saved);
    } catch {}
  }, []);
  const setTopic = (t: Topic) => {
    setTopicState(t);
    try {
      localStorage.setItem(TOPIC_KEY, t);
    } catch {}
  };
  const [view, setViewState] = useState<View>("cards");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(VIEW_KEY) === "list") setViewState("list");
    } catch {}
  }, []);
  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [stamp, setStamp] = useState<{ day: string; date: string } | null>(
    null,
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const news = useNews(topic);
  const toast = useToast();
  const page = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    if (busy || news.status === "loading") return;
    setBusy(true);
    // Keep the logo stacking for a moment even when the network is quick.
    const [ok] = await Promise.all([
      news.refresh(),
      new Promise((r) => setTimeout(r, 1200)),
    ]);
    setBusy(false);
    toast({
      text: ok ? "News updated" : "Couldn’t refresh. Check your connection.",
    });
  };
  const pull = usePullToRefresh(page, refresh, busy || searching);
  const word =
    topic === "top"
      ? "NEWS"
      : (TOPICS.find((t) => t.value === topic)?.label ?? "").toUpperCase();

  // Date is read on the client only, so server and client HTML match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setStamp(dayStamp()), []);
  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  const stories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? news.stories.filter((s) => s.title.toLowerCase().includes(q))
      : news.stories;
  }, [news.stories, query]);

  const heroes = query ? [] : stories.slice(0, 3);
  const rest = query ? stories : stories.slice(3);

  const cards = view === "cards";

  return (
    <main
      ref={page}
      className={
        cards
          ? "flex h-[calc(100dvh-env(safe-area-inset-top))] flex-col px-5 pt-5 pb-[calc(var(--above-tabs)-10px)] md:px-10 md:pt-8 md:pb-6"
          : "px-5 pt-5 pb-[120px] md:px-10 md:pt-8"
      }
    >
      <div className="flex h-11 shrink-0 items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            aria-label="Refresh news"
            onClick={refresh}
            className="-m-2.5 flex size-[46px] items-center justify-center"
          >
            <span className="flex size-[26px] items-center justify-center rounded-md bg-news text-white">
              <Logo size={20} loop={busy} />
            </span>
          </button>
          <span className="label text-[12px] font-medium">News</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            role="tablist"
            aria-label="Layout"
            className="flex rounded-full border border-ink/15 p-0.5"
          >
            {(["cards", "list"] as View[]).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`label h-7 rounded-full px-2.5 text-[10px] ${view === v ? "bg-ink text-on-ink" : ""}`}
              >
                {v === "cards" ? "Cards" : "List"}
              </button>
            ))}
          </div>
          <button
            aria-label={searching ? "Close search" : "Search"}
            onClick={() => {
              setSearching((s) => !s);
              setQuery("");
            }}
            className="-mr-2 flex size-11 items-center justify-center"
          >
            {searching ? <CloseIcon size={22} /> : <SearchIcon size={22} />}
          </button>
        </div>
      </div>

      {searching ? (
        <label className="mt-2.5 flex h-[46px] items-center gap-2.5 rounded-full border border-ink/12 bg-card px-4">
          <SearchIcon size={18} className="text-muted" />
          <input
            ref={searchRef}
            aria-label="Search headlines"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search today's headlines"
            className="grow bg-transparent text-[14px] outline-none"
          />
        </label>
      ) : cards ? (
        <div className="mt-1.5 flex shrink-0 items-end justify-between">
          <h1 className="display text-[40px] leading-[0.9] tracking-[-0.03em]">
            {word} TODAY
          </h1>
          <span className="label text-[10px]">
            {stamp ? `${stamp.day} ${stamp.date}` : ""}
          </span>
        </div>
      ) : (
        <div className="mt-2.5 flex items-end justify-between">
          <h1
            className={`display leading-[0.85] tracking-[-0.03em] ${word.length > 7 ? "text-[46px]" : "text-[64px]"}`}
          >
            {word}
            <br />
            TODAY
          </h1>
          <span className="label text-right text-[10px] leading-normal">
            {stamp?.day}
            <br />
            {stamp?.date}
          </span>
        </div>
      )}

      <div className={cards ? "mt-3 mb-3 shrink-0" : "mt-4"}>
        <Chips
          label="Topic"
          options={TOPICS}
          value={topic}
          onChange={setTopic}
        />
      </div>

      {cards && (
        <>
          {news.status === "loading" && (
            <div
              aria-hidden
              className="grow animate-pulse rounded-3xl bg-rule"
            />
          )}
          {news.status === "error" && (
            <p className="py-10 text-center text-[14px] text-muted">
              Couldn’t reach the news sources. Check your connection and try
              again.
            </p>
          )}
          {news.status === "ok" && stories.length === 0 && (
            <p className="py-10 text-center text-[14px] text-muted">
              No stories match.
            </p>
          )}
          {stories.length > 0 && <NewsCards stories={stories} />}
        </>
      )}

      {!cards && heroes.length > 0 && (
        <div className="no-scrollbar -mx-5 mt-[18px] flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 md:mx-0 md:gap-5 md:px-0">
          {heroes.map((s) => (
            <div key={s.id} className="w-[82%] shrink-0 snap-start md:w-auto md:flex-1 md:shrink md:[&>a]:h-[300px]!">
              <HeroStory story={s} />
            </div>
          ))}
        </div>
      )}

      {!cards && (
        <>
          <div className="mt-[22px] flex items-baseline justify-between">
            <h2 className="text-[19px] font-bold">
              {query ? `Results for “${query}”` : "Today’s posts"}
            </h2>
            <span className="label truncate pl-3 text-[10px] text-muted">
              {[...new Set(news.stories.map((s) => s.source))]
                .slice(0, 3)
                .join(" · ")}
            </span>
          </div>

          <div className="mt-1 md:grid md:grid-cols-2 md:gap-x-10">
            {news.status === "loading" && <StorySkeleton rows={5} />}
            {news.status === "error" && (
              <p className="py-10 text-center text-[14px] text-muted">
                Couldn’t reach the news sources. Check your connection and try
                again.
              </p>
            )}
            {news.status === "ok" && rest.length === 0 && (
              <p className="py-10 text-center text-[14px] text-muted">
                No stories match.
              </p>
            )}
            {rest.map((s, i) => (
              <StoryRow key={s.id} story={s} index={i} />
            ))}
          </div>
        </>
      )}

      <RefreshLogo pull={pull} busy={busy} />
      <TabBar />
    </main>
  );
}
