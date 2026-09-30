"use client";

import { useState } from "react";
import { HeadphonesIcon } from "./stack-icons";
import { useToast } from "./toast";
import { canListen, listen, stopListening } from "@/lib/listen";
import { isNative } from "@/lib/platform";

// "Listen": reads the article or PDF aloud (lib/listen.ts).
export function ListenButton({
  getText,
  title,
  source,
  label = "Listen to this",
}: {
  getText: () => Promise<string> | string;
  title: string;
  source: string;
  label?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false); // website only
  if (!canListen()) return null;

  const start = async () => {
    if (speaking) {
      stopListening();
      setSpeaking(false);
      return;
    }
    setBusy(true);
    try {
      const text = (await getText()).trim();
      if (!text) throw new Error("Nothing to read here");
      await listen({ title, source, text });
      if (isNative()) {
        toast({ text: "Reading aloud · controls are in the player and notification", href: "/music" });
      } else setSpeaking(true);
    } catch (e) {
      toast({ text: (e as Error).message || "Couldn't read this aloud" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      aria-label={speaking ? "Stop reading aloud" : label}
      aria-pressed={speaking}
      aria-busy={busy}
      onClick={start}
      disabled={busy}
      className={`flex size-11 items-center justify-center ${busy ? "animate-pulse opacity-60" : ""} ${speaking ? "text-news" : ""}`}
    >
      <HeadphonesIcon size={20} />
    </button>
  );
}
