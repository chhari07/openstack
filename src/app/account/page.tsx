"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { useAccount } from "@/components/account-provider";
import { explainAuth, SignInCancelled, signInMethod } from "@/lib/cloud";
import { MeStatsView, ProfileHero } from "@/components/me-profile";
import { SignInPanel } from "@/components/sign-in";
import { Sheet } from "@/components/sheet";
import { BackIcon } from "@/components/icons";
import { canGoBack } from "@/lib/nav";
import { noteTime } from "@/lib/format";
import { SignOutIcon, SyncIcon } from "@/components/stack-icons";

export default function Account() {
  const router = useRouter();
  const { configured, ready, user, sync, syncNow, signOut, deleteAccount } = useAccount();
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState<"keep" | "remove" | null>(null);
  const [unsynced, setUnsynced] = useState(0); // changes that would be lost
  const toast = useToast();

  const leave = async (remove: boolean, force = false) => {
    setBusy(remove ? "remove" : "keep");
    const result = await signOut(remove, force);
    setBusy(null);
    if (remove && !force && result.unsynced > 0) return setUnsynced(result.unsynced);
    setLeaving(false);
    setUnsynced(0);
    toast({ text: remove ? "Signed out and removed from this phone" : "Signed out. Your things are still on this phone." });
  };
  const removeAccount = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount(password || undefined);
      setDeleting(false);
      setPassword("");
      toast({ text: "Your account and its data have been deleted" });
    } catch (e) {
      if (!(e instanceof SignInCancelled)) setDeleteError(explainAuth(e));
    } finally {
      setDeleteBusy(false);
    }
  };
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

        <div className="mt-7">
          <ProfileHero />
          <MeStatsView />
        </div>

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
                className="flex h-12 grow items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-50"
              >
                <SyncIcon size={18} className={sync.state === "syncing" ? "animate-spin" : ""} />
                Sync now
              </button>
              <button
                onClick={() => setLeaving(true)}
                className="flex h-12 grow items-center justify-center gap-2 rounded-full border border-ink/20 text-[15px] font-semibold"
              >
                <SignOutIcon size={18} />
                Sign out
              </button>
            </div>
            <button
              onClick={() => setDeleting(true)}
              className="self-start text-[12px] text-muted underline"
            >
              Delete account
            </button>
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

      <Sheet
        open={leaving}
        onClose={() => {
          if (busy) return;
          setLeaving(false);
          setUnsynced(0);
        }}
        title={unsynced ? "Some changes aren’t synced" : "Sign out"}
      >
        {unsynced > 0 ? (
          <>
            <p className="text-[15px] leading-relaxed">
              {unsynced} change{unsynced > 1 ? "s haven’t" : " hasn’t"} reached your account yet
              {sync.state === "error" ? " because sync isn’t working (see Account & sync)" : ""}. If you remove
              Stack’s data from this phone now, {unsynced > 1 ? "they" : "it"} will be lost.
            </p>
            <button
              disabled={!!busy}
              onClick={() => leave(false)}
              className="h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-50"
            >
              {busy === "keep" ? "Signing out…" : "Sign out, keep everything on this phone"}
            </button>
            <button
              disabled={!!busy}
              onClick={() => leave(true, true)}
              className="h-12 rounded-full border border-music/40 text-[15px] font-semibold text-music-text disabled:opacity-50"
            >
              {busy === "remove" ? "Removing…" : "Remove anyway"}
            </button>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-relaxed">
              Your notes, PDFs and playlists stay safe in your account. Do you also want to keep a copy on this
              phone?
            </p>
            <button
              disabled={!!busy}
              onClick={() => leave(false)}
              className="h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-50"
            >
              {busy === "keep" ? "Signing out…" : "Sign out, keep on this phone"}
            </button>
            <p className="-mt-2 text-center text-[12px] text-muted">
              If someone else signs in here later, this copy is added to their account.
            </p>
            <button
              disabled={!!busy}
              onClick={() => leave(true)}
              className="h-12 rounded-full border border-music/40 text-[15px] font-semibold text-music-text disabled:opacity-50"
            >
              {busy === "remove" ? "Checking and removing…" : "Sign out and remove from this phone"}
            </button>
          </>
        )}
      </Sheet>

      <Sheet
        open={deleting}
        onClose={() => {
          if (deleteBusy) return;
          setDeleting(false);
          setDeleteError(null);
          setPassword("");
        }}
        title="Delete your account?"
      >
        <p className="text-[15px] leading-relaxed">
          This deletes your Stack account for good: every synced note, highlight, saved article, playlist, your
          profile and any PDFs stored in your account. Stack’s data on this phone is removed too. It can’t be undone.
        </p>
        <p className="text-[13px] leading-relaxed text-muted">
          Want a copy first? Settings → Backup saves everything to a file.
        </p>
        {signInMethod() === "password" && (
          <input
            type="password"
            autoComplete="current-password"
            aria-label="Password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-full border border-ink/15 bg-card px-4 text-[15px] outline-none"
          />
        )}
        {deleteError && <p className="text-[13px] text-music-deep">{deleteError}</p>}
        <button
          disabled={deleteBusy || (signInMethod() === "password" && !password)}
          onClick={removeAccount}
          className="h-12 rounded-full bg-music text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {deleteBusy
            ? "Deleting…"
            : signInMethod() === "google"
              ? "Confirm with Google and delete"
              : "Delete my account"}
        </button>
        <button
          disabled={deleteBusy}
          onClick={() => setDeleting(false)}
          className="h-12 rounded-full border border-ink/15 text-[15px] font-semibold disabled:opacity-50"
        >
          Keep my account
        </button>
      </Sheet>
    </main>
  );
}
