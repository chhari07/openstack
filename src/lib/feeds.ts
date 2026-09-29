"use client";

// Your own news feeds (any RSS or Atom feed, or a site that has one). Stored
// like everything else and synced to your account. The app reads the feeds
// straight from the phone; the website goes through /api/feed.
import { get, update } from "idb-keyval";
import { emit, uid } from "./db";
import type { FeedInfo, Story } from "./news";
import { isNative } from "./platform";
import { track } from "./sync-state";

export type UserFeed = FeedInfo & { id: string; addedAt: number; updatedAt: number };

export async function getFeeds(): Promise<UserFeed[]> {
  return ((await get<UserFeed[]>("feeds")) ?? []).sort((a, b) => a.addedAt - b.addedAt);
}

type Read = { info: FeedInfo; stories: Story[] };

// theverge.com and www.theverge.com, http and https: the same feed.
export const sameFeed = (a: string, b: string) => {
  const key = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "").toLowerCase();
  return key(a) === key(b);
};

async function read(url: string, fresh = false): Promise<Read | null> {
  if (isNative()) {
    const { readFeed } = await import("./news");
    return readFeed(url, async (u) => {
      try {
        const res = await fetch(u, { cache: fresh ? "no-store" : "default", signal: AbortSignal.timeout(10000) });
        return res.ok ? await res.text() : null;
      } catch {
        return null;
      }
    });
  }
  const res = await fetch(`/api/feed?url=${encodeURIComponent(url)}${fresh ? "&fresh=1" : ""}`, fresh ? { cache: "no-store" } : undefined);
  return res.ok ? res.json() : null;
}

// Checks the address is a feed (or a page with one) before adding it.
export async function addFeed(input: string): Promise<{ feed?: UserFeed; error?: string }> {
  const found = await read(input).catch(() => null);
  if (!found) return { error: "Couldn’t find a feed there. Try the site’s RSS link." };
  const all = await getFeeds();
  if (all.some((f) => sameFeed(f.url, found.info.url))) return { error: `${found.info.title} is already in your feeds.` };
  const now = Date.now();
  const feed: UserFeed = { ...found.info, id: uid(), addedAt: now, updatedAt: now };
  await update<UserFeed[]>("feeds", (list) => [...(list ?? []), feed]);
  await track("feeds", feed.id);
  emit();
  return { feed };
}

export async function removeFeed(id: string) {
  await update<UserFeed[]>("feeds", (list) => (list ?? []).filter((f) => f.id !== id));
  await track("feeds", id, "del");
  emit();
}

// Stories from all your feeds, newest first. Throws only if every feed failed.
export async function loadMyFeeds(fresh = false): Promise<Story[]> {
  const feeds = await getFeeds();
  if (!feeds.length) return [];
  const lists = await Promise.all(feeds.map((f) => read(f.url, fresh).catch(() => null)));
  if (lists.every((l) => !l)) throw new Error("feeds unavailable");
  const seen = new Set<string>();
  return lists
    .flatMap((l, i) => (l?.stories ?? []).map((s) => ({ ...s, source: feeds[i].title })))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .filter((s) => !seen.has(s.url) && seen.add(s.url))
    .slice(0, 60);
}

// One-tap suggestions in the "Add a feed" sheet.
export const SUGGESTED: { title: string; url: string; note: string }[] = [
  { title: "The Verge", url: "https://www.theverge.com/rss/index.xml", note: "Tech & culture" },
  { title: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/", note: "Web design & dev" },
  { title: "CSS-Tricks", url: "https://css-tricks.com/feed/", note: "Front-end" },
  { title: "NASA", url: "https://www.nasa.gov/feed/", note: "Space" },
  { title: "Hacker News: Best", url: "https://hnrss.org/best", note: "Top HN stories" },
  { title: "GitHub Blog", url: "https://github.blog/feed/", note: "Developer news" },
  { title: "Wired", url: "https://www.wired.com/feed/rss", note: "Science & tech" },
  { title: "Quanta Magazine", url: "https://www.quantamagazine.org/feed/", note: "Maths & science" },
];
