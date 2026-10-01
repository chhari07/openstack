"use client";

import { useEffect, useState } from "react";
import { getCover } from "@/lib/db";

const COLORS = ["#F2C230", "#F0561D", "#2C5DA8", "#E9DFC9", "#1F4FA8", "#2F4B3A"];

const DARK = new Set(["#2C5DA8", "#1F4FA8", "#2F4B3A"]);

// First page of the PDF as its cover, with a coloured title card while it loads.
// `plain` keeps the title card (the Stack cover), `marked` hangs a bookmark
// ribbon on it and `progress` (0–1) draws how far the reader is.
export function PdfCover({
  id,
  title,
  className = "",
  plain,
  marked,
  progress,
}: {
  id: string;
  title: string;
  className?: string;
  plain?: boolean;
  marked?: boolean;
  progress?: number;
}) {
  const [src, setSrc] = useState<string | undefined>();
  useEffect(() => {
    getCover(id).then(setSrc);
  }, [id]);
  const color = COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-r-[3px] shadow-[0_4px_10px_rgba(0,0,0,.18)] ${className}`}
      style={{ background: color, color: DARK.has(color) ? "#fff" : "#111" }}
    >
      {src && !plain ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover object-top" />
      ) : (
        <span className="flex size-full flex-col justify-between p-2.5 pl-3.5">
          <span className="line-clamp-5 font-serif text-[13px] leading-[1.1] italic">{title}</span>
          <svg width="16" height="16" viewBox="242.5 130 124 124" fill="currentColor" aria-hidden>
            <rect x="272.2" y="236" width="65" height="18" rx="2" />
            <rect x="273.9" y="194.8" width="60" height="18" rx="2" transform="rotate(-26.6 303.9 203.8)" />
            <rect x="274.7" y="167.9" width="38" height="18" rx="2" transform="rotate(-32 293.7 176.9)" />
            <rect x="272.5" y="130.5" width="18" height="29" rx="2" />
          </svg>
        </span>
      )}
      {/* The spine */}
      <span className="pointer-events-none absolute inset-y-0 left-0 w-[9%] bg-gradient-to-r from-black/30 via-black/5 to-transparent" />
      {marked && <span className="ribbon absolute -top-px right-2.5 h-7 w-3 bg-music" />}
      {!!progress && (
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/20">
          <span className="block h-full bg-music" style={{ width: `${Math.min(1, progress) * 100}%` }} />
        </span>
      )}
    </span>
  );
}
