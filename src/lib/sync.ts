"use client";

// Cloud sync. Local-first: everything is read and written on the device
// (IndexedDB) and works offline; when signed in, changes are uploaded to the
// account's "items" table and changes from other devices are downloaded.
//
// Supabase (supabase/schema.sql): one row per item in `items`
// ({ user_id, collection, key, id, data, deleted, seq }); the server gives
// every write the next `seq` number.
// - Upload: every changed/deleted item (lib/sync-state.ts), then clear those.
// - Download: rows with a higher `seq` than our last download. A local
//   change that isn't uploaded yet wins over the downloaded copy.
// - PDF files go to Storage (pdfs/<uid>/<id>.pdf), and are downloaded on
//   another device when first opened.
import { del, get, keys, set, update } from "idb-keyval";
import { emit } from "./db";
import { cloud, CloudOffline, fetchPdf, MAX_PDF_BYTES, removePdf, sessionUser, signOutCloud, uploadPdf } from "./cloud";
import {
  changeKey,
  clearChanges,
  pendingChanges,
  setBlobFetcher,
  track,
  type Changes,
  type Collection,
} from "./sync-state";

const COLLECTIONS: Collection[] = ["notes", "saved", "pdfs", "playlists", "focus", "profile", "feeds"];
type Row = { collection: Collection; key: string; id: string; data: Record<string, unknown> | null; deleted: boolean };
type Item = { id: string } & Record<string, unknown>;

const PAGE = 200; // rows per download request
const seqKey = (uid: string) => `sync:seq:${uid}`; // the last `seq` this device downloaded
const filesKey = (uid: string) => `sync:files:${uid}`; // PDF ids whose file is in Storage

// A very long saved-link id is shortened for the table's key (the real id is
// kept in the row).
function rowKey(id: string) {
  if (id.length <= 300) return id;
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  return `h${h.toString(36)}_${id.length}_${id.slice(-40)}`;
}

// Postgres can't store the NUL character that some PDFs put in their text.
const clean = <T,>(value: T): T =>
  JSON.parse(JSON.stringify(value), (_k, v) => (typeof v === "string" ? v.replaceAll("\u0000", "") : v));

// The database's answer, or an error the status line can explain.
type DbResult<T> = { data: T; error: { message: string; code?: string } | null; status: number };
function ok<T>(res: DbResult<T>): T {
  if (!res.error) return res.data;
  if (res.status === 0) throw new CloudOffline(); // the request never got there
  throw Object.assign(new Error(res.error.message), { code: res.error.code, status: res.status });
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
// `note`: something worth saying after a sync that worked (PDF files left behind).
export type SyncStatus = { state: "idle" | "syncing" | "error" | "offline"; lastSynced?: number; error?: string; note?: string };
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
// Signing out stops a sync that's still going: it must not write to this
// device, or to the account, after the person has left.
let generation = 0;
class Stopped extends Error {}
type Live = () => void; // throws once the sync has been stopped

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
  const uid = (await sessionUser())?.id;
  if (!uid) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return setStatus({ ...status, state: "offline" });
  setStatus({ ...status, state: "syncing", error: undefined });
  const mine = generation;
  const live: Live = () => {
    if (mine !== generation) throw new Stopped();
  };
  try {
    const left = await uploadFiles(uid, live);
    await upload(uid, live);
    await download(uid, live);
    live();
    setStatus({ state: "idle", lastSynced: Date.now(), note: fileNote(left) });
  } catch (e) {
    if (mine !== generation) return; // signed out meanwhile: nothing to report
    if (e instanceof CloudOffline) return setStatus({ ...status, state: "offline" });
    setStatus({ ...status, state: "error", error: explainSync(e) });
  }
}

// ---- Signing out ----
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Uploads what isn't synced yet, then signs out; with `removeFromDevice`,
// Stack's data is removed from this device too. It always finishes: the last
// upload gets a few seconds (longer when the data is about to be removed),
// not for ever. Resolves to the number of changes that didn't reach the
// account; with removeFromDevice (and not force) nothing is signed out if
// that isn't 0, because removing them would lose them.
export async function signOutAndStop(removeFromDevice: boolean, force = false) {
  await Promise.race([syncNow().catch(() => {}), pause(removeFromDevice && !force ? 20_000 : 4_000)]);
  const unsynced = Object.keys(await pendingChanges()).length;
  if (removeFromDevice && unsynced > 0 && !force) return { unsynced, signedOut: false };
  generation++; // a sync still going stops here
  retryAt.clear();
  await signOutCloud();
  if (removeFromDevice) await clearLocalData();
  setStatus({ state: "idle" });
  return { unsynced, signedOut: true };
}

// Plain words for sync failures people can act on.
function explainSync(e: unknown) {
  const { code = "", status: http } = e as { code?: string; status?: number };
  // No table, or no permission on it: supabase/schema.sql hasn't been run.
  if (["42P01", "42501", "PGRST205"].includes(code) || http === 404)
    return "the account’s database isn’t set up to accept Stack yet (supabase/schema.sql hasn’t been run). Your data is safe on this phone.";
  if (http === 401 || code.startsWith("PGRST30")) return "your sign-in expired. Sign out and sign in again.";
  return (e as Error).message ?? String(e);
}

// ---- PDF files ----
type Left = { big: number; failed: number };
// A file that didn't go up waits before it's tried again (until Stack restarts).
const RETRY_AFTER = 30 * 60_000;
const retryAt = new Map<string, number>();

// Sends every PDF file that's on this device and not in Storage yet. A file
// that can't go up (too big, or Storage said no) never holds back the rest of
// the sync: it stays on this device and the Account screen says so.
async function uploadFiles(uid: string, live: Live): Promise<Left> {
  const left: Left = { big: 0, failed: 0 };
  const files = new Set((await get<string[]>(filesKey(uid))) ?? []);
  const changes = await pendingChanges();
  for (const id of (await readLocal("pdfs")).keys()) {
    if (files.has(id) || changes[changeKey("pdfs", id)]?.op === "del") continue;
    const blob = await get<Blob>(`pdf:${id}`);
    if (!blob) continue; // from another device, not opened here yet
    if (blob.size > MAX_PDF_BYTES) {
      left.big++;
      continue;
    }
    if ((retryAt.get(id) ?? 0) > Date.now()) {
      left.failed++;
      continue;
    }
    live();
    try {
      await uploadPdf(uid, id, blob);
    } catch (e) {
      live();
      if (e instanceof CloudOffline) throw e;
      retryAt.set(id, Date.now() + RETRY_AFTER);
      left.failed++;
      continue;
    }
    live();
    files.add(id);
    await set(filesKey(uid), [...files]);
    await track("pdfs", id); // its row says the file is there now
  }
  return left;
}

function fileNote({ big, failed }: Left) {
  const parts: string[] = [];
  if (big) parts.push(`${big} PDF${big > 1 ? "s are" : " is"} over 50 MB and stay${big > 1 ? "" : "s"} on this phone only.`);
  if (failed) parts.push(`${failed} PDF file${failed > 1 ? "s" : ""} couldn’t be uploaded yet. Stack will try again later.`);
  return parts.join(" ") || undefined;
}

async function upload(uid: string, live: Live) {
  const db = cloud()!;
  const changes = await pendingChanges();
  const keysToSend = Object.keys(changes);
  if (!keysToSend.length) return;

  const locals = new Map<Collection, Map<string, Item>>();
  for (const col of COLLECTIONS) locals.set(col, await readLocal(col));
  const files = new Set((await get<string[]>(filesKey(uid))) ?? []);

  const rows: Row[] = [];
  for (const key of keysToSend) {
    const slash = key.indexOf("/");
    const col = key.slice(0, slash) as Collection;
    const id = key.slice(slash + 1);
    const item = locals.get(col)?.get(id);
    if (changes[key].op === "del" || !item) {
      rows.push({ collection: col, key: rowKey(id), id, data: null, deleted: true });
      if (col === "pdfs") {
        live();
        // A file that can't be removed now is left behind rather than blocking the sync.
        await removePdf(uid, id).catch((e) => {
          if (e instanceof CloudOffline) throw e;
        });
        files.delete(id);
      }
      continue;
    }
    let data: Record<string, unknown> = item;
    // The cover rides along, and `file` tells other devices they can download the PDF.
    if (col === "pdfs") data = { ...item, cover: (await get<string>(`cover:${id}`)) ?? null, file: files.has(id) };
    rows.push({ collection: col, key: rowKey(id), id, data: clean(data), deleted: false });
  }

  // In small requests: covers and photos make some rows large.
  let batch: Row[] = [];
  let size = 0;
  const send = async () => {
    if (!batch.length) return;
    live();
    const sent = batch.map((r) => ({ user_id: uid, ...r }));
    ok(await db.from("items").upsert(sent, { onConflict: "user_id,collection,key" }));
    batch = [];
    size = 0;
  };
  for (const r of rows) {
    const bytes = JSON.stringify(r.data).length;
    if (batch.length >= 100 || size + bytes > 1_500_000) await send();
    batch.push(r);
    size += bytes;
  }
  await send();
  live();
  await set(filesKey(uid), [...files]);
  await clearChanges(changes);
}

async function download(uid: string, live: Live) {
  const db = cloud()!;
  let since = (await get<number>(seqKey(uid))) ?? 0;
  const rows: (Row & { seq: number })[] = [];
  for (;;) {
    live();
    const page = ok<(Row & { seq: number })[] | null>(
      await db
        .from("items")
        .select("collection,key,id,data,deleted,seq")
        .eq("user_id", uid)
        .gt("seq", since)
        .order("seq")
        .limit(PAGE),
    ) ?? [];
    rows.push(...page);
    if (page.length < PAGE) break;
    since = page[page.length - 1].seq;
  }
  live();
  if (!rows.length) return;

  // Not uploaded yet here → keep ours (it's uploaded next time).
  const pending: Changes = await pendingChanges();
  const files = new Set((await get<string[]>(filesKey(uid))) ?? []);
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
      const { cover, file, ...meta } = item as Item & { cover?: string | null; file?: boolean };
      if (cover) await set(`cover:${r.id}`, cover);
      if (file) files.add(r.id); // in Storage; downloaded when opened
      bucket.puts.push(meta as Item);
    } else {
      bucket.puts.push(item);
    }
  }
  for (const [col, { puts, dels }] of byCol) await writeLocal(col, puts, dels);
  await set(filesKey(uid), [...files]);
  await set(seqKey(uid), rows[rows.length - 1].seq);
  emit();
}

// A PDF from another device: fetch its file on first open.
export async function downloadPdf(id: string): Promise<Blob | null> {
  // Opened right after start-up: this waits until the saved sign-in is restored.
  const uid = (await sessionUser())?.id;
  if (!uid) return null;
  return fetchPdf(uid, id).catch(() => null);
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
  const marks = (await keys()).filter((k) => typeof k === "string" && k.startsWith("sync:"));
  await Promise.all([...COLLECTIONS, ...marks].map((k) => del(k)));
  emit();
}

// Registered at start-up (not after sign-in): the PDF reader may ask before
// the saved sign-in has been restored; downloadPdf waits for it.
setBlobFetcher(downloadPdf);
