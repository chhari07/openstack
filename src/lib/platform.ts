"use client";

import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import type { Article } from "./article";
import type { Story, Topic } from "./news";

// True inside the Android app (Capacitor), false on the website.
export const isNative = () => Capacitor.isNativePlatform();

// The Google Play build (`./build-aab.sh`). Play doesn't allow "All files
// access" for a reading app, and Spotify caps small apps at 25 users, so that
// build leaves both out. The sideloaded APK and the website keep them.
export const PLAY_BUILD = process.env.NEXT_PUBLIC_STACK_STORE === "play";

// Website: ask our API routes. App: fetch the sources straight from the phone.
export async function loadNews(topic: Topic, fresh = false): Promise<Story[]> {
  if (topic === "mine") {
    const { loadMyFeeds } = await import("./feeds");
    return loadMyFeeds(fresh);
  }
  if (isNative()) {
    const { getNews } = await import("./news");
    return getNews(topic, fresh);
  }
  const res = await fetch(
    `/api/news?topic=${topic}${fresh ? "&fresh=1" : ""}`,
    fresh ? { cache: "no-store" } : undefined,
  );
  if (!res.ok) throw new Error(`news ${res.status}`);
  return (await res.json()).stories;
}

export async function loadArticle(id: string): Promise<Article | null> {
  if (isNative()) {
    const { getArticleNative } = await import("./article-native");
    return getArticleNative(id);
  }
  const res = await fetch(`/api/article?id=${encodeURIComponent(id)}`);
  return res.ok ? res.json() : null;
}

const noSubscribe = () => () => {};
// For rendering: false during the static build, the real value in the browser.
export const useIsNative = () => useSyncExternalStore(noSubscribe, isNative, () => false);
