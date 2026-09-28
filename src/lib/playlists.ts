"use client";

// Your own playlists of songs on the phone. Songs are stored with their
// title/artist too, so a playlist synced to another phone can find the same
// songs there (see resolveTracks).
import { get, update } from "idb-keyval";
import { emit, uid } from "./db";
import type { LocalTrack } from "./local-music";
import { track } from "./sync-state";

export type Playlist = {
  id: string;
  name: string;
  description?: string;
  cover?: string; // small JPEG data URL (lib/image.ts)
  tracks: LocalTrack[];
  createdAt: number;
  updatedAt: number;
};

export async function getPlaylists(): Promise<Playlist[]> {
  const all = (await get<Playlist[]>("playlists")) ?? [];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getPlaylist(id: string) {
  return (await getPlaylists()).find((p) => p.id === id) ?? null;
}

export async function createPlaylist(name: string, tracks: LocalTrack[] = []) {
  const p: Playlist = { id: uid(), name: name.trim() || "New playlist", tracks, createdAt: Date.now(), updatedAt: Date.now() };
  await update<Playlist[]>("playlists", (all) => [...(all ?? []), p]);
  await track("playlists", p.id);
  emit();
  return p;
}

export async function updatePlaylist(id: string, patch: Partial<Omit<Playlist, "id" | "createdAt">>) {
  await update<Playlist[]>("playlists", (all) =>
    (all ?? []).map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
  );
  await track("playlists", id);
  emit();
}

export async function deletePlaylist(id: string) {
  await update<Playlist[]>("playlists", (all) => (all ?? []).filter((p) => p.id !== id));
  await track("playlists", id, "del");
  emit();
}

// Adds songs that aren't in the playlist yet; returns how many were added.
export async function addToPlaylist(id: string, songs: LocalTrack[]) {
  const p = await getPlaylist(id);
  if (!p) return 0;
  const have = new Set(p.tracks.map((t) => t.uri));
  const fresh = songs.filter((s) => !have.has(s.uri));
  if (fresh.length) await updatePlaylist(id, { tracks: [...p.tracks, ...fresh] });
  return fresh.length;
}

const songKey = (t: Pick<LocalTrack, "title" | "artist">) =>
  `${t.title.trim().toLowerCase()}|${t.artist.trim().toLowerCase()}`;

// Matches a playlist's songs to the songs on this phone: same file, or the
// same title and artist (a playlist made on another phone). Missing songs
// come back as null.
export function resolveTracks(p: Playlist, library: LocalTrack[]): (LocalTrack | null)[] {
  const byUri = new Map(library.map((t) => [t.uri, t]));
  const byName = new Map(library.map((t) => [songKey(t), t]));
  return p.tracks.map((t) => byUri.get(t.uri) ?? byName.get(songKey(t)) ?? null);
}
