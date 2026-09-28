"use client";

import { useEffect, useRef, useState } from "react";
import { finishLogin } from "@/lib/spotify";

// Spotify sends the user back here with ?code=… after they approve.
export default function SpotifyCallback() {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(params.get("error") === "access_denied" ? "You cancelled the Spotify login." : "No login code from Spotify.");
      return;
    }
    finishLogin(code)
      // Full reload so the provider picks up the new tokens.
      .then(() => window.location.replace("/music"))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="display text-[64px]">{error ? "OOPS" : "…"}</span>
      <p className="label text-[11px] text-muted">{error ?? "Connecting Spotify"}</p>
      {error && (
        <a href="/music" className="label rounded-full bg-ink px-5 py-3 text-[11px] text-on-ink">
          Back to Music
        </a>
      )}
    </main>
  );
}
