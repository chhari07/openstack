"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { getNotes, getPdfs, uid } from "@/lib/db";
import {
  addRecord,
  clockText,
  focusedMs,
  loadSession,
  remainingMs,
  saveSession,
  type FocusSession,
  type FocusTarget,
  type Pomodoro,
} from "@/lib/focus";
import { isNative } from "@/lib/platform";
import { askForNotifications, notificationsAllowed } from "@/lib/reminders";
import { useNowPlaying } from "./now-playing";
import { useToast } from "./toast";

const NOTIFY_ID = 1002;

type Ctx = {
  session: FocusSession | null;
  start: (target: FocusTarget, minutes: number, music: boolean, pomo?: Pomodoro) => Promise<void>;
  pause: () => void;
  resume: () => void;
  finish: () => Promise<void>;
  clear: () => void;
};

const FocusCtx = createContext<Ctx | null>(null);

export function useFocus() {
  const ctx = useContext(FocusCtx);
  if (!ctx) throw new Error("useFocus outside FocusProvider");
  return ctx;
}

// Re-renders every second while `on`, for countdowns.
export function useTick(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

// "Time's up" notification, for when Stack is in the background.
async function scheduleEnd(s: FocusSession | null) {
  if (!isNative()) return;
  await LocalNotifications.cancel({ notifications: [{ id: NOTIFY_ID }] }).catch(() => {});
  if (!s || s.endedAt || s.pausedAt || !(await notificationsAllowed())) return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: NOTIFY_ID,
        title: s.pomo?.brk ? "Break’s over" : s.pomo ? `Round ${s.pomo.round} done` : "Focus session complete",
        body: s.pomo?.brk
          ? "Ready for the next round?"
          : s.pomo
            ? "Time for a break. Stretch, drink some water."
            : `${s.minutes} minutes on ${s.target.title}. See what you got done.`,
        schedule: { at: new Date(Date.now() + remainingMs(s)), allowWhileIdle: true },
        // Never ask for the exact-alarm permission; Android may deliver it a little late.
        isExactNotification: false,
        extra: { href: "/focus" },
      },
    ],
  }).catch(() => {});
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<FocusSession | null>(null);
  const toast = useToast();
  const now = useNowPlaying();
  const nowRef = useRef(now);
  const sessionRef = useRef(session);
  const finishing = useRef<string | null>(null); // id of the session being ended

  useEffect(() => {
    nowRef.current = now;
    sessionRef.current = session;
  });

  // Pick up a session that was running before the app was closed.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(loadSession());
  }, []);

  const commit = useCallback((s: FocusSession | null) => {
    saveSession(s);
    setSession(s);
    scheduleEnd(s);
  }, []);

  const music = (play: boolean) => {
    const n = nowRef.current;
    if (n && n.playing !== play) n.toggle();
  };

  const start = useCallback(
    async (target: FocusTarget, minutes: number, withMusic: boolean, pomo?: Pomodoro) => {
      let startPage: number | undefined;
      if (target.kind === "pdf") {
        startPage = (await getPdfs()).find((p) => p.id === target.id)?.lastPage;
      }
      if (isNative() && !(await notificationsAllowed())) await askForNotifications().catch(() => {});
      commit({
        id: uid(),
        target,
        minutes,
        music: withMusic,
        startedAt: Date.now(),
        pausedMs: 0,
        startPage,
        pomo,
      });
      if (withMusic) music(true);
    },
    [commit],
  );

  const pause = useCallback(() => {
    const s = sessionRef.current;
    if (!s || s.pausedAt || s.endedAt) return;
    commit({ ...s, pausedAt: Date.now() });
    if (s.music) music(false);
  }, [commit]);

  const resume = useCallback(() => {
    const s = sessionRef.current;
    if (!s?.pausedAt || s.endedAt) return;
    commit({ ...s, pausedMs: s.pausedMs + (Date.now() - s.pausedAt), pausedAt: undefined });
    if (s.music) music(true);
  }, [commit]);

  // Ends the session (time up or early) and records it for stats.
  const finish = useCallback(async () => {
    const s = sessionRef.current;
    // The timer and the End button can both get here; end each session once.
    if (!s || s.endedAt || finishing.current === s.id) return;
    finishing.current = s.id;
    const t = Date.now();
    // Ends at the pause if paused; if the app slept past the end, at the
    // moment time ran out, so a session never counts more than planned.
    const over = Math.max(0, focusedMs(s, t) - s.minutes * 60_000);
    const ended: FocusSession = { ...s, endedAt: s.pausedAt ?? t - over, pausedAt: undefined };
    if (s.music) music(false);
    // A Pomodoro break isn't focus time: nothing to record.
    if (s.pomo?.brk) {
      commit(ended);
      return;
    }
    const [notes, pdfs] = await Promise.all([getNotes(), getPdfs()]);
    const during = notes.filter((n) => n.createdAt >= s.startedAt && n.createdAt <= t);
    const endPage = pdfs.find((p) => p.id === s.target.id)?.lastPage;
    await addRecord({
      id: s.id,
      title: s.target.title,
      kind: s.target.kind,
      startedAt: s.startedAt,
      focusedMs: focusedMs(ended),
      pages: s.startPage && endPage ? Math.max(0, endPage - s.startPage) : 0,
      notes: during.filter((n) => !n.quote).length,
      highlights: during.filter((n) => n.quote).length,
    });
    // Show the summary only once the record is stored, so stats include it.
    commit(ended);
  }, [commit]);

  const clear = useCallback(() => commit(null), [commit]);

  // Time's up: finish, buzz, and point to the summary.
  const running = !!session && !session.endedAt && !session.pausedAt;
  const tick = useTick(running);
  useEffect(() => {
    if (!running || !session || remainingMs(session, tick) > 0) return;
    finish().then(() => {
      navigator.vibrate?.([200, 100, 200]);
      // On the focus screen the summary is already showing.
      if (!window.location.pathname.startsWith("/focus"))
        toast({
          text: session.pomo?.brk ? "Break’s over" : session.pomo ? `Round ${session.pomo.round} done: take a break` : "Focus session complete",
          href: "/focus",
          action: session.pomo ? "Open" : "Summary",
        });
    });
  }, [running, session, tick, finish, toast]);

  return (
    <FocusCtx.Provider value={{ session, start, pause, resume, finish, clear }}>
      {children}
      <FocusPill session={session} />
    </FocusCtx.Provider>
  );
}

// Small live timer on other screens while a session runs.
function FocusPill({ session }: { session: FocusSession | null }) {
  const path = usePathname();
  const tick = useTick(!!session && !session.endedAt && !session.pausedAt);
  // Only while a session runs; the focus screen and PDF reader show the timer
  // themselves, and a finished session is on Today's focus card.
  if (!session || session.endedAt || path.startsWith("/focus") || path.startsWith("/library/read")) return null;
  return (
    <Link
      href="/focus"
      aria-label="Focus session in progress"
      className="fixed top-[calc(env(safe-area-inset-top)+64px)] right-3 z-40 flex h-9 items-center gap-2 rounded-full bg-ink px-3.5 text-on-ink shadow-[0_6px_18px_rgba(0,0,0,.22)] md:right-6"
    >
      <span className={`size-2 rounded-full ${session.pausedAt ? "bg-pdf" : session.pomo?.brk ? "animate-pulse bg-news" : "animate-pulse bg-music"}`} />
      <span className="text-[14px] font-semibold tabular-nums">{clockText(remainingMs(session, tick))}</span>
      {session.pausedAt ? (
        <span className="label text-[9px] opacity-70">Paused</span>
      ) : (
        session.pomo && <span className="label text-[9px] opacity-70">{session.pomo.brk ? "Break" : `Round ${session.pomo.round}`}</span>
      )}
    </Link>
  );
}
