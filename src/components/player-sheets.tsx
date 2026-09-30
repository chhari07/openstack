"use client";

import { useEffect, useState } from "react";
import { Chips, Sheet } from "./sheet";
import { useLocalMusic } from "./local-music-provider";
import { useToast } from "./toast";
import { CloseIcon, PlusIcon } from "./icons";
import { PlaylistIcon, QueueIcon } from "./stack-icons";
import { mmss } from "@/lib/format";
import type { LocalTrack, QueueItem } from "@/lib/local-music";

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function SpeedSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const player = useLocalMusic();
  const speed = player.state.speed || 1;
  return (
    <Sheet open={open} onClose={onClose} title="Playback speed">
      <Chips
        label="Playback speed"
        options={SPEEDS.map((v) => ({ value: String(v), label: `${v}×` }))}
        value={String(speed)}
        onChange={(v) => player.setSpeed(Number(v))}
      />
    </Sheet>
  );
}

const SLEEP = [5, 15, 30, 45, 60];

export function SleepSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const player = useLocalMusic();
  const s = player.state;
  const left = useCountdown(s.sleepAt);
  const set = (opts: { minutes?: number; endOfTrack?: boolean }) => {
    player.setSleep(opts);
    onClose();
  };
  const row = "flex h-12 items-center justify-between rounded-xl px-3 text-left text-[15px]";
  return (
    <Sheet open={open} onClose={onClose} title="Sleep timer">
      {(left > 0 || s.sleepEndOfTrack) && (
        <p className="label text-[10px] text-music-text">
          {s.sleepEndOfTrack ? "Stops when this song ends" : `Stops in ${mmss(left)}`}
        </p>
      )}
      <div className="flex flex-col">
        {SLEEP.map((m) => (
          <button key={m} onClick={() => set({ minutes: m })} className={row}>
            {m < 60 ? `${m} minutes` : "1 hour"}
          </button>
        ))}
        <button onClick={() => set({ endOfTrack: true })} className={`${row} ${s.sleepEndOfTrack ? "text-music-text" : ""}`}>
          End of this song
        </button>
        {(left > 0 || s.sleepEndOfTrack) && (
          <button onClick={() => set({})} className={`${row} text-music-text`}>
            Turn off timer
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function QueueSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const player = useLocalMusic();
  const s = player.state;
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const { queue } = player;

  // Reload whenever the sheet opens or the queue changes underneath it.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    queue().then((q) => alive && setItems(q));
    return () => {
      alive = false;
    };
  }, [open, s.uri, s.count, s.shuffle]); // eslint-disable-line react-hooks/exhaustive-deps

  const [now, ...next] = items ?? [];
  return (
    <Sheet open={open} onClose={onClose} title="Up next">
      <div className="-mx-5 max-h-[60vh] overflow-y-auto px-5">
        {now && (
          <>
            <p className="label text-[10px] text-music-text">Now playing</p>
            <Row item={now} current />
          </>
        )}
        {next.length > 0 ? (
          <>
            <p className="label mt-3 text-[10px] text-muted">
              {s.shuffle ? "Next (shuffled)" : "Next"} · {next.length}
            </p>
            <ol>
              {next.map((q) => (
                <li key={`${q.index}-${q.uri}`} className="flex items-center">
                  <Row item={q} onPlay={() => player.jump(q.index)} />
                  <button
                    aria-label={`Remove ${q.title} from the queue`}
                    onClick={() => player.removeFromQueue(q.index)}
                    className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted"
                  >
                    <CloseIcon size={16} />
                  </button>
                </li>
              ))}
            </ol>
          </>
        ) : (
          items && (
            <p className="mt-3 text-[14px] text-muted">
              {s.repeat === "all" ? "The queue starts over after this song." : "Nothing after this song."}
            </p>
          )
        )}
      </div>
    </Sheet>
  );
}

function Row({ item, current, onPlay }: { item: QueueItem; current?: boolean; onPlay?: () => void }) {
  return (
    <button onClick={onPlay} disabled={!onPlay} className="flex h-14 min-w-0 grow flex-col justify-center text-left">
      <span className={`song truncate text-[15px] ${current ? "text-music-text" : ""}`}>{item.title || "Unknown track"}</span>
      <span className="label truncate text-[9px] text-muted">{item.artist}</span>
    </button>
  );
}

// Per-song menu in the song list: play next, add to queue, add to playlist.
export function SongActionsSheet({
  song,
  onClose,
  onAddToPlaylist,
}: {
  song: LocalTrack | null;
  onClose: () => void;
  onAddToPlaylist: (t: LocalTrack) => void;
}) {
  const player = useLocalMusic();
  const toast = useToast();
  const row = "flex h-12 items-center gap-3 rounded-xl px-1 text-left text-[15px]";
  const queue = async (next: boolean) => {
    if (!song) return;
    await player.enqueue(song, next);
    toast({ text: next ? `“${song.title}” plays next` : `Added “${song.title}” to the queue` });
    onClose();
  };
  return (
    <Sheet open={song !== null} onClose={onClose} title={song?.title ?? ""}>
      <div className="flex flex-col">
        <button onClick={() => queue(true)} className={row}>
          <QueueIcon size={20} /> Play next
        </button>
        <button onClick={() => queue(false)} className={row}>
          <PlusIcon size={20} /> Add to queue
        </button>
        <button
          onClick={() => {
            if (song) onAddToPlaylist(song);
            onClose();
          }}
          className={row}
        >
          <PlaylistIcon size={20} /> Add to a playlist
        </button>
      </div>
    </Sheet>
  );
}

/** Milliseconds until `at` (epoch ms), ticking every second; 0 when unset or past. */
export function useCountdown(at?: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!at) return;
    setNow(Date.now()); // eslint-disable-line react-hooks/set-state-in-effect
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [at]);
  return at ? Math.max(0, at - now) : 0;
}
