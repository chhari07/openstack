"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocalMusic } from "./local-music-provider";
import {
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  SearchIcon,
  ShuffleIcon,
} from "./icons";
import { SWATCHES } from "./spotify-view";
import { AddToPlaylistSheet, PlaylistsRail } from "./playlist-parts";
import { mmss, plural } from "@/lib/format";
import { LocalMusic, type LocalTrack } from "@/lib/local-music";
import { PhoneFiles } from "@/lib/phone-files";
import { PLAY_BUILD } from "@/lib/platform";
import { MoreVerticalIcon, QueueIcon, TimerIcon } from "./stack-icons";
import { Vinyl } from "./vinyl";
import { QueueSheet, SleepSheet, SongActionsSheet, SpeedSheet, useCountdown } from "./player-sheets";

type Sort = "title" | "artist" | "recent";

// Music stored on the phone, played by the native background player.
export function LocalView() {
  const player = useLocalMusic();
  const s = player.state;
  const [permission, setPermission] = useState<string | null>(null);
  const [tracks, setTracks] = useState<LocalTrack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("title");
  const [limit, setLimit] = useState(60);
  // Songs waiting to go into a playlist (sheet open), and "new playlist" mode.
  const [adding, setAdding] = useState<LocalTrack[] | null>(null);
  const [newOnly, setNewOnly] = useState(false);
  const [menuFor, setMenuFor] = useState<LocalTrack | null>(null);
  const [sheet, setSheet] = useState<"speed" | "sleep" | "queue" | null>(null);
  const sleepLeft = useCountdown(s.sleepAt);

  const load = useCallback(async () => {
    try {
      const { tracks } = await LocalMusic.listTracks();
      setTracks(tracks);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const check = useCallback(
    () =>
      LocalMusic.checkAudio()
        .then(({ audio }) => {
          setPermission(audio);
          if (audio === "granted") load();
        })
        .catch(() => setPermission("denied")),
    [load],
  );

  useEffect(() => {
    check();
    // Back from Android's "All files access" screen: look again.
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [check]);

  const ask = async () => {
    const { audio } = await LocalMusic.requestAudio();
    setPermission(audio);
    if (audio === "granted") load();
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (tracks ?? []).filter(
      (t) =>
        !q ||
        [t.title, t.artist, t.album].some((x) => x.toLowerCase().includes(q)),
    );
    if (sort === "artist")
      list.sort(
        (a, b) =>
          a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title),
      );
    if (sort === "recent") list.sort((a, b) => b.added - a.added);
    return list;
  }, [tracks, query, sort]);

  const word =
    (s.title ?? "").split(/\s+/)[0]?.toUpperCase().slice(0, 9) || "LOCAL";
  const pct = s.duration
    ? Math.min(100, ((s.position ?? 0) / s.duration) * 100)
    : 0;

  return (
    <div className="md:grid md:grid-cols-2 md:items-start md:gap-12">
      {/* Tablets: player on the left, song list on the right */}
      <div>
        <h1 className="display -ml-3 mt-3 whitespace-nowrap text-[clamp(96px,35vw,160px)] tracking-[-0.045em]">
          {word}
        </h1>
        <div className="mt-2.5 flex justify-between">
          <span className="label truncate text-[10px]">
            {s.artist || "Music on this phone"}
          </span>
          <span className="label text-[10px]">
            {tracks ? plural(tracks.length, "song") : ""}
          </span>
        </div>

        {permission && permission !== "granted" && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-card p-5">
            <p className="label text-[11px] font-medium text-music-text">
              Music on your phone
            </p>
            <p className="text-[14px] leading-relaxed">
              Stack can play the songs stored on this phone, with controls in
              the notification and on the lock screen.
              {!PLAY_BUILD && (
                <>
                  <b> All files access</b> lets it find your music and every
                  PDF; Android shows a switch for Stack.
                </>
              )}
            </p>
            {PLAY_BUILD ? (
              <button
                onClick={ask}
                className="h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink"
              >
                Allow music
              </button>
            ) : (
              <>
                <button
                  onClick={() => PhoneFiles.requestAllFiles().catch(() => {})}
                  className="h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink"
                >
                  Allow access to all files
                </button>
                <button
                  onClick={ask}
                  className="h-11 rounded-full border border-ink/15 text-[14px] font-semibold"
                >
                  Music only
                </button>
              </>
            )}
            {permission === "denied" && (
              <p className="text-[12px] text-muted">
                If nothing happens, Android has blocked the prompt: open
                Settings → Access in Stack to allow it.
              </p>
            )}
          </div>
        )}

        {s.uri && (
          <>
            <div className="mt-5">
              <Vinyl
                cover={player.art}
                title={s.title}
                artist={s.artist}
                playing={!!s.playing}
                progress={pct / 100}
                trackKey={s.uri}
                onToggle={player.toggle}
              />
            </div>
            <div className="mt-4 flex flex-col gap-1">
              <span className="song truncate text-[20px]">{s.title}</span>
              <span className="label truncate text-[10px] text-muted">
                {[s.artist, s.album].filter(Boolean).join(" · ")}
              </span>
            </div>
            <input
              type="range"
              aria-label="Seek"
              min={0}
              max={Math.max(1, s.duration ?? 0)}
              value={Math.min(s.position ?? 0, s.duration ?? 0)}
              onChange={(e) => player.seek(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--color-music)]"
              style={{
                background: `linear-gradient(to right, var(--color-music) ${pct}%, transparent ${pct}%)`,
              }}
            />
            <div className="label flex justify-between text-[10px] text-muted">
              <span>{mmss(s.position ?? 0)}</span>
              <span>{mmss(s.duration ?? 0)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <ModeButton
                label="Shuffle"
                on={!!s.shuffle}
                onClick={() => player.setShuffle(!s.shuffle)}
              >
                <ShuffleIcon size={22} />
              </ModeButton>
              <button
                aria-label="Previous track"
                onClick={player.previous}
                className="flex size-12 items-center justify-center"
              >
                <PrevIcon size={22} />
              </button>
              <button
                aria-label={s.playing ? "Pause" : "Play"}
                onClick={player.toggle}
                className="flex size-16 items-center justify-center rounded-full bg-music text-white"
              >
                {s.playing ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
              </button>
              <button
                aria-label="Next track"
                onClick={player.next}
                className="flex size-12 items-center justify-center"
              >
                <NextIcon size={22} />
              </button>
              <ModeButton
                label={
                  s.repeat === "one"
                    ? "Repeat: this song"
                    : s.repeat === "all"
                      ? "Repeat: all songs"
                      : "Repeat: off"
                }
                on={!!s.repeat && s.repeat !== "off"}
                onClick={player.cycleRepeat}
              >
                <RepeatIcon size={22} one={s.repeat === "one"} />
              </ModeButton>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-2">
              <Extra label="Back 10 seconds" onClick={() => player.seek(Math.max(0, (s.position ?? 0) - 10000))}>
                <span className="label text-[11px] font-medium">−10s</span>
              </Extra>
              <Extra label="Playback speed" on={(s.speed || 1) !== 1} onClick={() => setSheet("speed")}>
                <span className="label text-[11px] font-medium">{s.speed || 1}×</span>
              </Extra>
              <Extra
                label={sleepLeft > 0 ? `Sleep timer: ${mmss(sleepLeft)} left` : s.sleepEndOfTrack ? "Sleep timer: end of song" : "Sleep timer"}
                on={sleepLeft > 0 || !!s.sleepEndOfTrack}
                onClick={() => setSheet("sleep")}
              >
                <TimerIcon size={20} />
                {(sleepLeft > 0 || s.sleepEndOfTrack) && (
                  <span className="label text-[9px]">{s.sleepEndOfTrack ? "END" : mmss(sleepLeft)}</span>
                )}
              </Extra>
              <Extra label="Up next" onClick={() => setSheet("queue")}>
                <QueueIcon size={20} />
                {!!s.count && <span className="label text-[9px]">{(s.index ?? 0) + 1}/{s.count}</span>}
              </Extra>
              <Extra
                label="Forward 10 seconds"
                onClick={() => player.seek(Math.min(s.duration ?? 0, (s.position ?? 0) + 10000))}
              >
                <span className="label text-[11px] font-medium">+10s</span>
              </Extra>
            </div>
          </>
        )}
      </div>
      <div className="md:pt-6">
        {error && <p className="mt-4 text-[13px] text-music-deep">{error}</p>}

        {tracks && tracks.length === 0 && (
          <p className="mt-6 text-[14px] leading-relaxed text-muted">
            No songs found. Stack shows music files (MP3, M4A, FLAC…) that
            Android lists in its media library, such as the Music and Download
            folders.
          </p>
        )}

        {tracks && tracks.length > 0 && (
          <>
            <PlaylistsRail
              onNew={() => {
                setNewOnly(true);
                setAdding([]);
              }}
            />
            <label className="mt-6 flex h-[46px] items-center gap-2.5 rounded-full border border-ink/12 bg-card px-4">
              <SearchIcon size={18} className="text-muted" />
              <input
                aria-label="Search songs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search songs, artists, albums"
                className="grow bg-transparent text-[14px] outline-none"
              />
            </label>
            <div className="mt-3 flex items-center justify-between">
              <h2 className="label text-[11px] font-medium text-music-text">
                {query ? `${shown.length} matches` : "All songs"}
              </h2>
              <div role="radiogroup" aria-label="Sort" className="flex gap-3">
                {(["title", "artist", "recent"] as Sort[]).map((o) => (
                  <button
                    key={o}
                    role="radio"
                    aria-checked={sort === o}
                    onClick={() => setSort(o)}
                    className={`label h-8 text-[10px] ${sort === o ? "font-medium underline" : "text-muted"}`}
                  >
                    {o === "recent"
                      ? "Newest"
                      : o[0].toUpperCase() + o.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <ol className="mt-1">
              {shown.slice(0, limit).map((t, i) => {
                const now = t.uri === s.uri;
                return (
                  <li key={t.uri} className="flex items-center">
                    <button
                      onClick={() => player.play(shown, i)}
                      className="flex h-14 min-w-0 grow items-center gap-3 text-left"
                    >
                      <span
                        className="flex size-10 shrink-0 items-center justify-center text-[15px] font-bold text-white"
                        style={{
                          background:
                            SWATCHES[
                              (t.title.charCodeAt(0) || 0) % SWATCHES.length
                            ],
                        }}
                      >
                        {now && s.playing
                          ? "▶"
                          : t.title.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="flex min-w-0 grow flex-col">
                        <span
                          className={`song truncate text-[15px] ${now ? "text-music-text" : ""}`}
                        >
                          {t.title}
                        </span>
                        <span className="label truncate text-[9px] text-muted">
                          {[t.artist, t.album].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="label text-[10px]">
                        {mmss(t.duration)}
                      </span>
                    </button>
                    <button
                      aria-label={`More for ${t.title}`}
                      onClick={() => setMenuFor(t)}
                      className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted"
                    >
                      <MoreVerticalIcon size={18} />
                    </button>
                  </li>
                );
              })}
            </ol>
            {shown.length > limit && (
              <button
                onClick={() => setLimit((l) => l + 100)}
                className="label mt-3 h-11 w-full rounded-full border border-ink/15 text-[10px]"
              >
                Show more ({shown.length - limit})
              </button>
            )}
          </>
        )}
      </div>
      <AddToPlaylistSheet songs={adding} newOnly={newOnly} onClose={() => setAdding(null)} />
      <SongActionsSheet
        song={menuFor}
        onClose={() => setMenuFor(null)}
        onAddToPlaylist={(t) => {
          setNewOnly(false);
          setAdding([t]);
        }}
      />
      <SpeedSheet open={sheet === "speed"} onClose={() => setSheet(null)} />
      <SleepSheet open={sheet === "sleep"} onClose={() => setSheet(null)} />
      <QueueSheet open={sheet === "queue"} onClose={() => setSheet(null)} />
    </div>
  );
}

// Shuffle / repeat toggle: coloured with a dot underneath when on.
export function ModeButton({
  label,
  on,
  onClick,
  children,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      aria-pressed={on}
      onClick={onClick}
      className={`relative flex size-12 shrink-0 items-center justify-center ${on ? "text-music-text" : "text-muted"}`}
    >
      {children}
      {on && (
        <span className="absolute bottom-1 size-1 rounded-full bg-music" />
      )}
    </button>
  );
}

// Secondary player control: seek, speed, sleep timer, queue.
function Extra({
  label,
  on = false,
  onClick,
  children,
}: {
  label: string;
  on?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 ${on ? "text-music-text" : "text-muted"}`}
    >
      {children}
    </button>
  );
}
