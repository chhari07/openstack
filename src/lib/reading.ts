"use client";

// Reading stats: time spent reading articles and PDFs, articles read to the
// end and PDF pages turned, per day. Kept in localStorage (small, and part of
// backups), never sent anywhere.
import { useEffect, useRef } from "react";
import { emit } from "./db";

const KEY = "stack.reading";
const DAY = 86_400_000;
const KEEP_DAYS = 400;

type Day = { ms: number; articles: string[]; pages: string[] }; // pages: "<pdfId>:<page>"
type Log = Record<string, Day>; // "2026-09-30" → Day

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function read(): Log {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Log;
  } catch {
    return {};
  }
}

function change(fn: (day: Day) => boolean | void, now = Date.now()) {
  const log = read();
  const key = dayKey(now);
  const day = log[key] ?? { ms: 0, articles: [], pages: [] };
  if (fn(day) === false) return;
  log[key] = day;
  // Forget days older than a year or so.
  const oldest = dayKey(now - KEEP_DAYS * DAY);
  for (const k of Object.keys(log)) if (k < oldest) delete log[k];
  try {
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {}
  emit();
}

export const addReadingTime = (ms: number) => ms > 0 && change((d) => void (d.ms += ms));

export const markArticleRead = (id: string) =>
  change((d) => {
    if (d.articles.includes(id)) return false;
    d.articles.push(id);
  });

export const markPageRead = (pdfId: string, page: number) =>
  change((d) => {
    const k = `${pdfId}:${page}`;
    if (d.pages.includes(k)) return false;
    d.pages.push(k);
  });

export type Week = {
  minutes: number;
  articles: number;
  pages: number;
  days: { label: string; minutes: number; today: boolean }[]; // Monday to Sunday
  todayMinutes: number;
  lastWeekMinutes: number;
};

/** This week (Monday to Sunday) and a comparison with last week. */
export async function getWeek(now = Date.now()): Promise<Week> {
  const log = read();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const monday = today.getTime() - ((today.getDay() + 6) % 7) * DAY;
  const days = Array.from({ length: 7 }, (_, i) => {
    const t = monday + i * DAY;
    const d = log[dayKey(t)];
    return {
      label: new Date(t).toLocaleDateString("en-GB", { weekday: "narrow" }),
      minutes: Math.round((d?.ms ?? 0) / 60_000),
      today: t === today.getTime(),
      articles: d?.articles.length ?? 0,
      pages: d?.pages.length ?? 0,
    };
  });
  let lastWeekMs = 0;
  for (let i = 1; i <= 7; i++) lastWeekMs += log[dayKey(monday - i * DAY)]?.ms ?? 0;
  return {
    minutes: days.reduce((s, d) => s + d.minutes, 0),
    articles: days.reduce((s, d) => s + d.articles, 0),
    pages: days.reduce((s, d) => s + d.pages, 0),
    days: days.map(({ label, minutes, today }) => ({ label, minutes, today })),
    todayMinutes: days.find((d) => d.today)?.minutes ?? 0,
    lastWeekMinutes: Math.round(lastWeekMs / 60_000),
  };
}

/** Days with any reading, as timestamps (for streaks and the activity heatmap). */
export function readingDays(): number[] {
  return Object.entries(read())
    .filter(([, d]) => d.ms >= 60_000 || d.articles.length || d.pages.length)
    .map(([k]) => new Date(`${k}T12:00:00`).getTime());
}

export const minutesText = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

/**
 * Counts reading time while the page is on screen and in use. After two
 * minutes without a scroll, tap or key press it stops counting, so a screen
 * left open doesn't count as reading.
 */
export function useReadingTimer(active = true) {
  const last = useRef(0);
  useEffect(() => {
    if (!active) return;
    last.current = Date.now();
    let pending = 0;
    const touch = () => (last.current = Date.now());
    const events = ["scroll", "pointerdown", "keydown", "wheel", "touchmove"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const STEP = 5000;
    const tick = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - last.current < 120_000) pending += STEP;
      if (pending >= 30_000) {
        addReadingTime(pending);
        pending = 0;
      }
    }, STEP);
    return () => {
      clearInterval(tick);
      events.forEach((e) => window.removeEventListener(e, touch));
      addReadingTime(pending);
    };
  }, [active]);
}
