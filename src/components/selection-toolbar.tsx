"use client";

import { useEffect, useState, type RefObject } from "react";
import { ShareIcon } from "./icons";
import { HighlighterIcon, NoteAddIcon } from "./stack-icons";

type Props = {
  container: RefObject<HTMLElement | null>;
  accent: string; // text colour class for the "+ Note" action
  onHighlight: (text: string) => void;
  onNote: (text: string) => void;
};

type Pos = { top: number; left: number; text: string };

// Floating "Highlight / + Note / Share" bar shown above selected text.
export function SelectionToolbar({ container, accent, onHighlight, onNote }: Props) {
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(() => {
    const onChange = () => {
      const sel = document.getSelection();
      const root = container.current;
      if (!sel || sel.isCollapsed || !root || sel.rangeCount === 0) return setPos(null);
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return setPos(null);
      const text = sel.toString().replace(/\s+/g, " ").trim();
      if (text.length < 2) return setPos(null);
      const rect = range.getBoundingClientRect();
      const width = 260;
      const left = Math.min(
        Math.max(8, rect.left + rect.width / 2 - width / 2),
        window.innerWidth - width - 8,
      );
      // Above the selection, or below it when there's no room at the top.
      const top = Math.min(
        rect.top > 70 ? rect.top - 52 : rect.bottom + 10,
        window.innerHeight - 60,
      );
      setPos({ top, left, text });
    };
    const onScroll = () => setPos(null);
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", onScroll);
    };
  }, [container]);

  if (!pos) return null;

  const act = (fn: (t: string) => void) => () => {
    fn(pos.text);
    document.getSelection()?.removeAllRanges();
    setPos(null);
  };

  const share = async () => {
    const text = pos.text;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* user cancelled */
    }
    setPos(null);
  };

  return (
    <div
      role="toolbar"
      aria-label="Selection actions"
      style={{ top: pos.top, left: pos.left }}
      // Keep the text selected while tapping a button.
      onPointerDown={(e) => e.preventDefault()}
      className="fixed z-50 flex h-10 w-[290px] items-center justify-around rounded-[10px] bg-card px-1.5 shadow-[0_8px_24px_rgba(0,0,0,.14)]"
    >
      <button className="label flex h-10 items-center gap-1.5 px-2 text-[10px]" onClick={act(onHighlight)}>
        <HighlighterIcon size={16} />
        Highlight
      </button>
      <button className={`label flex h-10 items-center gap-1.5 px-2 text-[10px] font-medium ${accent}`} onClick={act(onNote)}>
        <NoteAddIcon size={16} />
        Note
      </button>
      <button className="label flex h-10 items-center gap-1.5 px-2 text-[10px]" onClick={share}>
        <ShareIcon size={15} />
        Share
      </button>
    </div>
  );
}
