import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <Logo size={96} className="mx-auto" />
        <h1 className="display mt-8 text-8xl">404</h1>
        <p className="mt-4 text-lg text-muted">This page isn’t in the stack.</p>
        <Link href="/" className="label mt-8 inline-block rounded-full bg-ink px-7 py-4 text-sm text-on-ink">
          Back home
        </Link>
      </div>
    </main>
  );
}
