"use client";

import { useState } from "react";
import { Sheet } from "./sheet";

// "+ Note" on selected text: shows the quote and asks for the user's thought.
export function QuoteNoteSheet({
  quote,
  tint,
  onClose,
  onSave,
}: {
  quote: string | null;
  tint: string; // background class for the quote block
  onClose: () => void;
  onSave: (body: string) => void;
}) {
  const [body, setBody] = useState("");
  const close = () => {
    setBody("");
    onClose();
  };
  return (
    <Sheet open={quote !== null} onClose={close} title="Add a note">
      <blockquote className={`rounded-xl px-3.5 py-3 text-[14px] leading-snug ${tint}`}>
        “{quote}”
      </blockquote>
      <label className="flex flex-col gap-2">
        <span className="label text-[10px] text-muted">Your note (optional)</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Why does this matter?"
          className="rounded-xl border border-ink/15 bg-card p-3 text-[15px] outline-none focus:border-ink"
        />
      </label>
      <button
        onClick={() => {
          onSave(body.trim());
          setBody("");
        }}
        className="h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink"
      >
        Save to Notes
      </button>
    </Sheet>
  );
}
