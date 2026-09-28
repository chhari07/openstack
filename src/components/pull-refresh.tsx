"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Logo } from "./logo";

const TRIGGER = 72; // px of pull (after resistance) that starts a refresh
const MAX = 110;

// Pull down from the top of `area` to refresh. Works for the page scroll and
// for scrollers inside it (the news cards): the pull only starts when
// everything under the finger is already scrolled to the top.
export function usePullToRefresh(
  area: RefObject<HTMLElement | null>,
  onRefresh: () => void,
  disabled = false,
) {
  const [pull, setPull] = useState(0);
  const refresh = useRef(onRefresh);
  useEffect(() => {
    refresh.current = onRefresh;
  });

  useEffect(() => {
    const el = area.current;
    if (!el || disabled) return;
    let start: { x: number; y: number } | null = null;
    let pulling = false;
    let dist = 0;

    const atTop = (target: EventTarget | null) => {
      if (window.scrollY > 0) return false;
      for (let n = target as HTMLElement | null; n && n !== el; n = n.parentElement)
        if (n.scrollTop > 0) return false;
      return true;
    };
    const onStart = (e: TouchEvent) => {
      start =
        e.touches.length === 1 && atTop(e.target)
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
          : null;
      pulling = false;
      dist = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (!pulling) {
        // Sideways swipes (rails, chips) and upward scrolls aren't pulls.
        if (Math.abs(dx) > Math.abs(dy) || dy < 0) {
          if (Math.abs(dx) > 8 || dy < -8) start = null;
          return;
        }
        if (dy < 8) return;
        pulling = true;
      }
      dist = Math.min(MAX, Math.max(0, dy - 8) * 0.5);
      setPull(dist);
    };
    const onEnd = () => {
      if (pulling && dist >= TRIGGER) refresh.current();
      start = null;
      pulling = false;
      dist = 0;
      setPull(0);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [area, disabled]);

  return pull;
}

// The Stack logo in a bubble at the top of the screen: it builds up block by
// block as you pull, then keeps stacking while the refresh runs.
export function RefreshLogo({ pull, busy }: { pull: number; busy: boolean }) {
  const shown = busy || pull > 0;
  const y = busy ? 56 : pull * 0.8;
  const ready = pull >= TRIGGER;
  return (
    <div
      aria-hidden={!busy}
      role={busy ? "status" : undefined}
      aria-label={busy ? "Refreshing news" : undefined}
      className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-40 flex justify-center md:left-[var(--rail)]"
    >
      <div
        style={{
          transform: `translateY(${y - 48}px) scale(${ready || busy ? 1 : 0.9})`,
          opacity: shown ? 1 : 0,
          transition: pull > 0 ? "none" : "transform 260ms ease, opacity 200ms ease",
        }}
        className="flex size-11 items-center justify-center rounded-full bg-news text-white shadow-[0_8px_24px_rgba(0,0,0,.18)]"
      >
        <Logo
          size={26}
          loop={busy}
          built={busy ? undefined : pull / TRIGGER}
          title="Refresh"
        />
      </div>
    </div>
  );
}
