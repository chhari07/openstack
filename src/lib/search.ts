"use client";

// Search everything on the device: notes, highlights, saved articles, PDFs
// and playlists. Every word you type has to appear somewhere in the item;
// case and accents don't matter.
import { getNotes, getPdfs, getSaved } from "./db";
import { getPlaylists } from "./playlists";

export type Kind = "note" | "highlight" | "article" | "pdf" | "playlist";

export type Hit = {
  kind: Kind;
  id: string;
  title: string;
  snippet?: string; // the matching bit of the text, when it isn't the title
  meta?: string; // source, shelf, number of songs…
  href: string;
  score: number;
  at: number; // for ordering equal scores: newest first
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const terms = (q: string) => fold(q).split(/\s+/).filter(Boolean);

// A short piece of `text` around the first match.
function snippet(text: string, words: string[]) {
  const flat = text.replace(/\s+/g, " ").trim();
  const f = fold(flat);
  const at = Math.min(...words.map((w) => f.indexOf(w)).filter((i) => i >= 0));
  if (!Number.isFinite(at)) return undefined;
  const start = Math.max(0, at - 50);
  const end = Math.min(flat.length, at + 110);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

// Title matches count most, then the start of a word, then anywhere.
function score(title: string, body: string, words: string[]) {
  const t = fold(title);
  const all = `${t} ${fold(body)}`;
  if (!words.every((w) => all.includes(w))) return 0;
  let s = 1;
  for (const w of words) {
    if (t.includes(w)) s += 4;
    if (new RegExp(`(^|\\W)${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(all)) s += 1;
  }
  return s;
}

export async function searchAll(q: string): Promise<Hit[]> {
  const words = terms(q);
  if (!words.length) return [];
  const [notes, saved, pdfs, playlists] = await Promise.all([getNotes(), getSaved(), getPdfs(), getPlaylists()]);
  const hits: Hit[] = [];

  for (const n of notes) {
    const list = (n.checklist ?? []).map((i) => i.text).join(" · ");
    const body = [n.quote, n.body, list, n.sourceTitle].filter(Boolean).join(" \n");
    const title = n.title || (n.quote ? n.sourceTitle : undefined) || "";
    const s = score(title, body, words);
    if (!s) continue;
    const highlight = !!n.quote;
    hits.push({
      kind: highlight ? "highlight" : "note",
      id: n.id,
      title: title || (n.body ?? list).split("\n")[0].slice(0, 80) || "Note",
      snippet: snippet(highlight ? `“${n.quote}” ${n.body ?? ""}` : [n.body, list].filter(Boolean).join(" · "), words),
      meta: highlight ? [n.sourceLabel, n.page ? `p. ${n.page}` : ""].filter(Boolean).join(" · ") : undefined,
      href: highlight && n.href ? n.href : `/notes/edit?id=${n.id}`,
      score: s,
      at: n.updatedAt ?? n.createdAt,
    });
  }

  for (const a of saved) {
    const s = score(a.title, a.source, words);
    if (s) hits.push({ kind: "article", id: a.id, title: a.title, meta: a.source, href: `/read?id=${a.id}`, score: s, at: a.savedAt });
  }

  for (const p of pdfs) {
    const s = score(p.title, p.shelf ?? "", words);
    if (s)
      hits.push({
        kind: "pdf",
        id: p.id,
        title: p.title,
        meta: [p.shelf, p.lastPage ? `p. ${p.lastPage} / ${p.pages}` : `${p.pages} pages`].filter(Boolean).join(" · "),
        href: `/library/read?id=${p.id}`,
        score: s,
        at: p.lastOpenedAt ?? p.addedAt,
      });
  }

  for (const pl of playlists) {
    const songs = pl.tracks.map((t) => `${t.title} ${t.artist}`).join(" · ");
    const s = score(pl.name, `${pl.description ?? ""} ${songs}`, words);
    if (!s) continue;
    const song = pl.tracks.find((t) => words.every((w) => fold(`${t.title} ${t.artist}`).includes(w)));
    hits.push({
      kind: "playlist",
      id: pl.id,
      title: pl.name,
      snippet: song ? `${song.title} · ${song.artist}` : undefined,
      meta: `${pl.tracks.length} song${pl.tracks.length === 1 ? "" : "s"}`,
      href: `/music/mine?id=${pl.id}`,
      score: s,
      at: pl.updatedAt,
    });
  }

  return hits.sort((a, b) => b.score - a.score || b.at - a.at);
}

// Recent searches, on this device only.
const RECENT_KEY = "stack.search.recent";
export function recentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}
export function rememberSearch(q: string) {
  const t = q.trim();
  if (t.length < 2) return;
  try {
    const next = [t, ...recentSearches().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
}
export function clearSearches() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {}
}

// ---- For "Ask your Stack" (Stack AI) ----
// Looser than searchAll: a question like "what have I read about focus?"
// should still find notes that mention focus. Common words are ignored and an
// item counts if it has any of the remaining words.
const STOP = new Set(
  "a an and are about as at be by can did do does for from have how i in is it me my of on or so that the this to was what when where which who why with you your read reading notes note say said know tell".split(
    " ",
  ),
);

export type Passage = { id: string; title: string; text: string; href: string };

export async function relevant(q: string, limit = 25): Promise<Passage[]> {
  const words = terms(q).map((w) => w.replace(/[^\p{L}\p{N}-]/gu, "")).filter((w) => w.length > 1 && !STOP.has(w));
  const [notes, saved, pdfs] = await Promise.all([getNotes(), getSaved(), getPdfs()]);
  const items: (Passage & { at: number })[] = [
    ...notes.map((n) => ({
      id: `note:${n.id}`,
      title: n.title || n.sourceTitle || (n.quote ? "Highlight" : "Note"),
      text: [n.quote && `“${n.quote}”`, n.body, (n.checklist ?? []).map((i) => `- ${i.text}`).join("\n"), n.sourceTitle && `Source: ${n.sourceTitle}${n.page ? `, p. ${n.page}` : ""}`]
        .filter(Boolean)
        .join("\n"),
      href: n.quote && n.href ? n.href : `/notes/edit?id=${n.id}`,
      at: n.updatedAt ?? n.createdAt,
    })),
    ...saved.map((a) => ({ id: `article:${a.id}`, title: a.title, text: `Saved article from ${a.source}: ${a.title}`, href: `/read?id=${a.id}`, at: a.savedAt })),
    ...pdfs.map((p) => ({ id: `pdf:${p.id}`, title: p.title, text: `PDF in the library${p.shelf ? ` (shelf: ${p.shelf})` : ""}: ${p.title}, read to page ${p.lastPage} of ${p.pages}`, href: `/library/read?id=${p.id}`, at: p.lastOpenedAt ?? p.addedAt })),
  ];
  // No useful words (or nothing matches): the most recent things instead.
  const scored = items
    .map((it) => {
      const t = fold(it.title);
      const all = `${t} ${fold(it.text)}`;
      return { it, s: words.reduce((n, w) => n + (all.includes(w) ? 1 : 0) + (t.includes(w) ? 1 : 0), 0) };
    })
    .filter((x) => !words.length || x.s > 0);
  const pool = scored.length ? scored : items.map((it) => ({ it, s: 0 }));
  return pool
    .sort((a, b) => b.s - a.s || b.it.at - a.it.at)
    .slice(0, limit)
    .map(({ it }) => ({ id: it.id, title: it.title, text: it.text, href: it.href }));
}
