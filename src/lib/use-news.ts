"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Story, Topic } from "./news";
import { loadNews } from "./platform";

export type { Story, Topic };

export function useNews(topic: Topic) {
  const [state, setState] = useState<{
    topic: Topic;
    stories: Story[];
    status: "loading" | "ok" | "error";
  }>({ topic, stories: [], status: "loading" });
  const current = useRef(topic);

  useEffect(() => {
    current.current = topic;
    let alive = true;
    loadNews(topic)
      .then((stories) => {
        if (alive) setState({ topic, stories, status: "ok" });
      })
      .catch(() => {
        if (alive) setState({ topic, stories: [], status: "error" });
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
      if (current.current === topic) setState({ topic, stories, status: "ok" });
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
