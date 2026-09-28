"use client";

import { useEffect, useState } from "react";
import { getCover } from "@/lib/db";

const COLORS = ["#F2C230", "#F0561D", "#2C5DA8", "#E9DFC9", "#1F4FA8", "#2F4B3A"];

// First page of the PDF as its cover, with a coloured title card while it loads.
export function PdfCover({ id, title, className = "" }: { id: string; title: string; className?: string }) {
  const [src, setSrc] = useState<string | undefined>();
  useEffect(() => {
    getCover(id).then(setSrc);
  }, [id]);
  const color = COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

  return (
    <span
      className={`relative block shrink-0 overflow-hidden shadow-[0_4px_10px_rgba(0,0,0,.18)] ${className}`}
      style={{ background: color }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover object-top" />
      ) : (
        <span className="line-clamp-4 p-2 font-serif text-[11px] leading-tight italic">{title}</span>
      )}
    </span>
  );
}
