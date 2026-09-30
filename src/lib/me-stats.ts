"use client";

// Everything the profile page shows about you: totals, an activity heatmap,
// badges and a "reader type". Worked out from what's already on the device
// (notes, saved articles, PDFs, playlists, focus history), so nothing new is
// stored or synced.
import { getNotes, getPdfs, getSaved } from "./db";
import { getHistory, stats as focusStats } from "./focus";
import { getPlaylists } from "./playlists";
import { reviewStreak } from "./review";
import { readingDays } from "./reading";

export const HEAT_WEEKS = 18;
const DAY = 86_400_000;

export type Badge = {
  id: string;
  icon: string; // see components/profile-icons.tsx
  title: string;
  hint: string; // how to earn it
  value: number;
  target: number;
};

export type ReaderType = { icon: string; title: string; line: string };

export type MeStats = {
  notes: number;
  highlights: number;
  ideas: number;
  saved: number;
  pdfs: number;
  pagesRead: number;
  playlists: number;
  focusMinutes: number;
  todayMinutes: number;
  focusStreak: number;
  reviewStreak: number;
  activeStreak: number; // days in a row with anything done in Stack
  bestStreak: number;
  heat: number[]; // HEAT_WEEKS * 7 days, oldest first, ending on this week's Saturday
  heatStart: number; // the first day in `heat`
  badges: Badge[];
  type: ReaderType;
  timeOfDay: "early" | "night" | "day" | null;
};

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const dayKey = (t: number) => new Date(t).toDateString();

export const EMPTY_STATS: MeStats = {
  notes: 0,
  highlights: 0,
  ideas: 0,
  saved: 0,
  pdfs: 0,
  pagesRead: 0,
  playlists: 0,
  focusMinutes: 0,
  todayMinutes: 0,
  focusStreak: 0,
  reviewStreak: 0,
  activeStreak: 0,
  bestStreak: 0,
  heat: [],
  heatStart: 0,
  badges: [],
  type: { icon: "sprout", title: "Fresh start", line: "Read, highlight or focus and your Stack grows here." },
  timeOfDay: null,
};

export async function getMeStats(now = Date.now()): Promise<MeStats> {
  const [notes, pdfs, saved, playlists, history] = await Promise.all([
    getNotes(),
    getPdfs(),
    getSaved(),
    getPlaylists(),
    getHistory(),
  ]);

  const highlights = notes.filter((n) => n.quote).length;
  const ideas = notes.filter((n) => n.kind === "idea").length;
  const pagesRead = pdfs.reduce((sum, p) => sum + (p.lastPage ?? 0), 0);
  const focusMs = history.reduce((sum, r) => sum + r.focusedMs, 0);
  const longestMin = Math.max(0, ...history.map((r) => r.focusedMs / 60_000));
  const focus = focusStats(history, now);

  // Every moment you did something in Stack.
  const events = [
    ...notes.map((n) => n.createdAt),
    ...saved.map((s) => s.savedAt),
    ...pdfs.flatMap((p) => [p.addedAt, p.lastOpenedAt ?? 0]),
    ...history.map((r) => r.startedAt),
    ...playlists.map((p) => p.createdAt),
    ...readingDays(),
  ].filter((t) => t > 0 && t <= now);

  // Heatmap: whole weeks (Sunday to Saturday) so the columns line up.
  const today = startOfDay(now);
  const end = today + (6 - new Date(today).getDay()) * DAY;
  const heatStart = end - (HEAT_WEEKS * 7 - 1) * DAY;
  const heat = new Array<number>(HEAT_WEEKS * 7).fill(0);
  for (const t of events) {
    const i = Math.round((startOfDay(t) - heatStart) / DAY);
    if (i >= 0 && i < heat.length) heat[i]++;
  }

  // Streaks of active days.
  const days = new Set(events.map(dayKey));
  let activeStreak = 0;
  const d = new Date(now);
  if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d.getTime()))) {
    activeStreak++;
    d.setDate(d.getDate() - 1);
  }
  const sorted = [...days].map((k) => new Date(k).getTime()).sort((a, b) => a - b);
  let bestStreak = 0;
  let run = 0;
  sorted.forEach((t, i) => {
    run = i > 0 && Math.round((t - sorted[i - 1]) / DAY) === 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
  });

  // When you usually show up.
  const hours = events.map((t) => new Date(t).getHours());
  const early = hours.filter((h) => h >= 4 && h < 8).length;
  const night = hours.filter((h) => h >= 22 || h < 4).length;
  const timeOfDay =
    hours.length < 5 ? null : night / hours.length >= 0.35 ? "night" : early / hours.length >= 0.25 ? "early" : "day";

  const focusMinutes = Math.round(focusMs / 60_000);
  const review = reviewStreak();

  const badges: Badge[] = [
    { id: "first-note", icon: "edit", title: "First words", hint: "Write your first note", value: notes.length, target: 1 },
    { id: "highlighter", icon: "highlighter", title: "Highlighter", hint: "Highlight 25 passages", value: highlights, target: 25 },
    { id: "ideas", icon: "idea", title: "Idea machine", hint: "Write 10 idea notes", value: ideas, target: 10 },
    { id: "curator", icon: "newspaper", title: "Curator", hint: "Save 20 articles", value: saved.length, target: 20 },
    { id: "shelf", icon: "shelf", title: "Full shelf", hint: "Add 5 PDFs to your library", value: pdfs.length, target: 5 },
    { id: "pages", icon: "reading", title: "1,000 pages", hint: "Read 1,000 PDF pages", value: pagesRead, target: 1000 },
    { id: "deep", icon: "target", title: "Deep focus", hint: "Focus for 10 hours in total", value: focusMinutes, target: 600 },
    { id: "marathon", icon: "medal", title: "Marathon", hint: "One focus session of an hour", value: Math.floor(longestMin), target: 60 },
    { id: "streak", icon: "streak", title: "On a roll", hint: "Use Stack 7 days in a row", value: bestStreak, target: 7 },
    { id: "memory", icon: "brain", title: "Memory keeper", hint: "Keep a 5-day review streak", value: review, target: 5 },
    { id: "dj", icon: "mixer", title: "DJ", hint: "Make 3 playlists", value: playlists.length, target: 3 },
    {
      id: "owl",
      icon: timeOfDay === "early" ? "early-bird" : "night-owl",
      title: timeOfDay === "early" ? "Early bird" : "Night owl",
      hint: timeOfDay === "early" ? "Mostly shows up before 8 am" : "Mostly shows up after 10 pm",
      value: timeOfDay === "night" || timeOfDay === "early" ? 1 : 0,
      target: 1,
    },
  ];

  return {
    notes: notes.length,
    highlights,
    ideas,
    saved: saved.length,
    pdfs: pdfs.length,
    pagesRead,
    playlists: playlists.length,
    focusMinutes,
    todayMinutes: focus.todayMinutes,
    focusStreak: focus.streak,
    reviewStreak: review,
    activeStreak,
    bestStreak,
    heat,
    heatStart,
    badges,
    type: readerType({ highlights, ideas, saved: saved.length, pdfs: pdfs.length, pagesRead, focusMinutes }),
    timeOfDay,
  };
}

// Your "reader type": whatever you do most, weighted so different habits compare fairly.
function readerType(s: {
  highlights: number;
  ideas: number;
  saved: number;
  pdfs: number;
  pagesRead: number;
  focusMinutes: number;
}): ReaderType {
  const scores: [number, ReaderType][] = [
    [s.highlights, { icon: "highlighter", title: "The Highlighter", line: "You don't just read, you mark what matters." }],
    [s.ideas * 1.5, { icon: "idea", title: "The Idea Machine", line: "Your notes are full of your own thoughts." }],
    [s.saved, { icon: "newspaper", title: "The News Hound", line: "Always first to know, with a stack of saved stories." }],
    [s.pdfs * 2 + s.pagesRead / 40, { icon: "shelf", title: "The Bookworm", line: "Your shelf is your happy place." }],
    [s.focusMinutes / 15, { icon: "target", title: "The Deep Diver", line: "Long, quiet focus sessions are your thing." }],
  ];
  const [score, type] = scores.reduce((best, x) => (x[0] > best[0] ? x : best));
  return score >= 3 ? type : EMPTY_STATS.type;
}
