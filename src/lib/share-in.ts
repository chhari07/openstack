"use client";

// "Share to Stack" (Android app). Other apps' share sheets open a small card
// over that app (native/android/ShareActivity.java), which puts the item in an
// inbox; Stack imports the inbox here: links to the Library, PDFs to the
// "Shared" shelf, text to Notes.
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { addNote, addPdf, addSaved, getSaved, updateSaved } from "./db";
import { linkId } from "./news";
import { inspectPdf } from "./pdf";
import { loadArticle } from "./platform";
import { safeImage } from "./use-news";

export type SharedItem =
  | { kind: "text"; text: string; subject?: string }
  | { kind: "pdf"; path: string; name: string };

type ShareInPlugin = {
  takeInbox(): Promise<{ items: SharedItem[]; open: boolean }>;
  ackInbox(opts: { count: number }): Promise<void>;
  removeFile(opts: { path: string }): Promise<void>;
  addListener(event: "shared", fn: () => void): Promise<PluginListenerHandle>;
};

export const ShareIn = registerPlugin<ShareInPlugin>("ShareIn");

// What the "Saved" screen shows: the last imported item.
export const RESULT_KEY = "stack.shared.result";

export type ShareResult =
  | { kind: "link"; id: string; url: string; title: string; site: string; image?: string; video: boolean }
  | { kind: "note"; noteId: string; text: string }
  | { kind: "pdf"; pdfId: string; title: string; pages: number }
  | { kind: "error"; message: string };

// First http(s) link in shared text ("Look at this https://…" → the link).
export function findUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!m) return null;
  const url = m[0].replace(/[).,;!?]+$/, "");
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

export const isVideo = (url: string) =>
  /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/i.test(new URL(url).hostname);

export const siteName = (url: string) => new URL(url).hostname.replace(/^(www|m)\./, "");

// Fills in a shared link's real title and picture (the phone fetches the page).
async function enrichLink(id: string) {
  const a = await loadArticle(id).catch(() => null);
  if (!a) return;
  const title = a.title && a.title !== new URL(a.url).hostname ? a.title : undefined;
  const image = safeImage(a.image);
  if (title || image) await updateSaved(id, { ...(title ? { title } : {}), ...(image ? { image } : {}) });
}

// Saves one shared item into Stack.
export async function importShared(item: SharedItem): Promise<ShareResult> {
  if (item.kind === "pdf") {
    try {
      const res = await fetch(Capacitor.convertFileSrc(item.path));
      if (!res.ok) throw new Error(`read ${res.status}`);
      const file = new File([await res.blob()], item.name, { type: "application/pdf" });
      const { title, pages, cover } = await inspectPdf(file);
      const pdfId = await addPdf(file, { title, pages, shelf: "Shared" }, cover);
      return { kind: "pdf", pdfId, title, pages };
    } catch {
      return { kind: "error", message: "That file couldn’t be opened as a PDF." };
    } finally {
      ShareIn.removeFile({ path: item.path }).catch(() => {});
    }
  }

  const url = findUrl(item.text);
  if (!url) {
    const note = await addNote({ kind: "idea", title: item.subject?.trim() || undefined, body: item.text.trim() });
    return { kind: "note", noteId: note.id, text: item.text.trim() };
  }

  const id = linkId(url);
  const site = siteName(url);
  // Chrome sends the page title as the subject; other apps put words around the link.
  const words = item.text.replace(url, "").trim();
  const title = item.subject?.trim() || (words.length > 3 && words.length < 160 ? words : site);
  await addSaved({ id, title, source: site, shared: true });
  enrichLink(id);
  // Shared before: show what's already in the Library.
  const kept = (await getSaved()).find((a) => a.id === id);
  return { kind: "link", id, url, title: kept?.title ?? title, site, image: kept?.image, video: isVideo(url) };
}

export const resultTitle = (r: ShareResult) =>
  r.kind === "link" || r.kind === "pdf" ? r.title : r.kind === "note" ? r.text.slice(0, 60) : "";
