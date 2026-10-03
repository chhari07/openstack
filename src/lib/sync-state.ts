"use client";

// Change tracking for cloud sync. Every local write marks "collection/id" as
// changed (or deleted); the sync engine (lib/sync.ts) uploads those and clears
// them. Kept separate from sync.ts so the storage layer doesn't load Supabase.
import { get, update } from "idb-keyval";

export type Collection = "notes" | "saved" | "pdfs" | "playlists" | "focus" | "profile" | "feeds";

// v: bumped on every change, so a change made during an upload isn't cleared.
export type Change = { op: "put" | "del"; v: number };
export type Changes = Record<string, Change>;

const KEY = "sync:dirty";
let counter = Date.now();
let listener: (() => void) | null = null;

export const changeKey = (col: Collection, id: string) => `${col}/${id}`;

export async function track(col: Collection, ids: string | string[], op: Change["op"] = "put") {
  const list = Array.isArray(ids) ? ids : [ids];
  if (list.length === 0) return;
  await update<Changes>(KEY, (all) => {
    const next = { ...(all ?? {}) };
    for (const id of list) next[changeKey(col, id)] = { op, v: ++counter };
    return next;
  });
  listener?.();
}

export async function pendingChanges(): Promise<Changes> {
  return (await get<Changes>(KEY)) ?? {};
}

// Clears what was uploaded, unless it changed again meanwhile.
export async function clearChanges(done: Changes) {
  await update<Changes>(KEY, (all) => {
    const next = { ...(all ?? {}) };
    for (const [k, c] of Object.entries(done)) if (next[k]?.v === c.v) delete next[k];
    return next;
  });
}

export async function forgetChanges() {
  await update<Changes>(KEY, () => ({}));
}

// The sync engine listens, to upload soon after a change.
export function onChange(fn: (() => void) | null) {
  listener = fn;
}

// A PDF that synced from another device has its file downloaded on first open.
let blobFetcher: ((id: string) => Promise<Blob | null>) | null = null;
export const setBlobFetcher = (fn: typeof blobFetcher) => {
  blobFetcher = fn;
};
export const fetchBlob = (id: string) => blobFetcher?.(id) ?? Promise.resolve(null);
