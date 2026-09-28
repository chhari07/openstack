"use client";

// Daily review: a few old highlights come back each day so they stick.
// Each highlight has a simple spaced schedule (Note.review): "Got it" pushes
// it out (3 days, then ~2.5× longer each time), "Again" brings it back
// tomorrow, "Stop" retires it. Today's picks are fixed for the day
// (localStorage), so the set doesn't change as you go.
import { getNotes, setReview, type Note } from "./db";

export const PER_DAY = 3;
const DAY = 86_400_000;

const startOfDay = (t = Date.now()) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const dayKey = (t = Date.now()) => new Date(t).toDateString();

type DaySet = { day: string; ids: string[]; done: string[] };
const SET_KEY = "stack.review.today";
const STREAK_KEY = "stack.review.streak";

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked */
  }
}

// Highlights that are due: never reviewed ones from before today, or whose
// next review date has come. Most overdue first.
export function dueHighlights(notes: Note[], now = Date.now()) {
  const today = startOfDay(now);
  return notes
    .filter((n) => n.quote && !n.review?.off && n.createdAt < today)
    .map((n) => ({ n, due: n.review?.due ?? n.createdAt + DAY }))
    .filter((x) => x.due <= now)
    .sort((a, b) => a.due - b.due)
    .map((x) => x.n);
}

// Today's review: picked once per day, then kept.
export async function todaysReview(): Promise<{ items: Note[]; done: string[] }> {
  const notes = await getNotes();
  let set = read<DaySet>(SET_KEY);
  if (set?.day !== dayKey()) {
    set = { day: dayKey(), ids: dueHighlights(notes).slice(0, PER_DAY).map((n) => n.id), done: [] };
    write(SET_KEY, set);
  }
  const byId = new Map(notes.map((n) => [n.id, n]));
  const items = set.ids.map((id) => byId.get(id)).filter((n): n is Note => !!n);
  return { items, done: set.done.filter((id) => byId.has(id)) };
}

export type Grade = "got" | "again" | "off";

export async function grade(note: Note, g: Grade) {
  const r = note.review ?? { due: 0, interval: 0, reps: 0 };
  const today = startOfDay();
  if (g === "got") {
    const interval = r.reps === 0 ? 3 : Math.min(365, Math.round(Math.max(r.interval, 1) * 2.5));
    await setReview(note.id, { due: today + interval * DAY, interval, reps: r.reps + 1 });
  } else if (g === "again") {
    await setReview(note.id, { due: today + DAY, interval: 1, reps: r.reps });
  } else {
    await setReview(note.id, { ...r, off: true });
  }

  const set = read<DaySet>(SET_KEY);
  if (set?.day === dayKey() && !set.done.includes(note.id)) {
    set.done.push(note.id);
    write(SET_KEY, set);
    if (set.ids.every((id) => set.done.includes(id))) bumpStreak();
  }
}

// Days in a row with the daily review finished.
function bumpStreak() {
  const s = read<{ last: string; count: number }>(STREAK_KEY);
  const today = dayKey();
  if (s?.last === today) return;
  const yesterday = dayKey(Date.now() - DAY);
  write(STREAK_KEY, { last: today, count: s?.last === yesterday ? s.count + 1 : 1 });
}

export function reviewStreak() {
  const s = read<{ last: string; count: number }>(STREAK_KEY);
  if (!s) return 0;
  // Still alive if the last finished review was today or yesterday.
  return s.last === dayKey() || s.last === dayKey(Date.now() - DAY) ? s.count : 0;
}

// For the morning digest: the highlight most likely to come up next.
export async function nextHighlight(): Promise<Note | null> {
  const notes = await getNotes();
  return dueHighlights(notes, Date.now() + DAY)[0] ?? null;
}
