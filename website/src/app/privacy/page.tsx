import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Logo } from "@/components/logo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What this website collects when you join the Stack soft launch, and how to delete it.",
};

// Covers this website and the sign-up list only. The app has its own policy
// (stack/src/app/privacy), which goes live with the app for Google Play.
export default function Privacy() {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Stack home">
            <Logo size={28} />
            <span className="display text-2xl">STACK</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="label text-xs text-muted">Updated 29 September 2026</p>
        <h1 className="display mt-3 text-7xl sm:text-8xl">PRIVACY</h1>

        <div className="mt-10 grid gap-8 text-lg leading-relaxed text-prose">
          <p>
            This page is about this website and the soft-launch sign-up list, run by {SITE.maker}. It’s short
            because we collect very little.
          </p>

          <Section title="What we collect">
            <ul className="list-disc space-y-2 pl-5">
              <li>Your <b>email address</b>, and your <b>first name</b> if you give it.</li>
              <li>Whether you want to <b>test the Android app</b>.</li>
              <li>The date you signed up.</li>
            </ul>
            <p>
              To stop spam, we count sign-ups per network for one hour. We store only a scrambled (hashed) form of
              your IP address for that, never the address itself.
            </p>
          </Section>

          <Section title="What we use it for">
            <p>
              Only to send your test invite and news about Stack’s launch. For Android testers, your email is added
              to the Google Play test list so the invite works. We don’t sell it, share it for marketing, or add you
              to anything else.
            </p>
          </Section>

          <Section title="Where it’s kept">
            <p>
              In Google Firebase (Firestore), sent over encrypted connections. Only {SITE.maker} can read it. The
              website has no ads, no analytics and no tracking cookies.
            </p>
          </Section>

          <Section title="Deleting it">
            <p>
              Email{" "}
              <a href={`mailto:${SITE.email}?subject=Delete%20my%20sign-up`} className="text-ink underline underline-offset-2">
                {SITE.email}
              </a>{" "}
              from the address you signed up with and we’ll delete it within 7 days. Every email we send also has a
              way to stop them.
            </p>
          </Section>
        </div>
      </main>

      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-2xl font-bold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}
