"use client";

import { useState } from "react";
import {
  addGoogleAccount,
  explainAuth,
  NoGoogleAccount,
  resetPassword,
  SignInCancelled,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/cloud";
import { useAccount } from "./account-provider";

// Sign in or sign up with Google (one button does both). Email + password is
// there for people without a Google account.
export function SignInPanel() {
  const { configured } = useAccount();
  const [withEmail, setWithEmail] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);

  if (!configured) {
    return (
      <p className="rounded-2xl bg-card p-4 text-[14px] leading-relaxed text-muted">
        Accounts aren’t set up in this build of Stack yet, so everything stays on this device. (For the developer:
        see <code>firebase/README.md</code>.)
      </p>
    );
  }

  const run = async (which: "google" | "email", fn: () => Promise<void>) => {
    setBusy(which);
    setError(null);
    setNotice(null);
    setNoAccount(false);
    try {
      await fn();
    } catch (e) {
      if (e instanceof NoGoogleAccount) setNoAccount(true);
      else if (!(e instanceof SignInCancelled)) setError(explainAuth(e));
    } finally {
      setBusy(null);
    }
  };

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="flex flex-col gap-3">
      <button
        disabled={!!busy}
        onClick={() => run("google", signInWithGoogle)}
        className="flex h-14 items-center justify-center gap-3 rounded-full bg-ink text-[16px] font-semibold text-on-ink disabled:opacity-50"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-white">
          <GoogleMark />
        </span>
        {busy === "google" ? "Opening Google…" : "Continue with Google"}
      </button>
      <p className="text-center text-[13px] text-muted">New to Stack? The same button creates your account.</p>

      {!withEmail ? (
        <button onClick={() => setWithEmail(true)} className="label mt-1 h-10 text-[10px] text-muted underline">
          No Google account? Use email instead
        </button>
      ) : (
        <form
          className="mt-2 flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (validEmail && password)
              run("email", () => (mode === "in" ? signInWithEmail(email, password) : signUpWithEmail(email, password)));
          }}
        >
          <div role="tablist" aria-label="Email sign-in" className="flex rounded-full border border-ink/15 p-0.5">
            {(["in", "up"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`label h-9 grow rounded-full text-[10px] ${mode === m ? "bg-ink text-on-ink" : ""}`}
              >
                {m === "in" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
          <input
            aria-label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-14 rounded-full border border-ink/15 bg-card px-5 text-[16px] outline-none focus:border-ink"
          />
          <input
            aria-label="Password"
            type="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "in" ? "Password" : "Choose a password (6+ characters)"}
            className="h-14 rounded-full border border-ink/15 bg-card px-5 text-[16px] outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={!!busy || !validEmail || !password}
            className="h-14 rounded-full border border-ink/25 text-[16px] font-semibold disabled:opacity-40"
          >
            {busy === "email" ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}
          </button>
          {mode === "in" && (
            <button
              type="button"
              disabled={!validEmail || !!busy}
              onClick={() =>
                run("email", async () => {
                  await resetPassword(email);
                  setNotice(`We sent a link to reset your password to ${email.trim()}.`);
                })
              }
              className="label h-10 text-[10px] text-muted underline disabled:opacity-40"
            >
              Forgot password?
            </button>
          )}
        </form>
      )}

      {noAccount && (
        <div role="alert" className="flex flex-col gap-2.5 rounded-2xl bg-card p-4">
          <p className="text-[14px] leading-relaxed">
            This phone doesn’t have a Google account yet. Add yours in Android, then come back and tap
            <b> Continue with Google</b> again.
          </p>
          <button
            onClick={() => addGoogleAccount().catch(() => setError("Open Settings → Passwords & accounts → Add account."))}
            className="flex h-12 items-center justify-center gap-2 rounded-full border border-ink/20 text-[15px] font-semibold"
          >
            <GoogleMark /> Add a Google account
          </button>
        </div>
      )}
      {notice && <p className="rounded-xl bg-news-tint px-3.5 py-2.5 text-[13px] text-news-deep">{notice}</p>}
      {error && (
        <p role="alert" className="rounded-xl bg-music-tint px-3.5 py-2.5 text-[13px] text-music-deep">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
