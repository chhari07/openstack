// Stack's mark: four blocks settling into a stack (from ui/logo.jpg, redrawn
// as vectors). With `animate`, the blocks drop in one by one, base first.
// `built` (0–1) shows the stack part-way built, base first (pull to refresh);
// `loop` keeps stacking and clearing the blocks (loading).

// Measured from the original artwork: centre, size and tilt of each block.
export const BLOCKS = [
  { cx: 304.7, cy: 245, w: 65, h: 18, r: 0 }, // base
  { cx: 303.9, cy: 203.8, w: 60, h: 18, r: -26.6 },
  { cx: 293.7, cy: 176.9, w: 38, h: 18, r: -32 },
  { cx: 281.5, cy: 145, w: 18, h: 29, r: 0 }, // top
];
export const LOGO_VIEWBOX = "242.5 130 124 124";

export function Logo({
  size = 24,
  animate = false,
  built,
  loop = false,
  className = "",
  title = "Stack",
}: {
  size?: number;
  animate?: boolean;
  built?: number;
  loop?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={LOGO_VIEWBOX}
      role="img"
      aria-label={title}
      className={`${loop ? "logo-loop" : animate ? "logo-drop" : ""} ${className}`}
      fill="currentColor"
    >
      {BLOCKS.map((b, i) => (
        <g key={i} style={blockStyle(i, loop, built)}>
          <rect
            x={b.cx - b.w / 2}
            y={b.cy - b.h / 2}
            width={b.w}
            height={b.h}
            rx={2}
            transform={b.r ? `rotate(${b.r} ${b.cx} ${b.cy})` : undefined}
          />
        </g>
      ))}
    </svg>
  );
}

function blockStyle(i: number, loop: boolean, built?: number) {
  if (loop) return { animationDelay: `${i * 160}ms` };
  if (built === undefined) return { animationDelay: `${i * 110}ms` };
  // Each block owns a quarter of the pull: it fades in and drops into place.
  const t = Math.min(1, Math.max(0, built * BLOCKS.length - i));
  return { opacity: t, transform: `translateY(${(t - 1) * 40}px)` };
}
