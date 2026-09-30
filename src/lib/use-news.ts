"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Story, Topic } from "./news";
import { loadNews } from "./platform";
import { cacheNews, getCachedNews, prefetchTop } from "./offline";

export type { Story, Topic };

export function useNews(topic: Topic) {
  const [state, setState] = useState<{
    topic: Topic;
    stories: Story[];
    status: "loading" | "ok" | "error";
    updatedAt?: number; // when these stories were fetched
    offline?: boolean; // no connection: the last list saved on this device
  }>({ topic, stories: [], status: "loading" });
  const current = useRef(topic);

  useEffect(() => {
    current.current = topic;
    let alive = true;
    loadNews(topic)
      .then(async (stories) => {
        // Sources that can't be reached come back empty: show the saved list.
        if (!stories.length) {
          const saved = await getCachedNews(topic);
          if (saved) {
            if (alive) setState({ topic, stories: saved.stories, status: "ok", updatedAt: saved.at, offline: true });
            return;
          }
        }
        if (alive) setState({ topic, stories, status: "ok", updatedAt: Date.now() });
        cacheNews(topic, stories).catch(() => {});
        if (topic === "top") prefetchTop(stories).catch(() => {});
      })
      .catch(async () => {
        const saved = await getCachedNews(topic).catch(() => null);
        if (!alive) return;
        setState(
          saved
            ? { topic, stories: saved.stories, status: "ok", updatedAt: saved.at, offline: true }
            : { topic, stories: [], status: "error" },
        );
      });
    return () => {
      alive = false;
    };
  }, [topic]);

  // Pull to refresh: fetch past the cache, keeping the old stories on screen
  // until the new ones arrive. Resolves to whether it worked.
  const refresh = useCallback(async () => {
    try {
      const stories = await loadNews(topic, true);
      if (!stories.length && topic !== "mine") return false;
      if (current.current === topic) setState({ topic, stories, status: "ok", updatedAt: Date.now() });
      cacheNews(topic, stories).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }, [topic]);

  // While a new topic loads, report loading instead of the old list.
  const shown =
    state.topic === topic ? state : { topic, stories: [], status: "loading" as const };
  return { ...shown, refresh };
}

export const safeImage = (url?: string) => (url && /^https?:\/\//.test(url) ? url : undefined);
