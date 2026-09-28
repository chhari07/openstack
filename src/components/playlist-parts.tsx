"use client";

import Link from "next/link";
import { useState } from "react";
import type { LocalTrack } from "@/lib/local-music";
import { addToPlaylist, createPlaylist, getPlaylists, type Playlist } from "@/lib/playlists";
import { useStore } from "@/lib/use-store";
import { plural } from "@/lib/format";
import { PlusIcon } from "./icons";
import { Sheet } from "./sheet";
import { SWATCHES } from "./spotify-view";
import { useToast } from "./toast";

export const playlistHref = (id: string) => `/music/mine?id=${id}`;

// The playlist's image, or a colour block with its first letter.
export function PlaylistCover({ p, size, className = "" }: { p: Pick<Playlist, "name" | "cover">; size: number; className?: string }) {
  if (p.cover) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.cover} alt="" style={{ width: size, height: size }} className={`shrink-0 object-cover ${className}`} />;
  }
  return (
    <span
      style={{ width: size, height: size, background: SWATCHES[(p.name.charCodeAt(0) || 0) % SWATCHES.length], fontSize: size * 0.42 }}
      className={`display flex shrink-0 items-center justify-center text-white/90 ${className}`}
    >
      {p.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

// "Your playlists" row in Music, with a card to make a new one.
export function PlaylistsRail({ onNew }: { onNew: () => void }) {
  const [playlists] = useStore(getPlaylists, []);
  return (
    <>
      <h2 className="label mt-6 text-[11px] font-medium text-music-text">Your playlists</h2>
      <div role="list" aria-label="Your playlists" className="rail -mx-5 mt-3 gap-3 px-5 md:mx-0 md:px-0">
        <button
          onClick={onNew}
          className="flex w-[120px] flex-col gap-1.5 text-left"
        >
          <span className="flex size-[120px] items-center justify-center border border-dashed border-ink/30 text-muted">
            <PlusIcon size={26} />
          </span>
          <span className="song truncate text-[13px]">New playlist</span>
          <span className="label text-[9px] text-muted">From your songs</span>
        </button>
        {playlists.map((p) => (
          <Link key={p.id} role="listitem" href={playlistHref(p.id)} className="flex w-[120px] flex-col gap-1.5">
            <PlaylistCover p={p} size={120} />
            <span className="song truncate text-[13px]">{p.name}</span>
            <span className="label text-[9px] text-muted">{plural(p.tracks.length, "song")}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

// "Add to playlist" for one or more songs: pick a playlist or make a new one.
export function AddToPlaylistSheet({
  songs,
  onClose,
  newOnly = false,
}: {
  songs: LocalTrack[] | null;
  onClose: () => void;
  newOnly?: boolean;
}) {
  const [playlists] = useStore(getPlaylists, []);
  const [name, setName] = useState("");
  const toast = useToast();
  const open = songs !== null;

  const create = async () => {
    const p = await createPlaylist(name, songs ?? []);
    setName("");
    onClose();
    toast({ text: `Made “${p.name}”`, href: playlistHref(p.id) });
  };

  return (
    <Sheet open={open} onClose={onClose} title={newOnly ? "New playlist" : songs?.length === 1 ? `Add “${songs[0].title}”` : "Add to playlist"}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create();
        }}
      >
        <input
          aria-label="New playlist name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New playlist name"
          className="h-12 min-w-0 grow rounded-full border border-ink/15 bg-card px-4 text-[15px] outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="h-12 rounded-full bg-ink px-5 text-[14px] font-semibold text-on-ink disabled:opacity-40"
        >
          Create
        </button>
      </form>
      {!newOnly && playlists.length > 0 && (
        <ul className="-mx-1 flex max-h-[45dvh] flex-col overflow-y-auto">
          {playlists.map((p) => (
            <li key={p.id}>
              <button
                onClick={async () => {
                  const added = await addToPlaylist(p.id, songs ?? []);
                  onClose();
                  toast({
                    text: added ? `Added to “${p.name}”` : `Already in “${p.name}”`,
                    href: playlistHref(p.id),
                  });
                }}
                className="flex h-16 w-full items-center gap-3 rounded-xl px-1 text-left"
              >
                <PlaylistCover p={p} size={48} />
                <span className="flex min-w-0 grow flex-col">
                  <span className="song truncate text-[15px]">{p.name}</span>
                  <span className="label text-[9px] text-muted">{plural(p.tracks.length, "song")}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
