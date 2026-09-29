"use client";

// Focus sessions: a timer tied to one PDF or article, with music and notes.
// The running session lives in localStorage (read synchronously, survives
// page changes and app restarts); finished sessions go to IndexedDB for stats.
import { get, update } from "idb-keyval";
import { track } from "./sync-state";

export type FocusTarget = {
  kind: "pdf" | "article" | "none";
  id?: string;
  title: string;
  href?: string; // where "Open" takes you
};

export type FocusSession = {
  id: string;
  target: FocusTarget;
  minutes: number; // planned length
  music: boolean;
  startedAt: number;
  pausedAt?: number; // set while paused
  pausedMs: number; // total time spent paused
  endedAt?: number; // set when finished (time up or ended early)
  startPage?: number; // PDF page when the session began
  pomo?: Pomodoro; // set when this session is part of a Pomodoro cycle
};

// Pomodoro: ROUNDS focus rounds with short breaks between them and a long
// break after the last. Breaks are sessions too, but aren't counted as focus.
export type Pomodoro = { round: number; brk?: boolean; music?: boolean }; // music: play it again after a break
export const POMO = { rounds: 4, focus: 25, short: 5, long: 15 };
export const breakMinutes = (round: number) => (round >= POMO.rounds ? POMO.long : POMO.short);

export type FocusRecord = {
  id: string;
  title: string;
  kind: FocusTarget["kind"];
  startedAt: number;
  focusedMs: number;
  pages: number;
  notes: number;
  highlights: number;
};

const KEY = "stack.focus";

export function loadSession(): FocusSession | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

export function saveSession(s: FocusSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the session just won't survive a restart */
  }
}

// Time spent focusing so far (pauses don't count).
export function focusedMs(s: FocusSession, now = Date.now()) {
  const end = s.endedAt ?? s.pausedAt ?? now;
  return Math.max(0, end - s.startedAt - s.pausedMs);
}

export const remainingMs = (s: FocusSession, now = Date.now()) =>
  Math.max(0, s.minutes * 60_000 - focusedMs(s, now));

export function clockText(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  return `${m}:${String(total % 60).padStart(2, "0")}`;
}

// ---- History ----
export async function getHistory(): Promise<FocusRecord[]> {
  const all = (await get<FocusRecord[]>("focus")) ?? [];
  return all.sort((a, b) => b.startedAt - a.startedAt);
}

export async function addRecord(r: FocusRecord) {
  await update<FocusRecord[]>("focus", (all) => [
    ...(all ?? []).filter((x) => x.id !== r.id),
    r,
  ]);
  await track("focus", r.id);
}

const dayKey = (t: number) => new Date(t).toDateString();

// Minutes focused today, and how many days in a row (ending today or
// yesterday) had at least one session.
export function stats(history: FocusRecord[], now = Date.now()) {
  const today = dayKey(now);
  const todayMs = history
    .filter((r) => dayKey(r.startedAt) === today)
    .reduce((sum, r) => sum + r.focusedMs, 0);
  const days = new Set(history.map((r) => dayKey(r.startedAt)));
  let streak = 0;
  const d = new Date(now);
  if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d.getTime()))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return { todayMinutes: Math.round(todayMs / 60_000), streak, sessions: history.length };
}
