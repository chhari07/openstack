import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const stroke = ({ size = 24, ...p }: P, sw = 1.7) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: sw,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
  "aria-hidden": true,
  ...p,
});

const solid = ({ size = 16, ...p }: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
  ...p,
});

export const HomeIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />
  </svg>
);
export const NewsIcon = (p: P) => (
  <svg {...stroke(p)}>
    <rect x="4" y="5" width="16" height="14" rx="1" />
    <path d="M8 9h8M8 13h8M8 16h5" />
  </svg>
);
export const DiscIcon = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);
export const ShelfIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M4 4h4v16H4zM10 4h4v16h-4zM16 6l3-1 2.5 14-3 1z" />
  </svg>
);
export const NoteIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M9 12h7M9 16h7" />
  </svg>
);
export const SearchIcon = (p: P) => (
  <svg {...stroke(p, 1.8)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l5 5" />
  </svg>
);
export const PlusIcon = (p: P) => (
  <svg {...stroke(p, 2)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const BackIcon = (p: P) => (
  <svg {...stroke(p, 1.8)}>
    <path d="M20 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const ChevronLeft = (p: P) => (
  <svg {...stroke(p, 2)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const ChevronRight = (p: P) => (
  <svg {...stroke(p, 2)}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const BookmarkIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...stroke(p, 1.8)} fill={filled ? "currentColor" : "none"}>
    <path d="M6 3h12v18l-6-4-6 4z" />
  </svg>
);
export const CheckIcon = (p: P) => (
  <svg {...stroke(p, 2)}>
    <path d="M5 12l5 5L20 7" />
  </svg>
);
export const ClockIcon = (p: P) => (
  <svg {...stroke(p, 1.8)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const CloseIcon = (p: P) => (
  <svg {...stroke(p, 2)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const ExternalIcon = (p: P) => (
  <svg {...stroke(p, 1.8)}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
  </svg>
);
export const TrashIcon = (p: P) => (
  <svg {...stroke(p, 1.8)}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
);

export const PlayIcon = (p: P) => (
  <svg {...solid(p)}>
    <path d="M7 4v16l13-8z" />
  </svg>
);
export const PauseIcon = (p: P) => (
  <svg {...solid(p)}>
    <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
  </svg>
);
export const PrevIcon = (p: P) => (
  <svg {...solid(p)}>
    <path d="M6 5h2v14H6zM20 5v14L9 12z" />
  </svg>
);
export const NextIcon = (p: P) => (
  <svg {...solid(p)}>
    <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
  </svg>
);
export const ShuffleIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M3 7h3.5c2 0 3.2 1 4.3 2.7l2.4 4.6C14.3 16 15.5 17 17.5 17H21M18 14l3 3-3 3M3 17h3.5c1.3 0 2.3-.4 3.1-1.2M14.4 8.2C15.2 7.4 16.2 7 17.5 7H21M18 4l3 3-3 3" />
  </svg>
);
export const RepeatIcon = ({ one, ...p }: P & { one?: boolean }) => (
  <svg {...stroke(p)}>
    <path d="M17 3l3 3-3 3M4 11V9.5A3.5 3.5 0 0 1 7.5 6H20M7 21l-3-3 3-3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4" />
    {one && <path d="M11 10.5l1.5-1V15" strokeWidth={1.6} />}
  </svg>
);
export const PinIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...stroke(p)} fill={filled ? "currentColor" : "none"}>
    <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7" />
  </svg>
);
export const PaletteIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.6 0-1-.8-1.4-.8-2.3 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" />
    <circle cx="10" cy="7" r="1" fill="currentColor" />
    <circle cx="14.5" cy="7" r="1" fill="currentColor" />
  </svg>
);
export const ListIcon = (p: P) => (
  <svg {...stroke(p)}>
    <rect x="3.5" y="4.5" width="5" height="5" rx="1" />
    <path d="M4.8 16.5l1.4 1.4 2.6-2.8M12 7h8.5M12 17h8.5" />
  </svg>
);
export const ShareIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);
export const MenuIcon = (p: P) => (
  <svg {...stroke(p, 1.8)}>
    <path d="M3 8h18M3 12h18M3 16h18" />
  </svg>
);
