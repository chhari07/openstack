"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useLocalMusic } from "@/components/local-music-provider";
import { PlaylistCover } from "@/components/playlist-parts";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { BackIcon, CloseIcon, PlayIcon, PlusIcon, SearchIcon, ShuffleIcon } from "@/components/icons";
import { mmss, plural } from "@/lib/format";
import { pickImage } from "@/lib/image";
import { LocalMusic, type LocalTrack } from "@/lib/local-music";
import { canGoBack } from "@/lib/nav";
import { addToPlaylist, deletePlaylist, getPlaylists, resolveTracks, updatePlaylist } from "@/lib/playlists";
import { useStore } from "@/lib/use-store";

export default function Page() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <PlaylistScreen />
    </Suspense>
  );
}

// Songs on this phone (for playing and for "Add songs").
function useLibrary(on: boolean) {
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  useEffect(() => {
    if (!on) return;
    LocalMusic.checkAudio()
      .then(({ audio }) => (audio === "granted" ? LocalMusic.listTracks() : { tracks: [] }))
      .then(({ tracks }) => setTracks(tracks))
      .catch(() => setTracks([]));
  }, [on]);
  return tracks;
}

function PlaylistScreen() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const toast = useToast();
  const player = useLocalMusic();
  const [playlists, ready] = useStore(getPlaylists, []);
  const p = playlists.find((x) => x.id === id);
  const library = useLibrary(player.available);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const resolved = useMemo(() => (p ? resolveTracks(p, library) : []), [p, library]);
  const playable = resolved.filter((t): t is LocalTrack => !!t);
  const missing = resolved.length - playable.length;
  const minutes = Math.round(p?.tracks.reduce((sum, t) => sum + t.duration, 0) ?? 0) / 60_000;

  const back = () => (canGoBack() ? router.back() : router.push("/music"));

  if (ready && !p) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5">
        <p className="font-serif text-[22px] italic">This playlist no longer exists.</p>
        <button onClick={() => router.push("/music")} className="label text-[11px] underline">
          Back to Music
        </button>
      </main>
    );
  }
  if (!p) return null;

  const play = async (shuffle: boolean) => {
    if (!playable.length) return;
    await player.setShuffle(shuffle);
    await player.play(playable, shuffle ? Math.floor(Math.random() * playable.length) : 0);
  };

  const changeCover = async () => {
    const cover = await pickImage(640);
    if (cover) await updatePlaylist(p.id, { cover });
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= p.tracks.length) return;
    const next = [...p.tracks];
    const [t] = next.splice(from, 1);
    next.splice(to, 0, t);
    updatePlaylist(p.id, { tracks: next });
  };

  const startEdit = () => {
    setName(p.name);
    setEditing(true);
  };
  const saveName = () => {
    if (name.trim() && name.trim() !== p.name) updatePlaylist(p.id, { name: name.trim() });
  };

  return (
    <main className="min-h-dvh px-5 pt-5 pb-[calc(max(env(safe-area-inset-bottom),20px)+60px)] md:px-10 md:pt-8">
      <div className="flex h-8 items-center justify-between">
        <button aria-label="Back" onClick={back} className="-ml-2.5 flex size-11 items-center justify-center">
          <BackIcon size={22} />
        </button>
        <button
          onClick={() => (editing ? (saveName(), setEditing(false)) : startEdit())}
          className={`label h-9 rounded-full px-4 text-[10px] ${editing ? "bg-ink text-on-ink" : "border border-ink/20"}`}
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      <div className="mx-auto max-w-[640px]">
        <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-end">
          <button onClick={changeCover} aria-label="Change playlist image" className="relative shadow-[0_10px_24px_rgba(0,0,0,.18)]">
            <PlaylistCover p={p} size={210} />
            <span className="label absolute right-2 bottom-2 rounded-full bg-black/60 px-2.5 py-1 text-[9px] text-white">
              {p.cover ? "Change image" : "Add image"}
            </span>
          </button>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="label text-[10px] text-music-text">Playlist</span>
            {editing ? (
              <input
                aria-label="Playlist name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="w-full rounded-xl border border-ink/20 bg-card px-3 py-2 text-[28px] leading-tight font-bold outline-none focus:border-ink"
              />
            ) : (
              <h1 className="text-[32px] leading-[1.05] font-bold [font-stretch:87%]">{p.name}</h1>
            )}
            <span className="label text-[10px] text-muted">
              {plural(p.tracks.length, "song")} · {Math.max(1, Math.round(minutes))} min
            </span>
            {editing && p.cover && (
              <button onClick={() => updatePlaylist(p.id, { cover: undefined })} className="label self-start text-[9px] text-muted underline">
                Remove image
              </button>
            )}
          </div>
        </div>

        {!player.available && (
          <p className="mt-5 rounded-xl bg-card px-4 py-3 text-[13px] text-muted">
            Playlists play songs stored on your phone. Open Stack on your Android phone to play this one.
          </p>
        )}

        <div className="mt-5 flex gap-2.5">
          <button
            onClick={() => play(false)}
            disabled={!playable.length}
            className="flex h-14 grow items-center justify-center gap-2 rounded-full bg-music text-[16px] font-semibold text-white disabled:opacity-40"
          >
            <PlayIcon size={18} /> Play
          </button>
          <button
            onClick={() => play(true)}
            disabled={!playable.length}
            aria-label="Shuffle play"
            className="flex h-14 w-16 items-center justify-center rounded-full border border-ink/20 disabled:opacity-40"
          >
            <ShuffleIcon size={20} />
          </button>
          <button
            onClick={() => setPicking(true)}
            disabled={!library.length}
            aria-label="Add songs"
            className="flex h-14 w-16 items-center justify-center rounded-full border border-ink/20 disabled:opacity-40"
          >
            <PlusIcon size={20} />
          </button>
        </div>
        {missing > 0 && player.available && (
          <p className="mt-3 text-[12px] text-muted">
            {missing} song{missing > 1 ? "s aren’t" : " isn’t"} on this phone.
          </p>
        )}

        {p.tracks.length === 0 ? (
          <button
            onClick={() => setPicking(true)}
            disabled={!library.length}
            className="mt-8 flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-ink/25 text-muted"
          >
            <PlusIcon size={20} />
            <span className="label text-[10px]">Add songs</span>
          </button>
        ) : (
          <ol className="mt-5">
            {p.tracks.map((t, i) => {
              const here = resolved[i];
              return (
                <li key={`${t.uri}-${i}`} className={`flex h-14 items-center gap-3 ${here ? "" : "opacity-45"}`}>
                  <button
                    disabled={!here || editing}
                    onClick={() => here && player.play(playable, playable.indexOf(here))}
                    className="flex min-w-0 grow items-center gap-3 text-left"
                  >
                    <span className="label w-6 text-right text-[10px] text-muted">{i + 1}</span>
                    <span className="flex min-w-0 grow flex-col">
                      <span className={`song truncate text-[15px] ${player.state.uri === here?.uri ? "text-music-text" : ""}`}>
                        {t.title}
                      </span>
                      <span className="label truncate text-[9px] text-muted">
                        {here ? t.artist || "Unknown artist" : "Not on this phone"}
                      </span>
                    </span>
                    {!editing && <span className="label text-[10px]">{mmss(t.duration)}</span>}
                  </button>
                  {editing && (
                    <div className="flex shrink-0 items-center">
                      <button aria-label={`Move ${t.title} up`} disabled={i === 0} onClick={() => move(i, i - 1)} className="flex size-10 items-center justify-center text-[16px] disabled:opacity-25">
                        ↑
                      </button>
                      <button aria-label={`Move ${t.title} down`} disabled={i === p.tracks.length - 1} onClick={() => move(i, i + 1)} className="flex size-10 items-center justify-center text-[16px] disabled:opacity-25">
                        ↓
                      </button>
                      <button
                        aria-label={`Remove ${t.title}`}
                        onClick={() => updatePlaylist(p.id, { tracks: p.tracks.filter((_, j) => j !== i) })}
                        className="flex size-10 items-center justify-center text-music-text"
                      >
                        <CloseIcon size={16} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {editing && (
          <button onClick={() => setConfirmDelete(true)} className="label mt-8 h-11 w-full rounded-full border border-music/40 text-[10px] text-music-text">
            Delete playlist
          </button>
        )}
      </div>

      <SongPicker
        open={picking}
        library={library}
        already={new Set(p.tracks.map((t) => t.uri))}
        onClose={() => setPicking(false)}
        onAdd={async (songs) => {
          const added = await addToPlaylist(p.id, songs);
          setPicking(false);
          toast({ text: `Added ${added} song${added === 1 ? "" : "s"}` });
        }}
      />

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete “${p.name}”?`}>
        <p className="text-[15px] text-muted">The songs stay on your phone; only the playlist is removed.</p>
        <button
          onClick={async () => {
            await deletePlaylist(p.id);
            router.replace("/music");
          }}
          className="h-12 rounded-full bg-music text-[15px] font-semibold text-white"
        >
          Delete playlist
        </button>
      </Sheet>
    </main>
  );
}

// Tick songs from the phone to add.
function SongPicker({
  open,
  library,
  already,
  onClose,
  onAdd,
}: {
  open: boolean;
  library: LocalTrack[];
  already: Set<string>;
  onClose: () => void;
  onAdd: (songs: LocalTrack[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const shown = library.filter(
    (t) => !query.trim() || [t.title, t.artist, t.album].some((x) => x.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const close = () => {
    setPicked(new Set());
    setQuery("");
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title="Add songs">
      <label className="flex h-[46px] items-center gap-2.5 rounded-full border border-ink/12 bg-card px-4">
        <SearchIcon size={18} className="text-muted" />
        <input
          aria-label="Search songs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your songs"
          className="grow bg-transparent text-[14px] outline-none"
        />
      </label>
      <ul className="-mx-1 flex max-h-[48dvh] flex-col overflow-y-auto">
        {shown.slice(0, 300).map((t) => {
          const inList = already.has(t.uri);
          const on = picked.has(t.uri);
          return (
            <li key={t.uri}>
              <label className={`flex h-14 items-center gap-3 px-1 ${inList ? "opacity-45" : ""}`}>
                <input
                  type="checkbox"
                  disabled={inList}
                  checked={inList || on}
                  onChange={() =>
                    setPicked((s) => {
                      const next = new Set(s);
                      if (next.has(t.uri)) next.delete(t.uri);
                      else next.add(t.uri);
                      return next;
                    })
                  }
                  className="size-5 accent-[var(--color-music)]"
                />
                <span className="flex min-w-0 grow flex-col">
                  <span className="song truncate text-[15px]">{t.title}</span>
                  <span className="label truncate text-[9px] text-muted">{inList ? "Already in playlist" : t.artist}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <button
        disabled={picked.size === 0}
        onClick={() => {
          onAdd(library.filter((t) => picked.has(t.uri)));
          setPicked(new Set());
          setQuery("");
        }}
        className="h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-40"
      >
        Add {picked.size || ""} song{picked.size === 1 ? "" : "s"}
      </button>
    </Sheet>
  );
}
