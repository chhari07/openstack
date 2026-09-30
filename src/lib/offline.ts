"use client";

// Offline reading. Two kinds of copies live in IndexedDB:
// - articles you downloaded or saved: kept until you remove them;
// - today's top stories, fetched in the background: dropped after 3 days.
// Plus the last news list of each topic, shown when there's no connection.
import { del, get, set, update } from "idb-keyval";
import type { Article } from "./article";
import type { Story, Topic } from "./news";
import { emit } from "./db";

type Entry = { at: number; keep: boolean };
type Index = Record<string, Entry>;

const INDEX = "offline:index";
const art = (id: string) => `offline:article:${id}`;
const AUTO_DAYS = 3;
const PREFETCH_KEY = "stack.offline.prefetchedAt";
const PREFETCH_EVERY = 2 * 3600_000;

export const getOfflineIndex = async () => (await get<Index>(INDEX)) ?? {};

export async function getCachedArticle(id: string) {
  return (await get<Article>(art(id))) ?? null;
}

/** Stores a readable copy. `keep`: stays until removed (downloads, saved articles). */
export async function cacheArticle(a: Article, keep: boolean) {
  if (!a.html) return;
  await set(art(a.id), a);
  await update<Index>(INDEX, (all) => {
    const next = { ...(all ?? {}) };
    next[a.id] = { at: Date.now(), keep: keep || !!next[a.id]?.keep };
    return next;
  });
  emit();
}

/** Stops keeping an article; it goes with the next clean-up. */
export async function forgetArticle(id: string) {
  await del(art(id));
  await update<Index>(INDEX, (all) => {
    const next = { ...(all ?? {}) };
    delete next[id];
    return next;
  });
  emit();
}

/** Fetches and keeps an article (bookmarking from a news card). */
export async function downloadArticle(id: string) {
  if (id.startsWith("yt-")) return false;
  const { fetchArticle } = await import("./platform");
  const a = await fetchArticle(id).catch(() => null);
  if (!a?.html) return false;
  await cacheArticle(a, true);
  return true;
}

async function prune(now = Date.now()) {
  const index = await getOfflineIndex();
  const old = Object.entries(index).filter(([, e]) => !e.keep && now - e.at > AUTO_DAYS * 86_400_000);
  if (!old.length) return;
  await Promise.all(old.map(([id]) => del(art(id))));
  await update<Index>(INDEX, (all) => {
    const next = { ...(all ?? {}) };
    for (const [id] of old) delete next[id];
    return next;
  });
}

/** Background copies of the first few top stories, at most every two hours. */
export async function prefetchTop(stories: Story[]) {
  try {
    const last = Number(localStorage.getItem(PREFETCH_KEY) ?? 0);
    if (Date.now() - last < PREFETCH_EVERY || !navigator.onLine) return;
    localStorage.setItem(PREFETCH_KEY, String(Date.now()));
  } catch {
    return;
  }
  await prune();
  const index = await getOfflineIndex();
  const { fetchArticle } = await import("./platform");
  // One at a time, so it never competes with what you're opening.
  for (const s of stories.filter((s) => !s.video && !index[s.id]).slice(0, 6)) {
    const a = await fetchArticle(s.id).catch(() => null);
    if (a?.html) await cacheArticle(a, false);
  }
}

// ---- News lists ----

const news = (topic: Topic) => `offline:news:${topic}`;

export async function cacheNews(topic: Topic, stories: Story[]) {
  if (stories.length) await set(news(topic), { at: Date.now(), stories });
}

export async function getCachedNews(topic: Topic) {
  return (await get<{ at: number; stories: Story[] }>(news(topic))) ?? null;
}
