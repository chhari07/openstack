"use client";

import { usePathname } from "next/navigation";

// Covers the phone's status bar (clock, battery) with the page colour, so the
// page doesn't show through it while you scroll. Screens with their own
// full-bleed header that already sits under the status bar are left alone.
const OWN_HEADER = ["/read", "/notes/edit", "/library/read"];

export function StatusScrim() {
  const path = usePathname();
  if (OWN_HEADER.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[45] h-[env(safe-area-inset-top)] bg-paper md:left-[var(--rail)]"
    />
  );
}
