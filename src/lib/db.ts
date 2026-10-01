"use client";

// Local-first storage. Everything lives in this browser's IndexedDB:
// notes, saved articles, PDF files and their covers. Nothing is sent to a server.
import { get, set, del, update } from "idb-keyval";
import { fetchBlob, track } from "./sync-state";

export type NoteKind = "article" | "pdf" | "idea" | "music";
export type NoteColor = "default" | "ink" | "green" | "orange" | "red" | "blue";
export type ChecklistItem = { id: string; text: string; done: boolean };
// A sticky note stuck on a PDF page. x and y are the top-left corner as a
// fraction of the page (0–1), so it stays put at any zoom.
export type Sticky = { x: number; y: number; type: "note" | "flag" | "question"; size: "s" | "m" | "l" };
// How a PDF's pages are shown: contrast and brightness are percentages.
export type PdfView = { mode: "normal" | "sepia" | "dark" | "grey"; contrast: number; brightness: number };
export type Bookmark = { page: number; label?: string; at: number };
// Daily review schedule for a highlight (see lib/review.ts).
export type Review = { due: number; interval: number; reps: number; off?: boolean };

export type Note = {
  id: string;
  kind: NoteKind;
  title?: string;
  checklist?: ChecklistItem[]; // set when the note is a list
  color?: NoteColor; // unset: ideas are ink, the rest are plain cards
  pinned?: boolean;
  font?: string; // a name from lib/note-fonts.ts; unset is the default font
  updatedAt?: number;
  review?: Review;
  quote?: string; // text highlighted in an article or PDF
  body?: string; // the user's own words
  highlight?: boolean; // a highlight with no comment
  sourceTitle?: string;
  sourceLabel?: string; // "Hacker News", "dev.to", "Spotify"…
  href?: string; // where tapping the note takes you inside Stack
  articleId?: string;
  pdfId?: string;
  page?: number;
  sticky?: Sticky; // set when the note sits on the PDF page itself
  createdAt: number;
};

export type PdfMeta = {
  id: string;
  title: string;
  shelf: string;
  pages: number;
  lastPage: number;
  addedAt: number;
  lastOpenedAt?: number;
  sourceUri?: string; // set when imported from a phone folder
  bookmarks?: Bookmark[];
  view?: PdfView;
  coverStyle?: "stack"; // a plain Stack cover instead of the cover picture
};

export type SavedArticle = {
  id: string;
  title: string;
  source: string;
  image?: string;
  savedAt: number;
  shared?: boolean; // came in through "Share to Stack"
};

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// A tiny change feed so every screen re-reads after a write.
const listeners = new Set<() => void>();
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const emit = () => listeners.forEach((fn) => fn());

// ---- Notes ----
export async function getNotes(): Promise<Note[]> {
  const notes = (await get<Note[]>("notes")) ?? [];
  // Most recently edited first, like other notes apps.
  return notes.sort(
    (a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
  );
}

export async function addNote(note: Omit<Note, "id" | "createdAt">) {
  const full: Note = { ...note, id: uid(), createdAt: Date.now() };
  await update<Note[]>("notes", (all) => [...(all ?? []), full]);
  await track("notes", full.id);
  emit();
  return full;
}

export async function getNote(id: string) {
  return ((await get<Note[]>("notes")) ?? []).find((n) => n.id === id) ?? null;
}

export async function updateNote(id: string, patch: Partial<Note>) {
  await update<Note[]>("notes", (all) =>
    (all ?? []).map((n) =>
      n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n,
    ),
  );
  await track("notes", id);
  emit();
}

// Review progress isn't an edit, so it leaves updatedAt (the notes order) alone.
export async function setReview(id: string, review: Review) {
  await update<Note[]>("notes", (all) =>
    (all ?? []).map((n) => (n.id === id ? { ...n, review } : n)),
  );
  await track("notes", id);
  emit();
}

// Puts a deleted note back (Undo).
export async function restoreNote(note: Note) {
  await update<Note[]>("notes", (all) => [
    ...(all ?? []).filter((n) => n.id !== note.id),
    note,
  ]);
  await track("notes", note.id);
  emit();
}

export async function deleteNote(id: string) {
  await update<Note[]>("notes", (all) => (all ?? []).filter((n) => n.id !== id));
  await track("notes", id, "del");
  emit();
}

// ---- PDFs ----
export async function getPdfs(): Promise<PdfMeta[]> {
  return (await get<PdfMeta[]>("pdfs")) ?? [];
}

export async function getPdf(id: string) {
  const [meta, blob] = await Promise.all([
    getPdfs().then((all) => all.find((p) => p.id === id)),
    get<Blob>(`pdf:${id}`),
  ]);
  if (!meta) return null;
  if (blob) return { meta, blob };
  // Synced from another device: download the file once.
  const remote = await fetchBlob(id).catch(() => null);
  if (!remote) return null;
  await set(`pdf:${id}`, remote);
  return { meta, blob: remote };
}

export async function getCover(id: string) {
  return get<string>(`cover:${id}`);
}

// A new cover picture (a page of the PDF, or a photo). It syncs with the PDF's row.
export async function setCover(id: string, cover: string) {
  await set(`cover:${id}`, cover);
  await updatePdf(id, { coverStyle: undefined });
}

export async function addPdf(
  file: Blob,
  meta: Omit<PdfMeta, "id" | "addedAt" | "lastPage">,
  cover?: string,
) {
  const id = uid();
  await set(`pdf:${id}`, file);
  if (cover) await set(`cover:${id}`, cover);
  await update<PdfMeta[]>("pdfs", (all) => [
    ...(all ?? []),
    { ...meta, id, lastPage: 1, addedAt: Date.now() },
  ]);
  await track("pdfs", id);
  emit();
  return id;
}

export async function updatePdf(id: string, patch: Partial<PdfMeta>) {
  await update<PdfMeta[]>("pdfs", (all) =>
    (all ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)),
  );
  await track("pdfs", id);
  emit();
}

export async function deletePdf(id: string) {
  await Promise.all([del(`pdf:${id}`), del(`cover:${id}`)]);
  await update<PdfMeta[]>("pdfs", (all) => (all ?? []).filter((p) => p.id !== id));
  const gone = ((await get<Note[]>("notes")) ?? []).filter((n) => n.pdfId === id).map((n) => n.id);
  await update<Note[]>("notes", (all) => (all ?? []).filter((n) => n.pdfId !== id));
  await track("pdfs", id, "del");
  await track("notes", gone, "del");
  emit();
}

// ---- Saved articles ----
export async function getSaved(): Promise<SavedArticle[]> {
  const saved = (await get<SavedArticle[]>("saved")) ?? [];
  return saved.sort((a, b) => b.savedAt - a.savedAt);
}

export async function toggleSaved(article: Omit<SavedArticle, "savedAt">) {
  let nowSaved = false;
  await update<SavedArticle[]>("saved", (all) => {
    const list = all ?? [];
    if (list.some((a) => a.id === article.id)) {
      return list.filter((a) => a.id !== article.id);
    }
    nowSaved = true;
    return [...list, { ...article, savedAt: Date.now() }];
  });
  await track("saved", article.id, nowSaved ? "put" : "del");
  emit();
  return nowSaved;
}

// Saves an article if it isn't saved yet (sharing the same link twice keeps one).
export async function addSaved(article: Omit<SavedArticle, "savedAt">) {
  await update<SavedArticle[]>("saved", (all) => {
    const list = all ?? [];
    return list.some((a) => a.id === article.id)
      ? list
      : [...list, { ...article, savedAt: Date.now() }];
  });
  await track("saved", article.id);
  emit();
}

export async function updateSaved(id: string, patch: Partial<SavedArticle>) {
  await update<SavedArticle[]>("saved", (all) =>
    (all ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)),
  );
  await track("saved", id);
  emit();
}
