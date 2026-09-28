"use client";

import Link from "next/link";
import { mmss } from "@/lib/format";
import { useSpotify } from "./spotify-provider";
import { useLocalMusic } from "./local-music-provider";
import { useNowPlaying } from "./now-playing";
import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from "./icons";

// Floating now-playing bar that sits above the tab bar.
export function MiniPlayer({ showTime = false }: { showTime?: boolean }) {
  const sp = useSpotify();
  const local = useLocalMusic();
  const now = useNowPlaying();

  const shell =
    "fixed inset-x-3 bottom-[var(--above-tabs)] z-30 mx-auto flex h-[62px] max-w-[456px] md:left-auto md:right-6 md:mx-0 md:w-[420px] items-center gap-3 overflow-hidden rounded-[14px] bg-card px-2.5 shadow-[0_8px_24px_rgba(0,0,0,.08)]";

  if (!now) {
    return (
      <Link href="/music" className={shell}>
        <span className="flex size-[42px] shrink-0 items-center justify-center rounded-md bg-music text-white">
          <PlayIcon />
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="label text-[12px] font-medium">
            {local.available ? "Play music" : sp.connected ? "Nothing playing" : "Connect Spotify"}
          </span>
          <span className="label truncate text-[10px] text-muted">
            {local.available ? "From your phone or Spotify" : "Your music, next to your reading"}
          </span>
        </span>
      </Link>
    );
  }

  const pct = now.duration ? Math.min(100, (now.position / now.duration) * 100) : 0;

  return (
    <div className={shell}>
      <div className="absolute top-0 left-0 h-0.5 bg-music" style={{ width: `${pct}%` }} />
      <Link href="/music" className="size-[42px] shrink-0 overflow-hidden rounded-md bg-music">
        {now.art && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={now.art} alt="" className="size-full object-cover" />
        )}
      </Link>
      <Link href="/music" className="flex min-w-0 grow flex-col gap-[3px]">
        <span className="song truncate text-[14px]">{now.title}</span>
        <span className="label truncate text-[10px] text-muted">
          {now.artist}
          {showTime ? ` · ${mmss(now.position)} / ${mmss(now.duration)}` : ` · ${now.device}`}
        </span>
      </Link>
      <button aria-label="Previous track" onClick={now.previous} className="flex h-11 w-8 items-center justify-center">
        <PrevIcon />
      </button>
      <button
        aria-label={now.playing ? "Pause" : "Play"}
        onClick={now.toggle}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-music text-white"
      >
        {now.playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button aria-label="Next track" onClick={now.next} className="flex h-11 w-8 items-center justify-center">
        <NextIcon />
      </button>
    </div>
  );
}
