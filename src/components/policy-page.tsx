import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";

// Plain public pages (privacy policy, account deletion) that Google Play links
// to. No tab bar: people arrive here from a browser, not from inside Stack.
export function PolicyPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="min-h-dvh px-5 pt-5 pb-16 md:px-10 md:pt-8">
      <div className="mx-auto max-w-[680px]">
        <Link href="/" aria-label="Stack home" className="inline-block">
          <Logo size={28} />
        </Link>
        <h1 className="display -ml-1 mt-6 text-[clamp(56px,16vw,104px)]">{title}</h1>
        <p className="label mt-3 text-[10px] text-muted">Stack · by StackForge Labs · updated {updated}</p>
        <div className="policy mt-8 flex flex-col gap-4 text-[15px] leading-relaxed">{children}</div>
      </div>
    </main>
  );
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-2xl bg-card p-5">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}
