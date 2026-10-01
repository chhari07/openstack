"use client";

import Link from "next/link";
import type { Note, NoteColor } from "@/lib/db";
import { noteTime } from "@/lib/format";
import { fontFamily, useCustomFonts } from "@/lib/note-fonts";
import { PinIcon } from "./icons";

// Note colours use the app's tokens, so they follow light and dark mode.
export const COLORS: { value: NoteColor; label: string; cls: string; swatch: string }[] = [
  { value: "default", label: "Plain", cls: "bg-card text-ink", swatch: "bg-card" },
  { value: "ink", label: "Ink", cls: "bg-ink text-on-ink", swatch: "bg-ink" },
  { value: "green", label: "Green", cls: "bg-news-tint text-ink", swatch: "bg-news-tint" },
  { value: "orange", label: "Orange", cls: "bg-pdf-tint text-ink", swatch: "bg-pdf-tint" },
  { value: "red", label: "Red", cls: "bg-music-tint text-ink", swatch: "bg-music-tint" },
  { value: "blue", label: "Blue", cls: "bg-blue-tint text-ink", swatch: "bg-blue-tint" },
];

// Older ideas were always dark, so an unset colour keeps that look.
export const colorOf = (n: Pick<Note, "color" | "kind">): NoteColor =>
  n.color ?? (n.kind === "idea" ? "ink" : "default");
export const colorCls = (c: NoteColor) =>
  COLORS.find((x) => x.value === c)?.cls ?? COLORS[0].cls;

const SOURCE: Record<Note["kind"], ((n: Note) => string) | null> = {
  article: () => "Article",
  pdf: (n) => `PDF · p.${n.page}`,
  music: () => "Music",
  idea: null,
};

export const noteHref = (id: string) => `/notes/edit?id=${id}`;

export function noteText(n: Note) {
  return [
    n.title,
    n.quote && `“${n.quote}”`,
    n.body,
    ...(n.checklist ?? []).map((i) => `${i.done ? "☑" : "☐"} ${i.text}`),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function NoteCard({ note, compact = false }: { note: Note; compact?: boolean }) {
  const color = colorOf(note);
  const dark = color === "ink";
  const source = SOURCE[note.kind]?.(note);
  const items = note.checklist ?? [];
  const open = items.filter((i) => !i.done);
  const done = items.length - open.length;
  const muted = dark ? "text-on-ink/65" : "text-muted";
  useCustomFonts(); // so a font the person added shows here too

  return (
    <Link
      href={noteHref(note.id)}
      className={`relative flex w-full flex-col gap-2 rounded-[14px] p-3.5 text-left ${colorCls(color)}`}
      style={{ fontFamily: fontFamily(note.font) }}
    >
      {note.pinned && (
        <PinIcon size={14} filled className={`absolute top-3 right-3 ${muted}`} />
      )}
      {source && (
        <span className="label self-start rounded-[10px] bg-paper/70 px-2 py-1 text-[9px] text-ink">
          {source}
        </span>
      )}
      {note.title && (
        <span className="pr-4 text-[17px] leading-[1.2] font-bold [font-stretch:87%]">
          {note.title}
        </span>
      )}
      {note.quote && (
        <span
          className={`${compact ? "line-clamp-4" : "line-clamp-6"} ${
            note.kind === "pdf"
              ? "font-serif text-[16px] leading-[1.35] italic"
              : "text-[14px] leading-[1.4]"
          }`}
        >
          “{note.quote}”
        </span>
      )}
      {note.body && (
        <span
          className={`whitespace-pre-line ${compact ? "line-clamp-4" : "line-clamp-[10]"} ${
            !note.title && !note.quote && dark
              ? "text-[18px] leading-[1.2] font-bold [font-stretch:87%]"
              : `text-[14px] leading-[1.4] ${note.quote ? `border-t border-line pt-2 ${muted}` : ""}`
          }`}
        >
          {note.body}
        </span>
      )}
      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {open.slice(0, compact ? 3 : 6).map((i) => (
            <li key={i.id} className="flex items-start gap-2 text-[14px] leading-[1.35]">
              <span className="mt-[3px] size-3.5 shrink-0 rounded-[4px] border-[1.5px] border-current opacity-60" />
              <span className="line-clamp-2">{i.text || " "}</span>
            </li>
          ))}
          {open.length > (compact ? 3 : 6) && (
            <li className={`text-[13px] ${muted}`}>+ {open.length - (compact ? 3 : 6)} more</li>
          )}
          {done > 0 && (
            <li className={`text-[13px] ${muted}`}>
              + {done} checked item{done > 1 ? "s" : ""}
            </li>
          )}
        </ul>
      )}
      <span className={`label text-[9px] ${muted}`}>
        {note.sourceTitle
          ? `${note.sourceTitle.slice(0, 28)}${note.sourceTitle.length > 28 ? "…" : ""} · `
          : ""}
        {noteTime(note.updatedAt ?? note.createdAt)}
      </span>
    </Link>
  );
}
