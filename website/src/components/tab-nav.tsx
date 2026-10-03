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

// The app's floating pill puts Today in the middle; the rail keeps it first.
const PILL = [TABS[1], TABS[2], TABS[0], TABS[3], TABS[4]];

export type TabId = (typeof TABS)[number]["id"];

// Marks the tab whose section is in the middle of the screen, like the
// app marks the screen you're on. Without JavaScript the links still work.
// On phones the pill only floats while the tour is on screen.
export function TabNav({ layout }: { layout: "rail" | "pill" }) {
  const [active, setActive] = useState<TabId>("today");
  const [shown, setShown] = useState(false);

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
    const tour = document.getElementById("tour");
    const inTour = new IntersectionObserver(([e]) => setShown(e.isIntersecting), { rootMargin: "-30% 0px -40% 0px" });
    if (tour) inTour.observe(tour);
    return () => {
      observer.disconnect();
      inTour.disconnect();
    };
  }, []);

  if (layout === "pill") {
    return (
      <nav
        aria-label="App tabs"
        className={`fixed bottom-[max(env(safe-area-inset-bottom),14px)] left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full bg-ink p-1.5 shadow-[0_10px_28px_rgba(0,0,0,.28)] transition duration-300 ${
          shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-24 opacity-0"
        }`}
      >
        {PILL.map(({ id, label, Icon }) => {
          const on = active === id;
          return (
            <a
              key={id}
              href={`#tab-${id}`}
              aria-label={label}
              aria-current={on ? "true" : undefined}
              tabIndex={shown ? undefined : -1}
              className={`flex size-[min(48px,12.2vw)] items-center justify-center rounded-full transition-colors ${
                on ? "bg-on-ink text-ink" : "text-on-ink/60 hover:text-on-ink"
              }`}
            >
              <Icon />
            </a>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="App tabs" className="flex flex-col items-center gap-2 rounded-3xl border border-line bg-paper py-4">
      {TABS.map(({ id, label, Icon, dot }) => {
        const on = active === id;
        return (
          <a
            key={id}
            href={`#tab-${id}`}
            aria-current={on ? "true" : undefined}
            className={`flex h-[68px] w-[72px] flex-col items-center justify-center gap-1 rounded-2xl transition ${
              on ? "bg-card text-ink shadow-[0_2px_10px_rgba(0,0,0,.05)]" : "text-muted hover:text-ink"
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
