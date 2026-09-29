"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";
import { DiscIcon, HomeIcon, MenuIcon, NewsIcon, NoteIcon, SearchIcon, ShelfIcon } from "./icons";

const TABS = [
  { href: "/", label: "Today", Icon: HomeIcon, dot: "bg-music" },
  { href: "/news", label: "News", Icon: NewsIcon, dot: "bg-news" },
  { href: "/music", label: "Music", Icon: DiscIcon, dot: "bg-music" },
  { href: "/library", label: "Library", Icon: ShelfIcon, dot: "bg-pdf" },
  { href: "/notes", label: "Notes", Icon: NoteIcon, dot: "bg-ink" },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

// Phones: bottom tab bar on the main screens. Tablets use NavRail instead.
export function TabBar({ tone = "bg-paper" }: { tone?: string }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className={`fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[480px] justify-between border-t border-line px-3.5 pt-2.5 pb-[max(env(safe-area-inset-bottom),12px)] md:hidden ${tone}`}
    >
      {TABS.map(({ href, label, Icon, dot }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-[54px] w-16 flex-col items-center gap-1 ${active ? "text-ink" : "text-muted"}`}
          >
            <Icon />
            <span className={`label text-[10px] ${active ? "font-medium" : ""}`}>{label}</span>
            {active && <span className={`size-1 rounded-full ${dot}`} />}
          </Link>
        );
      })}
    </nav>
  );
}

// Tablets (768px+): a left rail on every screen, with the logo and Settings.
export function NavRail() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-40 hidden w-[var(--rail)] flex-col items-center gap-2 border-r border-line bg-paper pt-[calc(env(safe-area-inset-top)+20px)] pb-6 md:flex"
    >
      <Link href="/" aria-label="Stack home" className="mb-6 flex size-12 items-center justify-center">
        <Logo size={34} />
      </Link>
      {TABS.map(({ href, label, Icon, dot }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-[68px] w-[72px] flex-col items-center justify-center gap-1 rounded-2xl ${
              active ? "bg-card text-ink shadow-[0_2px_10px_rgba(0,0,0,.05)]" : "text-muted"
            }`}
          >
            <Icon />
            <span className={`label text-[10px] ${active ? "font-medium" : ""}`}>{label}</span>
            {active && <span className={`size-1 rounded-full ${dot}`} />}
          </Link>
        );
      })}
      <Link
        href="/search"
        aria-label="Search everything"
        aria-current={path.startsWith("/search") ? "page" : undefined}
        className={`mt-auto flex size-12 items-center justify-center rounded-2xl ${
          path.startsWith("/search") ? "bg-card text-ink" : "text-muted"
        }`}
      >
        <SearchIcon size={22} />
      </Link>
      <Link
        href="/settings"
        aria-label="Settings"
        aria-current={path.startsWith("/settings") ? "page" : undefined}
        className={`flex size-12 items-center justify-center rounded-2xl ${
          path.startsWith("/settings") ? "bg-card text-ink" : "text-muted"
        }`}
      >
        <MenuIcon size={22} />
      </Link>
    </nav>
  );
}
