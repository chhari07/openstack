"use client";

// Listen mode: articles and PDFs read aloud. In the Android app the text is
// spoken by the phone's text-to-speech and plays in the music player
// (LocalMusicPlugin.listen), with its notification, speed and sleep timer.
// The website uses the browser's speech synthesis.
import { LocalMusic } from "./local-music";
import { isNative } from "./platform";

/** Splits text into parts of about `max` characters, on paragraph and sentence breaks. */
export function chunkText(text: string, max = 1500): string[] {
  const paragraphs = text
    .replace(/\r/g, "")
    .split(/\n\s*\n|\n(?=[A-Z0-9“"‘'])/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const out: string[] = [];
  let cur = "";
  const push = (s: string) => {
    if (cur && cur.length + s.length + 1 > max) {
      out.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n${s}` : s;
  };
  for (const p of paragraphs) {
    if (p.length <= max) push(p);
    else for (const s of p.match(/[^.!?।]+[.!?।]+["”’)]*\s*|[^.!?।]+$/g) ?? [p]) push(s.trim().slice(0, max));
  }
  if (cur) out.push(cur);
  return out;
}

// Hindi (Devanagari) text gets a Hindi voice if the phone has one.
const lang = (text: string) => ((text.match(/[ऀ-ॿ]/g)?.length ?? 0) > text.length * 0.2 ? "hi-IN" : "");

export const canListen = () => isNative() || (typeof window !== "undefined" && "speechSynthesis" in window);

/** Starts reading aloud. Resolves once it's playing, with the number of parts. */
export async function listen(opts: { title: string; source: string; text: string }): Promise<number> {
  const chunks = chunkText(opts.text);
  if (!chunks.length) throw new Error("Nothing to read");
  if (isNative()) {
    const { parts } = await LocalMusic.listen({ title: opts.title, source: opts.source, chunks, lang: lang(opts.text) });
    return parts;
  }
  const speech = window.speechSynthesis;
  speech.cancel();
  for (const c of chunks) {
    const u = new SpeechSynthesisUtterance(c);
    const l = lang(c);
    if (l) u.lang = l;
    speech.speak(u);
  }
  return chunks.length;
}

/** Website only: stop the browser's speech. */
export const stopListening = () => {
  if (!isNative() && typeof window !== "undefined") window.speechSynthesis?.cancel();
};
