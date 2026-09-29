import Link from "next/link";
import { Logo } from "@/components/logo";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Logo size={24} />
          <p className="label text-xs text-muted">© 2026 {SITE.maker}</p>
        </div>
        <nav className="label flex flex-wrap gap-5 text-xs text-muted">
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <a href={`mailto:${SITE.email}`} className="hover:text-ink">{SITE.email}</a>
          <a href={SITE.github} rel="noopener noreferrer" target="_blank" className="hover:text-ink">GitHub</a>
        </nav>
      </div>
    </footer>
  );
}
