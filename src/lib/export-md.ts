"use client";

// Notes and highlights as Markdown, to keep or to paste into Obsidian, Notion,
// Logseq… Highlights are grouped under their article or PDF, each with a link
// back to the original page.
import { registerPlugin } from "@capacitor/core";
import type { Note } from "./db";
import { linkUrl, webUrl } from "./news";
import { isNative } from "./platform";

type FilesPlugin = {
  create(opts: { name: string; mime?: string }): Promise<{ uri: string }>;
  write(opts: { uri: string; text: string; append?: boolean }): Promise<void>;
  shareText(opts: { title: string; text: string }): Promise<void>;
};
const Files = registerPlugin<FilesPlugin>("Backup");

// Where a note's source lives on the web, if anywhere.
export function sourceUrl(n: Note): string | undefined {
  const id = n.articleId;
  if (!id) return undefined;
  const hn = id.match(/^hn-(\d+)$/);
  if (hn) return `https://news.ycombinator.com/item?id=${hn[1]}`;
  if (id.startsWith("yt-")) return `https://www.youtube.com/watch?v=${id.slice(3)}`;
  return webUrl(id) ?? linkUrl(id) ?? undefined;
}

const day = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const quote = (s: string) =>
  s
    .trim()
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");

function noteBody(n: Note) {
  const out: string[] = [];
  if (n.quote) out.push(quote(n.quote) + (n.page ? ` (p. ${n.page})` : ""));
  if (n.body?.trim()) out.push(n.body.trim());
  if (n.checklist?.length) out.push(n.checklist.map((c) => `- [${c.done ? "x" : " "}] ${c.text}`).join("\n"));
  return out.join("\n\n");
}

export function notesToMarkdown(notes: Note[], now = Date.now()) {
  const lines = [`# Stack notes`, "", `Exported ${day(now)} · ${notes.length} note${notes.length === 1 ? "" : "s"}`, ""];

  // Highlights and notes from articles and PDFs, one section per source.
  const bySource = new Map<string, Note[]>();
  const own: Note[] = [];
  for (const n of [...notes].sort((a, b) => a.createdAt - b.createdAt)) {
    if (n.sourceTitle && (n.articleId || n.pdfId)) {
      const key = n.pdfId ? `pdf:${n.pdfId}` : `a:${n.articleId}`;
      bySource.set(key, [...(bySource.get(key) ?? []), n]);
    } else own.push(n);
  }

  for (const group of bySource.values()) {
    const first = group[0];
    const url = sourceUrl(first);
    lines.push(`## ${first.sourceTitle}`, "");
    const meta = [first.sourceLabel, url ? `[Original](${url})` : first.pdfId ? "PDF" : null].filter(Boolean);
    if (meta.length) lines.push(`*${meta.join(" · ")}*`, "");
    for (const n of group) {
      lines.push(noteBody(n), "");
    }
  }

  if (own.length) {
    lines.push("## My notes", "");
    for (const n of own) {
      lines.push(`### ${n.title?.trim() || (n.kind === "music" ? n.sourceTitle ?? "Music note" : day(n.createdAt))}`, "");
      const body = noteBody(n);
      if (body) lines.push(body, "");
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

const fileName = () => `stack-notes-${new Date().toISOString().slice(0, 10)}.md`;

/** Saves a .md file: Android asks where; the website downloads it. */
export async function saveMarkdown(md: string): Promise<"saved" | "cancelled"> {
  if (isNative()) {
    try {
      const { uri } = await Files.create({ name: fileName(), mime: "text/markdown" });
      await Files.write({ uri, text: md });
      return "saved";
    } catch {
      return "cancelled";
    }
  }
  const url = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "saved";
}

/** Sends the Markdown to another app. Returns false if it could only copy it. */
export async function shareMarkdown(md: string): Promise<boolean> {
  if (isNative()) {
    await Files.shareText({ title: "Stack notes", text: md });
    return true;
  }
  if (navigator.share) {
    await navigator.share({ title: "Stack notes", text: md });
    return true;
  }
  await navigator.clipboard.writeText(md);
  return false;
}
