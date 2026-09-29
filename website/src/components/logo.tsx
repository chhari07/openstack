// Stack's mark, exactly as in the app (stack/src/components/logo.tsx): four
// blocks settling into a stack, drawn in the current text colour.
// `animate` drops them in one by one, base first, like the app's splash.
// The delays are classes, not inline styles, so the CSP doesn't need to allow
// style attributes for them.

// Measured from the original artwork: centre, size and tilt of each block.
const BLOCKS = [
  { cx: 304.7, cy: 245, w: 65, h: 18, r: 0, delay: "" }, // base
  { cx: 303.9, cy: 203.8, w: 60, h: 18, r: -26.6, delay: "[animation-delay:110ms]" },
  { cx: 293.7, cy: 176.9, w: 38, h: 18, r: -32, delay: "[animation-delay:220ms]" },
  { cx: 281.5, cy: 145, w: 18, h: 29, r: 0, delay: "[animation-delay:330ms]" }, // top
];

export function Logo({
  size = 24,
  animate = false,
  className = "",
}: {
  size?: number;
  animate?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="242.5 130 124 124"
      role="img"
      aria-label="Stack"
      className={`${animate ? "logo-drop" : ""} ${className}`}
      fill="currentColor"
    >
      {BLOCKS.map((b) => (
        <g key={b.cy} className={b.delay}>
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
