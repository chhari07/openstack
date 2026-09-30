"use client";

import { Capacitor } from "@capacitor/core";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isNative } from "@/lib/platform";
import { LocalMusic, type LocalState, type LocalTrack, type QueueItem } from "@/lib/local-music";

type Ctx = {
  available: boolean; // Android app only
  state: LocalState;
  art: string | null; // artwork of the current track, as a WebView URL
  play: (tracks: LocalTrack[], index: number) => Promise<void>;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  setShuffle: (on: boolean) => Promise<void>;
  cycleRepeat: () => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  setSleep: (opts: { minutes?: number; endOfTrack?: boolean }) => Promise<void>;
  queue: () => Promise<QueueItem[]>;
  jump: (index: number) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  enqueue: (track: LocalTrack, next: boolean) => Promise<void>;
};

const LocalCtx = createContext<Ctx | null>(null);

export function useLocalMusic() {
  const ctx = useContext(LocalCtx);
  if (!ctx) throw new Error("useLocalMusic must be inside LocalMusicProvider");
  return ctx;
}

// Artwork per track, cached for the session.
const artCache = new Map<string, string | null>();
export async function trackArt(uri: string) {
  if (artCache.has(uri)) return artCache.get(uri)!;
  const { path } = await LocalMusic.artwork({ uri }).catch(() => ({ path: undefined }));
  const url = path ? Capacitor.convertFileSrc(path) : null;
  artCache.set(uri, url);
  return url;
}

export function LocalMusicProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState(false);
  const [state, setState] = useState<LocalState>({});
  const [art, setArt] = useState<string | null>(null);
  const tick = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!isNative()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvailable(true);
    LocalMusic.getState().then(setState).catch(() => {});
    const sub = LocalMusic.addListener("state", setState);
    return () => {
      sub.then((s) => s.remove());
    };
  }, []);

  // The player only reports changes, so advance the position locally while playing.
  useEffect(() => {
    clearInterval(tick.current);
    if (!state.playing) return;
    const step = 1000 * (state.speed || 1);
    tick.current = setInterval(() => {
      setState((s) => ({ ...s, position: Math.min((s.position ?? 0) + step, s.duration || Infinity) }));
    }, 1000);
    return () => clearInterval(tick.current);
  }, [state.playing, state.uri, state.speed]);

  // Resync when the app comes back from the background.
  useEffect(() => {
    if (!available) return;
    const onVisible = () => document.visibilityState === "visible" && LocalMusic.getState().then(setState).catch(() => {});
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [available]);

  useEffect(() => {
    if (!state.uri) return;
    let alive = true;
    trackArt(state.uri).then((a) => alive && setArt(a));
    return () => {
      alive = false;
    };
  }, [state.uri]);

  const run = useCallback(async (p: Promise<LocalState>) => {
    try {
      setState(await p);
    } catch {
      /* the listener will catch up */
    }
  }, []);

  const value: Ctx = {
    available,
    state,
    art: state.uri ? art : null,
    play: (tracks, index) => run(LocalMusic.play({ tracks, index })),
    toggle: () => run(LocalMusic.toggle()),
    next: () => run(LocalMusic.next()),
    previous: () => run(LocalMusic.previous()),
    seek: (ms) => run(LocalMusic.seek({ position: ms })),
    setShuffle: (on) => run(LocalMusic.setShuffle({ on })),
    cycleRepeat: () =>
      run(LocalMusic.setRepeat({ mode: state.repeat === "off" || !state.repeat ? "all" : state.repeat === "all" ? "one" : "off" })),
    setSpeed: (speed) => run(LocalMusic.setSpeed({ speed })),
    setSleep: (opts) => run(LocalMusic.setSleepTimer(opts)),
    queue: () => LocalMusic.queue().then((r) => r.items).catch(() => []),
    jump: (index) => run(LocalMusic.jump({ index })),
    removeFromQueue: (index) => run(LocalMusic.removeFromQueue({ index })),
    enqueue: (track, next) => run(LocalMusic.enqueue({ track, next })),
  };

  return <LocalCtx.Provider value={value}>{children}</LocalCtx.Provider>;
}
