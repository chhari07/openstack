"use client";

// Fonts for notes. A note stores one value in `font`: a built-in name below, or
// "custom:<id>" for a font file the person added. The files stay on this
// device (IndexedDB) and are not synced, so on another device a note with a
// custom font shows in the default font until the same file is added there.
import { useEffect, useState } from "react";
import { get, update } from "idb-keyval";
import { uid } from "./db";

export type NoteFont = { value: string; label: string; family: string };

export const FONTS: NoteFont[] = [
  { value: "sans", label: "Default", family: "var(--font-sans)" },
  { value: "serif", label: "Serif", family: '"Noto Serif", Georgia, serif' },
  { value: "classic", label: "Classic", family: "var(--font-serif)" },
  { value: "mono", label: "Mono", family: "var(--font-mono)" },
  { value: "hand", label: "Handwriting", family: '"Dancing Script", cursive' },
];

type Stored = { id: string; name: string; data: ArrayBuffer };
export type CustomFont = { id: string; name: string };

const KEY = "note-fonts";
const MAX_BYTES = 5 * 1024 * 1024;
const face = (id: string) => `stack-font-${id}`;
const customValue = (id: string) => `custom:${id}`;

export const customFont = (f: CustomFont): NoteFont => ({
  value: customValue(f.id),
  label: f.name,
  family: `"${face(f.id)}", var(--font-sans)`,
});

// The CSS font-family for a note. An unknown or missing font is the default.
export function fontFamily(font?: string) {
  if (!font || font === "sans") return undefined;
  if (font.startsWith("custom:")) return `"${face(font.slice(7))}", var(--font-sans)`;
  return FONTS.find((f) => f.value === font)?.family;
}

const listeners = new Set<() => void>();
const loaded = new Map<string, FontFace>();

async function register(f: Stored) {
  if (loaded.has(f.id)) return;
  const ff = new FontFace(face(f.id), f.data);
  await ff.load();
  document.fonts.add(ff);
  loaded.set(f.id, ff);
}

// Reads the added fonts and makes them usable on the page.
export async function loadCustomFonts(): Promise<CustomFont[]> {
  const all = (await get<Stored[]>(KEY)) ?? [];
  await Promise.all(all.map((f) => register(f).catch(() => {})));
  return all.map(({ id, name }) => ({ id, name }));
}

// Adds a .ttf, .otf, .woff or .woff2 file. Throws a readable message if it isn't a font.
export async function addCustomFont(file: File): Promise<CustomFont> {
  if (file.size > MAX_BYTES) throw new Error("That font is too big (the limit is 5 MB).");
  const font: Stored = {
    id: uid(),
    name: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, 24) || "My font",
    data: await file.arrayBuffer(),
  };
  try {
    await register(font);
  } catch {
    throw new Error("That file isn’t a font. Choose a .ttf, .otf or .woff file.");
  }
  await update<Stored[]>(KEY, (all) => [...(all ?? []), font]);
  listeners.forEach((fn) => fn());
  return { id: font.id, name: font.name };
}

export async function removeCustomFont(id: string) {
  await update<Stored[]>(KEY, (all) => (all ?? []).filter((f) => f.id !== id));
  const ff = loaded.get(id);
  if (ff) document.fonts.delete(ff);
  loaded.delete(id);
  listeners.forEach((fn) => fn());
}

// The added fonts, loaded and kept up to date. Also used by note cards so a
// custom font shows in the list.
export function useCustomFonts() {
  const [fonts, setFonts] = useState<CustomFont[]>([]);
  useEffect(() => {
    let alive = true;
    const run = () => loadCustomFonts().then((f) => alive && setFonts(f));
    run();
    listeners.add(run);
    return () => {
      alive = false;
      listeners.delete(run);
    };
  }, []);
  return fonts;
}
