"use client";

// Backup and restore: everything in Stack as one .json file you keep yourself,
// no account needed. Optionally with the PDF files (bigger, but complete).
// Restoring adds the backup to what's on this device; an item that exists in
// both is replaced by the backup's copy.
import { get, set, update } from "idb-keyval";
import { registerPlugin } from "@capacitor/core";
import { emit } from "./db";
import { isNative } from "./platform";
import { track, type Collection } from "./sync-state";

type BackupPlugin = {
  create(opts: { name: string }): Promise<{ uri: string }>;
  write(opts: { uri: string; text: string; append?: boolean }): Promise<void>;
};
const Native = registerPlugin<BackupPlugin>("Backup");

const LISTS = ["notes", "saved", "pdfs", "playlists", "focus", "feeds"] as const satisfies readonly Collection[];
// Settings worth keeping. Sign-in tokens and running timers are left out.
const LOCAL = [
  "stack.theme",
  "stack.news-topic",
  "stack.news-view",
  "stack.music-source",
  "stack.reminder",
  "stack.review.streak",
  "stack.spotify.clientId",
  "stack.search.recent",
  "stack.onboarded",
  "stack.reading",
  "stack.news-alerts",
  "stack.ai.off",
];

type Item = { id: string } & Record<string, unknown>;
type FileEntry = { type: string; b64: string } | { text: string };

export type Backup = {
  app: "stack";
  version: 1;
  exportedAt: number;
  data: Partial<Record<(typeof LISTS)[number], Item[]>> & { profile?: Item | null };
  local: Record<string, string>;
  files?: Record<string, FileEntry>;
};

export type Summary = { notes: number; highlights: number; saved: number; pdfs: number; pdfFiles: number; playlists: number; focus: number; feeds: number; exportedAt: number };

const b64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export async function pdfFilesSize() {
  const pdfs = (await get<Item[]>("pdfs")) ?? [];
  const blobs = await Promise.all(pdfs.map((p) => get<Blob>(`pdf:${p.id}`)));
  return blobs.reduce((sum, b) => sum + (b?.size ?? 0), 0);
}

// The backup as a list of text pieces (the PDFs can be large).
async function* pieces(withPdfs: boolean): AsyncGenerator<string> {
  const data: Backup["data"] = {};
  for (const col of LISTS) data[col] = (await get<Item[]>(col)) ?? [];
  data.profile = (await get<Item>("profile")) ?? null;
  const local: Record<string, string> = {};
  for (const k of LOCAL) {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) local[k] = v;
    } catch {}
  }
  yield `{"app":"stack","version":1,"exportedAt":${Date.now()},"data":${JSON.stringify(data)},"local":${JSON.stringify(local)},"files":{`;
  let first = true;
  for (const p of data.pdfs ?? []) {
    const cover = await get<string>(`cover:${p.id}`);
    if (cover) {
      yield `${first ? "" : ","}${JSON.stringify(`cover:${p.id}`)}:${JSON.stringify({ text: cover })}`;
      first = false;
    }
    if (!withPdfs) continue;
    const blob = await get<Blob>(`pdf:${p.id}`);
    if (!blob) continue;
    yield `${first ? "" : ","}${JSON.stringify(`pdf:${p.id}`)}:{"type":${JSON.stringify(blob.type || "application/pdf")},"b64":"`;
    // In slices, so one big PDF doesn't become one huge string.
    const SLICE = 3 * 256 * 1024; // a multiple of 3 keeps each base64 piece whole
    for (let at = 0; at < blob.size; at += SLICE) yield await b64(blob.slice(at, at + SLICE));
    yield `"}`;
    first = false;
  }
  yield "}}";
}

const fileName = () => `stack-backup-${new Date().toISOString().slice(0, 10)}.json`;

// Saves the backup: Android asks where; the website downloads it.
export async function saveBackup(withPdfs: boolean): Promise<"saved" | "cancelled"> {
  if (isNative()) {
    let uri: string;
    try {
      ({ uri } = await Native.create({ name: fileName() }));
    } catch {
      return "cancelled";
    }
    let buf = "";
    let append = false;
    for await (const p of pieces(withPdfs)) {
      buf += p;
      if (buf.length >= 512 * 1024) {
        await Native.write({ uri, text: buf, append });
        buf = "";
        append = true;
      }
    }
    await Native.write({ uri, text: buf, append });
    return "saved";
  }
  const parts: string[] = [];
  for await (const p of pieces(withPdfs)) parts.push(p);
  const url = URL.createObjectURL(new Blob(parts, { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "saved";
}

// Reads and checks a backup file.
export async function readBackup(file: File): Promise<{ backup: Backup; summary: Summary } | { error: string }> {
  let backup: Backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    return { error: "That file isn’t a Stack backup." };
  }
  if (backup?.app !== "stack" || typeof backup.data !== "object") return { error: "That file isn’t a Stack backup." };
  if (backup.version > 1) return { error: "This backup is from a newer Stack. Update the app first." };
  const d = backup.data;
  const notes = d.notes ?? [];
  return {
    backup,
    summary: {
      notes: notes.filter((n) => !n.quote).length,
      highlights: notes.filter((n) => n.quote).length,
      saved: d.saved?.length ?? 0,
      pdfs: d.pdfs?.length ?? 0,
      pdfFiles: Object.keys(backup.files ?? {}).filter((k) => k.startsWith("pdf:")).length,
      playlists: d.playlists?.length ?? 0,
      focus: d.focus?.length ?? 0,
      feeds: d.feeds?.length ?? 0,
      exportedAt: backup.exportedAt,
    },
  };
}

export async function restoreBackup(backup: Backup) {
  for (const col of LISTS) {
    const items = (backup.data[col] ?? []).filter((x): x is Item => !!x && typeof x.id === "string");
    if (!items.length) continue;
    const incoming = new Map(items.map((x) => [x.id, x]));
    await update<Item[]>(col, (all) => [...(all ?? []).filter((x) => !incoming.has(x.id)), ...incoming.values()]);
    await track(col, [...incoming.keys()]);
  }
  const profile = backup.data.profile;
  if (profile) {
    const mine = await get<Item>("profile");
    if (!mine || Number(profile.updatedAt ?? 0) >= Number(mine.updatedAt ?? 0)) {
      await set("profile", { ...profile, id: "me" });
      await track("profile", "me");
    }
  }
  for (const [key, entry] of Object.entries(backup.files ?? {})) {
    if (!/^(pdf|cover):[\w.-]+$/.test(key)) continue;
    if ("text" in entry) await set(key, entry.text);
    else {
      const bytes = Uint8Array.from(atob(entry.b64), (c) => c.charCodeAt(0));
      await set(key, new Blob([bytes], { type: entry.type || "application/pdf" }));
    }
  }
  for (const [k, v] of Object.entries(backup.local ?? {})) {
    if (!LOCAL.includes(k) || typeof v !== "string") continue;
    try {
      localStorage.setItem(k, v);
    } catch {}
  }
  emit();
}
