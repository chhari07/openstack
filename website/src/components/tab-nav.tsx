"use client";

import { useEffect, useState } from "react";
import { DiscIcon, HomeIcon, NewsIcon, NoteIcon, ShelfIcon } from "./icons";

// The app's tabs, in the app's order, with the same icons and dot colours
// (stack/src/components/tab-bar.tsx). Each one jumps to its part of the tour.
export const TABS = [
  { id: "today", label: "Today", Icon: HomeIcon, dot: "bg-music" },
  { id: "news", label: "News", Icon: NewsIcon, dot: "bg-news" },
  { id: "music", label: "Music", Icon: DiscIcon, dot: "bg-music" },
  { id: "library", label: "Library", Icon: ShelfIcon, dot: "bg-pdf" },
  { id: "notes", label: "Notes", Icon: NoteIcon, dot: "bg-ink" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

// Marks the tab whose section is in the middle of the screen, like the
// app marks the screen you're on. Without JavaScript the links still work.
export function TabNav({ layout }: { layout: "rail" | "bar" }) {
  const [active, setActive] = useState<TabId>("today");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id.replace("tab-", "") as TabId);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const t of TABS) {
      const el = document.getElementById(`tab-${t.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const rail = layout === "rail";
  return (
    <nav
      aria-label="App tabs"
      className={
        rail
          ? "flex flex-col items-center gap-2 rounded-3xl border border-line bg-paper py-4"
          : "flex justify-between border-y border-line bg-paper/95 px-2 pt-2 pb-1.5 backdrop-blur"
      }
    >
      {TABS.map(({ id, label, Icon, dot }) => {
        const on = active === id;
        return (
          <a
            key={id}
            href={`#tab-${id}`}
            aria-current={on ? "true" : undefined}
            className={`flex flex-col items-center gap-1 transition-colors ${rail ? "h-[62px] w-16" : "h-[50px] w-16"} ${
              on ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            <Icon />
            <span className={`label text-[10px] ${on ? "font-medium" : ""}`}>{label}</span>
            <span className={`size-1 rounded-full transition-opacity ${dot} ${on ? "opacity-100" : "opacity-0"}`} />
          </a>
        );
      })}
    </nav>
  );
}
