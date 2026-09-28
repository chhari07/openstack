"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { useAccount } from "@/components/account-provider";
import { ProfileEditor } from "@/components/profile-editor";
import { SignInPanel } from "@/components/sign-in";
import { markOnboarded } from "@/components/first-run";

// First launch: sign in (or not), then name and photo.
export default function Welcome() {
  const router = useRouter();
  const { user, configured } = useAccount();
  const [step, setStep] = useState<"account" | "profile">("account");

  // Signed in (email code or back from Google): on to the profile.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) setStep("profile");
  }, [user]);

  const finish = () => {
    markOnboarded();
    router.replace("/");
  };

  return (
    <main className="screen flex flex-col px-5 pt-5 pb-[calc(max(env(safe-area-inset-bottom),20px)+28px)] md:px-10 md:pt-8">
      <div className="mx-auto flex w-full max-w-[520px] grow flex-col">
        <Logo size={34} animate className="-ml-1" />
        <h1 className="display -ml-2 mt-6 text-[clamp(96px,33vw,160px)]">STACK</h1>
        <p className="mt-3 font-serif text-[22px] leading-snug italic">Read it. Keep it. Build on it.</p>

        {step === "account" ? (
          <>
            <p className="mt-6 text-[15px] leading-relaxed text-muted">
              News, your PDFs, music and notes in one place.
              {configured && " Sign in to keep them safe and on every device."}
            </p>
            <div className="mt-6">
              <SignInPanel />
            </div>
            <button onClick={() => setStep("profile")} className="label mt-auto h-12 text-[11px] text-muted underline">
              Continue without an account
            </button>
          </>
        ) : (
          <>
            <h2 className="label mt-8 text-[11px] font-medium">{user ? "You’re in. " : ""}Make it yours</h2>
            <div className="mt-4">
              <ProfileEditor />
            </div>
            <button
              onClick={finish}
              className="mt-auto h-14 rounded-full bg-ink text-[16px] font-semibold text-on-ink"
            >
              Get started
            </button>
          </>
        )}
      </div>
    </main>
  );
}
