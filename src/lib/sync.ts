"use client";

// Cloud sync. Local-first: everything is read and written on the device
// (IndexedDB) and works offline; when signed in, changes are uploaded to the
// account's "items" table and changes from other devices are downloaded.
//
// Firestore: users/<uid>/items/<collection>__<id>, one document per item
// ({ collection, id, data, deleted, updatedAt }), stamped by the server.
// - Upload: every changed/deleted item (lib/sync-state.ts), then clear those.
// - Download: documents the server stamped after our last download. A local
//   change that isn't uploaded yet wins over the downloaded copy.
// - PDF files go to Storage (users/<uid>/pdfs/<id>.pdf) when the project has
//   it, and are downloaded on another device when first opened.
import { del, get, keys, set, update } from "idb-keyval";
import {
  collection as fsCollection,
  doc,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { emit } from "./db";
import { cloud } from "./cloud";
import {
  changeKey,
  clearChanges,
  pendingChanges,
  setBlobFetcher,
  track,
  type Changes,
  type Collection,
} from "./sync-state";

const COLLECTIONS: Collection[] = ["notes", "saved", "pdfs", "playlists", "focus", "profile"];
type Row = { collection: Collection; id: string; data: Record<string, unknown> | null; deleted: boolean; updatedAt: Timestamp };
type Item = { id: string } & Record<string, unknown>;
type Since = { s: number; ns: number }; // exact server time of the last download

const sinceKey = (uid: string) => `sync:since:${uid}`;
const FILES_KEY = "sync:files"; // PDF ids whose file is already in Storage
const pdfPath = (uid: string, id: string) => `users/${uid}/pdfs/${id}.pdf`;
const currentUid = () => cloud()?.auth.currentUser?.uid ?? null;

// Firestore document ids can't hold "/" and must stay short; a long saved-link
// id is hashed (the real id is kept inside the document).
function docId(col: Collection, id: string) {
  if (/^[\w.-]{1,300}$/.test(id)) return `${col}__${id}`;
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  return `${col}__h${h.toString(36)}_${id.length}_${id.slice(-40).replace(/[^\w.-]/g, "")}`;
}

// ---- Local collections ----
async function readLocal(col: Collection): Promise<Map<string, Item>> {
  if (col === "profile") {
    const p = await get<Item>("profile");
    return new Map(p ? [["me", p]] : []);
  }
  const list = (await get<Item[]>(col)) ?? [];
  return new Map(list.map((x) => [x.id, x]));
}

async function writeLocal(col: Collection, puts: Item[], dels: string[]) {
  if (!puts.length && !dels.length) return;
  if (col === "profile") {
    if (puts[0]) await set("profile", puts[puts.length - 1]);
    else await del("profile");
    return;
  }
  const gone = new Set(dels);
  const incoming = new Map(puts.map((p) => [p.id, p]));
  await update<Item[]>(col, (all) => {
    const kept = (all ?? []).filter((x) => !gone.has(x.id) && !incoming.has(x.id));
    return [...kept, ...incoming.values()];
  });
}

// ---- Status, for the Account screen ----
export type SyncStatus = { state: "idle" | "syncing" | "error" | "offline"; lastSynced?: number; error?: string };
let status: SyncStatus = { state: "idle" };
const watchers = new Set<(s: SyncStatus) => void>();
const setStatus = (s: SyncStatus) => {
  status = s;
  watchers.forEach((fn) => fn(s));
};
export const syncStatus = () => status;
export function watchSync(fn: (s: SyncStatus) => void) {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

// ---- One sync ----
let running: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  // One at a time; a request during a sync runs once more afterwards.
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce() {
  const uid = currentUid();
  if (!uid) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return setStatus({ ...status, state: "offline" });
  setStatus({ ...status, state: "syncing", error: undefined });
  try {
    await upload(uid);
    await download(uid);
    setStatus({ state: "idle", lastSynced: Date.now() });
  } catch (e) {
    setStatus({ ...status, state: "error", error: (e as Error).message ?? String(e) });
  }
}

async function upload(uid: string) {
  const { db, storage } = cloud()!;
  const changes = await pendingChanges();
  const keysToSend = Object.keys(changes);
  if (!keysToSend.length) return;

  const locals = new Map<Collection, Map<string, Item>>();
  for (const col of COLLECTIONS) locals.set(col, await readLocal(col));
  const files = new Set((await get<string[]>(FILES_KEY)) ?? []);

  const rows: Omit<Row, "updatedAt">[] = [];
  for (const key of keysToSend) {
    const slash = key.indexOf("/");
    const col = key.slice(0, slash) as Collection;
    const id = key.slice(slash + 1);
    const item = locals.get(col)?.get(id);
    if (changes[key].op === "del" || !item) {
      rows.push({ collection: col, id, data: null, deleted: true });
      if (col === "pdfs" && storage) {
        await deleteObject(ref(storage, pdfPath(uid, id))).catch(() => {});
        files.delete(id);
      }
      continue;
    }
    let data: Record<string, unknown> = item;
    if (col === "pdfs") {
      // The file goes to Storage once (if the project has it); the cover rides along.
      if (storage && !files.has(id)) {
        const blob = await get<Blob>(`pdf:${id}`);
        if (blob) {
          try {
            await uploadBytes(ref(storage, pdfPath(uid, id)), blob, { contentType: "application/pdf" });
            files.add(id);
          } catch (e) {
            throw new Error(`Couldn’t upload “${item.title}”: ${(e as Error).message}`);
          }
        }
      }
      data = { ...item, cover: (await get<string>(`cover:${id}`)) ?? null };
    }
    rows.push({ collection: col, id, data, deleted: false });
  }

  // Firestore takes up to 500 writes per batch; smaller ones keep requests light.
  const items = fsCollection(db, "users", uid, "items");
  for (let i = 0; i < rows.length; i += 200) {
    const batch = writeBatch(db);
    for (const r of rows.slice(i, i + 200)) {
      batch.set(doc(items, docId(r.collection, r.id)), { ...r, updatedAt: serverTimestamp() });
    }
    await batch.commit();
  }
  await set(FILES_KEY, [...files]);
  await clearChanges(changes);
}

async function download(uid: string) {
  const { db } = cloud()!;
  const saved = await get<Since>(sinceKey(uid));
  let since = saved ? new Timestamp(saved.s, saved.ns) : new Timestamp(0, 0);
  const items = fsCollection(db, "users", uid, "items");
  const rows: Row[] = [];
  for (;;) {
    const snap = await getDocsFromServer(
      query(items, where("updatedAt", ">", since), orderBy("updatedAt"), limit(500)),
    );
    const page = snap.docs.map((d) => d.data() as Row);
    rows.push(...page);
    if (page.length < 500) break;
    since = page[page.length - 1].updatedAt;
  }
  if (!rows.length) return;

  // Not uploaded yet here → keep ours (it's uploaded next time).
  const pending: Changes = await pendingChanges();
  const files = new Set((await get<string[]>(FILES_KEY)) ?? []);
  const byCol = new Map<Collection, { puts: Item[]; dels: string[] }>();
  for (const r of rows) {
    if (!COLLECTIONS.includes(r.collection) || pending[changeKey(r.collection, r.id)]) continue;
    const bucket = byCol.get(r.collection) ?? { puts: [], dels: [] };
    byCol.set(r.collection, bucket);
    if (r.deleted || !r.data) {
      bucket.dels.push(r.id);
      if (r.collection === "pdfs") {
        await Promise.all([del(`pdf:${r.id}`), del(`cover:${r.id}`)]);
        files.delete(r.id);
      }
      continue;
    }
    const item = { ...(r.data as Item), id: r.id };
    if (r.collection === "pdfs") {
      const { cover, ...meta } = item as Item & { cover?: string | null };
      if (cover) await set(`cover:${r.id}`, cover);
      files.add(r.id); // already in Storage; downloaded when opened
      bucket.puts.push(meta as Item);
    } else {
      bucket.puts.push(item);
    }
  }
  for (const [col, { puts, dels }] of byCol) await writeLocal(col, puts, dels);
  await set(FILES_KEY, [...files]);
  const last = rows[rows.length - 1].updatedAt;
  await set(sinceKey(uid), { s: last.seconds, ns: last.nanoseconds } satisfies Since);
  emit();
}

// A PDF from another device: fetch its file on first open.
export async function downloadPdf(id: string): Promise<Blob | null> {
  const c = cloud();
  if (!c?.storage) return null;
  // Opened right after start-up: wait until Firebase has restored the sign-in.
  await c.auth.authStateReady();
  const storage = c.storage;
  const uid = currentUid();
  if (!uid) return null;
  try {
    // A signed download link, then a normal fetch (the app's native HTTP has no CORS limits).
    const url = await getDownloadURL(ref(storage, pdfPath(uid, id)));
    const res = await fetch(url);
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

// First sign-in on this device: everything already here goes up to the account.
export async function uploadEverything() {
  for (const col of COLLECTIONS) {
    const ids = [...(await readLocal(col)).keys()];
    await track(col, ids);
  }
}

// "Sign out and remove from this phone".
// Also forgets how far this device had downloaded, so signing in again
// brings everything back.
export async function clearLocalData() {
  const pdfs = (await get<Item[]>("pdfs")) ?? [];
  await Promise.all(pdfs.flatMap((p) => [del(`pdf:${p.id}`), del(`cover:${p.id}`)]));
  const cursors = (await keys()).filter((k) => typeof k === "string" && k.startsWith("sync:since:"));
  await Promise.all([...COLLECTIONS, FILES_KEY, "sync:dirty", ...cursors].map((k) => del(k)));
  emit();
}

// Registered at start-up (not after sign-in): the PDF reader may ask before
// the saved sign-in has been restored; downloadPdf waits for it.
setBlobFetcher(downloadPdf);
