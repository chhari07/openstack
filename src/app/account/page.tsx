"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "@/components/account-provider";
import { ProfileEditor } from "@/components/profile-editor";
import { SignInPanel } from "@/components/sign-in";
import { Sheet } from "@/components/sheet";
import { BackIcon } from "@/components/icons";
import { canGoBack } from "@/lib/nav";
import { noteTime } from "@/lib/format";

export default function Account() {
  const router = useRouter();
  const { configured, ready, user, sync, syncNow, signOut } = useAccount();
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const back = () => (canGoBack() ? router.back() : router.push("/"));

  const status =
    sync.state === "syncing"
      ? "Syncing…"
      : sync.state === "offline"
        ? "Offline: changes will sync when you’re back online"
        : sync.state === "error"
          ? `Couldn’t sync: ${sync.error}`
          : sync.lastSynced
            ? `Synced ${noteTime(sync.lastSynced)}`
            : "Not synced yet";

  return (
    <main className="min-h-dvh px-5 pt-5 pb-16 md:px-10 md:pt-8">
      <div className="flex h-8 items-center">
        <button aria-label="Back" onClick={back} className="-ml-2.5 flex size-11 items-center justify-center">
          <BackIcon size={22} />
        </button>
      </div>
      <div className="mx-auto max-w-[560px]">
        <h1 className="display -ml-1.5 mt-3 text-[clamp(84px,28vw,150px)]">YOU</h1>

        <section className="mt-7">
          <ProfileEditor />
        </section>

        <h2 className="label mt-9 text-[11px] font-medium">Account &amp; sync</h2>
        {ready && user && (
          <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-card p-4">
            <div className="flex flex-col gap-0.5">
              <span className="label text-[10px] text-muted">Signed in as</span>
              <span className="truncate text-[16px] font-semibold">{user.email ?? "Google account"}</span>
            </div>
            <p className={`flex items-center gap-2 text-[14px] ${sync.state === "error" ? "text-music-deep" : "text-muted"}`}>
              <span
                className={`size-2 shrink-0 rounded-full ${
                  sync.state === "error" ? "bg-music" : sync.state === "syncing" ? "animate-pulse bg-pdf" : "bg-news"
                }`}
              />
              {status}
            </p>
            <p className="text-[13px] leading-relaxed text-muted">
              Notes, saved articles, PDFs, playlists, focus history and your profile sync to every device you sign in
              on.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => syncNow()}
                disabled={sync.state === "syncing"}
                className="h-12 grow rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-50"
              >
                Sync now
              </button>
              <button onClick={() => setLeaving(true)} className="h-12 grow rounded-full border border-ink/20 text-[15px] font-semibold">
                Sign out
              </button>
            </div>
          </div>
        )}
        {ready && !user && (
          <div className="mt-3 flex flex-col gap-4">
            {configured && (
              <p className="text-[15px] leading-relaxed text-muted">
                Sign in to keep your notes, PDFs and playlists safe and on every device. Anything already on this
                phone is added to your account.
              </p>
            )}
            <SignInPanel />
          </div>
        )}
      </div>

      <Sheet open={leaving} onClose={() => !busy && setLeaving(false)} title="Sign out">
        <p className="text-[15px] leading-relaxed">
          Your things stay safe in your account. Do you want to keep a copy on this phone?
        </p>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await signOut(false);
            setBusy(false);
            setLeaving(false);
          }}
          className="h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-50"
        >
          Sign out, keep on this phone
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await signOut(true);
            setBusy(false);
            setLeaving(false);
          }}
          className="h-12 rounded-full border border-music/40 text-[15px] font-semibold text-music-text disabled:opacity-50"
        >
          Sign out and remove from this phone
        </button>
      </Sheet>
    </main>
  );
}
