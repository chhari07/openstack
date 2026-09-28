"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isNative } from "@/lib/platform";
import { AppSettings } from "@/lib/app-settings";
import {
  APP_REDIRECT,
  finishLogin,
  accessToken,
  api,
  disconnect as clearTokens,
  isConnected,
  SpotifyError,
  spotifyConfigured,
  builtInConfigured,
  onClientIdChange,
  type SpPlayer,
} from "@/lib/spotify";

type WebPlayer = {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: (arg: { device_id?: string; message?: string }) => void): void;
};

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (t: string) => void) => void;
        volume?: number;
      }) => WebPlayer;
    };
  }
}

type Ctx = {
  configured: boolean;
  connected: boolean;
  player: SpPlayer | null;
  progress: number; // ms, ticks locally between polls
  error: string | null;
  browserDeviceId: string | null;
  refresh: () => Promise<void>;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  cycleRepeat: () => Promise<void>; // off → whole playlist → this song → off
  playContext: (uri: string, offsetUri?: string) => Promise<void>;
  playUris: (uris: string[], offset?: number) => Promise<void>;
  disconnect: () => void;
  status: string | null; // e.g. "Opening Spotify…" while Stack wakes up a device
};

const SpotifyCtx = createContext<Ctx | null>(null);

export function useSpotify() {
  const ctx = useContext(SpotifyCtx);
  if (!ctx) throw new Error("useSpotify must be inside SpotifyProvider");
  return ctx;
}

const noDevice = (e: unknown) =>
  e instanceof SpotifyError && (e.reason === "NO_ACTIVE_DEVICE" || e.status === 404);

function explain(e: unknown) {
  if (e instanceof SpotifyError) {
    if (e.reason === "NO_SPOTIFY_APP")
      return "The Spotify app isn’t installed on this phone. Install it to play from Stack, or use “Open in Spotify”.";
    if (e.reason === "PREMIUM_REQUIRED" || e.status === 403)
      return "Playing and skipping from Stack needs Spotify Premium. “Open in Spotify” works on free accounts.";
    if (noDevice(e))
      return isNative()
        ? "Spotify isn’t running. Open the Spotify app, play any song for a second, then come back and tap play again."
        : "No active device. Open Spotify on your phone or computer, or play once in this browser.";
    return e.message;
  }
  return "Something went wrong with Spotify.";
}

type Device = { id: string | null; is_active: boolean; is_restricted: boolean; type: string; name: string };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function SpotifyProvider({ children }: { children: ReactNode }) {
  // Built-in ID during the static build; the runtime one (Settings) in the browser.
  const configured = useSyncExternalStore(onClientIdChange, spotifyConfigured, builtInConfigured);
  const [connected, setConnected] = useState(false);
  const [player, setPlayer] = useState<SpPlayer | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [browserDeviceId, setBrowserDeviceId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const sdkRef = useRef<WebPlayer | null>(null);
  // A play request waiting for Spotify to come online (retried when Stack is reopened).
  const pending = useRef<(() => Promise<boolean>) | null>(null);

  useEffect(() => {
    // Read localStorage after mount so the server render matches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnected(configured && isConnected());
  }, [configured]);

  // Android: Spotify's login page sends the user back via com.chhari.stack://callback.
  useEffect(() => {
    if (!isNative()) return;
    const sub = App.addListener("appUrlOpen", async ({ url }) => {
      if (!url.startsWith(APP_REDIRECT)) return;
      Browser.close().catch(() => {});
      const code = new URL(url).searchParams.get("code");
      if (!code) return setError("Spotify login was cancelled.");
      try {
        await finishLogin(code);
        setConnected(true);
      } catch (e) {
        setError((e as Error).message);
      }
    });
    return () => {
      sub.then((s) => s.remove());
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!isConnected()) return;
    try {
      const p = await api<SpPlayer>("/me/player");
      setPlayer(p);
      setProgress(p?.progress_ms ?? 0);
    } catch (e) {
      if (e instanceof SpotifyError && e.status === 401) setConnected(false);
    }
  }, []);

  // Poll the player every 5s while the tab is visible.
  useEffect(() => {
    if (!connected) return;
    // refresh() only sets state after the network call resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [connected, refresh]);

  // Smooth progress bar between polls.
  useEffect(() => {
    if (!player?.is_playing) return;
    const id = setInterval(() => setProgress((p) => p + 1000), 1000);
    return () => clearInterval(id);
  }, [player?.is_playing, player?.item?.id]);

  // The Web Playback SDK turns this browser tab into a Spotify device
  // (Premium only). Loaded once after connecting.
  useEffect(() => {
    // Android WebView can't play DRM audio, so the app only remote-controls
    // Spotify on the phone instead.
    if (!connected || sdkRef.current || isNative()) return;
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (!window.Spotify) return;
      const sdk = new window.Spotify.Player({
        name: "Stack",
        getOAuthToken: (cb) => accessToken().then((t) => t && cb(t)),
        volume: 0.7,
      });
      sdk.addListener("ready", ({ device_id }) => setBrowserDeviceId(device_id ?? null));
      sdk.addListener("not_ready", () => setBrowserDeviceId(null));
      sdk.addListener("player_state_changed", () => refresh());
      sdk.connect();
      sdkRef.current = sdk;
    };
    const s = document.createElement("script");
    s.src = "https://sdk.scdn.co/spotify-player.js";
    s.async = true;
    document.body.appendChild(s);
    return () => {
      sdkRef.current?.disconnect();
      sdkRef.current = null;
    };
  }, [connected, refresh]);

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null);
      setStatus(null);
      try {
        await fn();
      } catch (e) {
        setError(explain(e));
      }
      setTimeout(refresh, 400);
    },
    [refresh],
  );

  // If nothing is playing anywhere, fall back to this browser tab.
  const deviceQuery = useCallback(
    () => (!player?.device?.id && browserDeviceId ? `?device_id=${browserDeviceId}` : ""),
    [player, browserDeviceId],
  );

  // Any Spotify Connect device we can play on: the active one, else this
  // phone, else the first one available (PC, speaker…).
  const findDevice = useCallback(async () => {
    const d = await api<{ devices: Device[] }>("/me/player/devices").catch(() => null);
    const list = (d?.devices ?? []).filter((x) => x.id && !x.is_restricted);
    return (list.find((x) => x.is_active) ?? list.find((x) => x.type === "Smartphone") ?? list[0])?.id ?? null;
  }, []);

  // Starts playback, finding (or on the phone, waking up) a device when
  // Spotify says there's none active.
  const startPlayback = useCallback(
    async (body?: object, openUri?: string) => {
      const send = (q: string) =>
        api(`/me/player/play${q}`, { method: "PUT", body: body ? JSON.stringify(body) : undefined });
      pending.current = null;
      try {
        await send(deviceQuery());
        return;
      } catch (e) {
        if (!noDevice(e)) throw e;
      }
      const found = await findDevice();
      if (found) return void (await send(`?device_id=${found}`));
      if (!isNative()) throw new SpotifyError(404, "NO_ACTIVE_DEVICE", "No active device");

      // Wake the Spotify app up; it registers as a device within a few seconds.
      const { opened } = await AppSettings.openSpotify({ uri: openUri });
      if (!opened) throw new SpotifyError(404, "NO_SPOTIFY_APP", "Spotify not installed");
      setStatus("Opening Spotify… your music will start in a moment. Come back to Stack any time.");
      const attempt = async () => {
        const id = await findDevice();
        if (!id) return false;
        await send(`?device_id=${id}`);
        setStatus(null);
        pending.current = null;
        setTimeout(refresh, 600);
        return true;
      };
      pending.current = attempt;
      for (let i = 0; i < 10; i++) {
        await sleep(1500);
        if (pending.current !== attempt) return;
        if (await attempt().catch(() => false)) return;
      }
      setStatus("Spotify is open but not ready yet. Press play in Spotify once, then come back: Stack will take over.");
    },
    [deviceQuery, findDevice, refresh],
  );

  // Back in Stack after opening Spotify: finish the play request.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !pending.current) return;
      pending.current().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const toggle = useCallback(
    () =>
      run(async () => {
        if (player?.is_playing) await api("/me/player/pause", { method: "PUT" });
        else await startPlayback(undefined, player?.context?.uri);
        setPlayer((p) => (p ? { ...p, is_playing: !p.is_playing } : p));
      }),
    [run, player, startPlayback],
  );

  const next = useCallback(() => run(() => api("/me/player/next", { method: "POST" })), [run]);
  const previous = useCallback(
    () => run(() => api("/me/player/previous", { method: "POST" })),
    [run],
  );

  const cycleRepeat = useCallback(() => {
    const cur = player?.repeat_state ?? "off";
    const nextState = cur === "off" ? "context" : cur === "context" ? "track" : "off";
    return run(async () => {
      await api(`/me/player/repeat?state=${nextState}`, { method: "PUT" });
      setPlayer((p) => (p ? { ...p, repeat_state: nextState } : p));
    });
  }, [run, player]);

  const playContext = useCallback(
    (uri: string, offsetUri?: string) =>
      run(() =>
        startPlayback({ context_uri: uri, ...(offsetUri ? { offset: { uri: offsetUri } } : {}) }, uri),
      ),
    [run, startPlayback],
  );

  // For lists with no playable context, like Liked Songs.
  const playUris = useCallback(
    (uris: string[], offset = 0) =>
      run(() => startPlayback({ uris: uris.slice(0, 100), offset: { position: offset } }, "spotify:collection:tracks")),
    [run, startPlayback],
  );

  const disconnect = useCallback(() => {
    sdkRef.current?.disconnect();
    sdkRef.current = null;
    clearTokens();
    setConnected(false);
    setPlayer(null);
  }, []);

  return (
    <SpotifyCtx.Provider
      value={{
        configured,
        connected,
        player,
        progress,
        error,
        browserDeviceId,
        refresh,
        toggle,
        next,
        previous,
        cycleRepeat,
        playContext,
        playUris,
        disconnect,
        status,
      }}
    >
      {children}
    </SpotifyCtx.Provider>
  );
}
