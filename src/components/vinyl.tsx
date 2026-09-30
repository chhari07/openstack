"use client";

import { useId } from "react";

// Record player art: the album sleeve with the record lying on top of it.
// The record's label carries the song title and artist; it spins while
// playing (holding its angle when paused) and the tonearm swings onto the
// record, creeping inward as the song plays.
export function Vinyl({
  cover,
  title,
  artist,
  playing,
  progress = 0,
  trackKey,
  onToggle,
}: {
  cover?: string | null;
  title?: string;
  artist?: string;
  playing: boolean;
  progress?: number; // 0..1, moves the tonearm across the grooves
  trackKey?: string; // changes per song, replays the "record in" slide
  onToggle?: () => void;
}) {
  const id = useId().replace(/:/g, "");
  const cx = 230;
  const cy = 120;
  const armAngle = playing ? 5 + 11 * Math.min(1, Math.max(0, progress)) : -4;
  const name = fit(title || "Unknown track", 22);
  const by = fit(artist || "", 17);

  const art = (
    <svg viewBox="0 0 340 240" className="block h-auto w-full max-w-[400px] overflow-visible" aria-hidden>
      <defs>
        <clipPath id={`${id}-sleeve`}>
          <rect x="0" y="20" width="200" height="200" />
        </clipPath>
        <path id={`${id}-top`} d={arc(cx, cy, 33, 155, 25, 1, 1)} />
        <path id={`${id}-bottom`} d={arc(cx, cy, 40, 150, 30, 0, 0)} />
        <radialGradient id={`${id}-sheen`} cx="0.3" cy="0.25" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sleeve */}
      <g key={`sleeve-${trackKey}`} className="vinyl-fade">
        <rect x="0" y="20" width="200" height="200" className="fill-music" />
        {cover ? (
          <image href={cover} x="0" y="20" width="200" height="200" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-sleeve)`} />
        ) : (
          <text x="62" y="160" className="display fill-white/90" fontSize="120">
            {(title || "♪").slice(0, 1).toUpperCase()}
          </text>
        )}
      </g>

      {/* Record: slides out when playing, tucks back toward the sleeve when paused */}
      <g className="vinyl-slide" style={{ transform: `translateX(${playing ? 0 : -24}px)` }}>
        <g key={`record-${trackKey}`} className="vinyl-in">
          <circle cx={cx} cy={cy + 4} r="108" fill="#000" opacity="0.18" className="blur-[6px]" />
          <g className="vinyl-spin" style={{ animationPlayState: playing ? "running" : "paused" }}>
            <circle cx={cx} cy={cy} r="108" fill="#111" />
            {GROOVES.map((r) => (
              <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={r % 12 === 0 ? "#2f2f2d" : "#1e1e1d"} strokeWidth="0.8" />
            ))}
            {/* Label */}
            <circle cx={cx} cy={cy} r="47" className="fill-music" />
            <circle cx={cx} cy={cy} r="44" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="0.8" />
            <text className="fill-white" fontFamily="var(--font-mono)" fontSize="8.5" fontWeight="600" letterSpacing="0.6">
              <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
                {name.toUpperCase()}
              </textPath>
            </text>
            {by && (
              <text className="fill-white/75" fontFamily="var(--font-mono)" fontSize="7" letterSpacing="0.5">
                <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">
                  {by.toUpperCase()}
                </textPath>
              </text>
            )}
            <text x={cx} y={cy - 8} textAnchor="middle" className="fill-white/60" fontFamily="var(--font-mono)" fontSize="5.5" letterSpacing="1">
              STACK
            </text>
            <text x={cx} y={cy + 13} textAnchor="middle" className="fill-white/60" fontFamily="var(--font-mono)" fontSize="5.5" letterSpacing="1">
              33⅓
            </text>
            <circle cx={cx} cy={cy} r="3.5" className="fill-paper" />
          </g>
          {/* Light stays put while the record turns under it */}
          <circle cx={cx} cy={cy} r="108" fill={`url(#${id}-sheen)`} pointerEvents="none" />
        </g>
      </g>

      {/* Tonearm, pivoting at the top right */}
      <g className="vinyl-arm" style={{ transform: `rotate(${armAngle}deg)` }}>
        <rect x="313" y="-2" width="10" height="12" rx="2" fill="#9a968e" />
        <line x1="318" y1="14" x2="318" y2="150" stroke="#cfcbc3" strokeWidth="4" strokeLinecap="round" />
        <path d="M318 150 l-5 8 v12 h10 v-12 z" fill="#3a3936" />
        <circle cx="318" cy="14" r="10" fill="#2b2a28" />
        <circle cx="318" cy="14" r="4" fill="#9a968e" />
      </g>
    </svg>
  );

  if (!onToggle) return art;
  return (
    <button onClick={onToggle} aria-label={playing ? "Pause" : "Play"} className="block w-full max-w-[400px]">
      {art}
    </button>
  );
}

const GROOVES = Array.from({ length: 14 }, (_, i) => 52 + i * 4);

function fit(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

// Circular arc path; angles in degrees, 0° = right, 90° = down.
function arc(cx: number, cy: number, r: number, from: number, to: number, large: 0 | 1, sweep: 0 | 1) {
  const p = (a: number) => `${cx + r * Math.cos((a * Math.PI) / 180)} ${cy + r * Math.sin((a * Math.PI) / 180)}`;
  return `M ${p(from)} A ${r} ${r} 0 ${large} ${sweep} ${p(to)}`;
}
