"use client";

import { useEffect, useState } from "react";
import type { Story, Topic } from "./news";
import { loadNews } from "./platform";

export type { Story, Topic };

export function useNews(topic: Topic) {
  const [state, setState] = useState<{
    topic: Topic;
    stories: Story[];
    status: "loading" | "ok" | "error";
  }>({ topic, stories: [], status: "loading" });

  useEffect(() => {
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

  // While a new topic loads, report loading instead of the old list.
  return state.topic === topic ? state : { topic, stories: [], status: "loading" as const };
}

export const safeImage = (url?: string) => (url && /^https?:\/\//.test(url) ? url : undefined);
