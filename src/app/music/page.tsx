"use client";

import { useEffect, useState } from "react";
import { TabBar } from "@/components/tab-bar";
import { Logo } from "@/components/logo";
import { MiniPlayer } from "@/components/mini-player";
import { LocalView } from "@/components/local-view";
import { SpotifyView } from "@/components/spotify-view";
import { useLocalMusic } from "@/components/local-music-provider";

type Source = "phone" | "spotify";
const SOURCE_KEY = "stack.music-source";

export default function Music() {
  const local = useLocalMusic();
  const [source, setSourceState] = useState<Source>("spotify");

  // The app opens on phone music unless you last used Spotify.
  useEffect(() => {
    if (!local.available) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(SOURCE_KEY);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSourceState(saved === "spotify" ? "spotify" : "phone");
  }, [local.available]);

  const setSource = (s: Source) => {
    setSourceState(s);
    try {
      localStorage.setItem(SOURCE_KEY, s);
    } catch {}
  };

  return (
    <main className="overflow-x-hidden px-5 pt-5 pb-[180px] md:px-10 md:pt-8 md:pb-28">
      <div className="flex h-8 items-center justify-between">
        <Logo size={26} className="-ml-1 md:invisible" />
        {local.available ? (
          <div role="tablist" aria-label="Music source" className="flex rounded-full border border-ink/15 p-0.5">
            {(["phone", "spotify"] as Source[]).map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={source === s}
                onClick={() => setSource(s)}
                className={`label h-7 rounded-full px-3 text-[10px] ${source === s ? "bg-ink text-on-ink" : ""}`}
              >
                {s === "phone" ? "On phone" : "Spotify"}
              </button>
            ))}
          </div>
        ) : (
          <span className="label text-[10px] text-muted">Spotify</span>
        )}
      </div>

      {local.available && source === "phone" ? <LocalView /> : <SpotifyView />}

      <MiniPlayer showTime />
      <TabBar />
    </main>
  );
}
