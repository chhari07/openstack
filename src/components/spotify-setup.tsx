"use client";

import { useState } from "react";
import { useIsNative } from "@/lib/platform";
import { APP_REDIRECT, isClientId, setClientId } from "@/lib/spotify";
import { useToast } from "./toast";

// Connect Stack to a Spotify app without rebuilding: the steps plus a box to
// paste the Client ID (it's public, PKCE uses no secret).
export function SpotifySetup({ compact = false }: { compact?: boolean }) {
  const app = useIsNative();
  const toast = useToast();
  const [id, setId] = useState("");
  const redirect = app ? APP_REDIRECT : "http://127.0.0.1:3000/music/callback";
  const valid = isClientId(id);

  const copy = (text: string) =>
    navigator.clipboard?.writeText(text).then(
      () => toast({ text: "Copied" }),
      () => {},
    );

  return (
    <div className={`flex flex-col gap-3 text-[14px] leading-relaxed ${compact ? "" : "mt-6 rounded-2xl bg-card p-5"}`}>
      {!compact && <p className="label text-[11px] font-medium text-music-text">Connect Spotify</p>}
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>
          Open <b>developer.spotify.com/dashboard</b> → <b>Create app</b>, tick “Web API”
          {app ? "" : " and “Web Playback SDK”"}.
        </li>
        <li>
          Add this redirect URI:{" "}
          <button onClick={() => copy(redirect)} className="rounded bg-paper px-1 text-left font-mono text-[12px] break-all underline decoration-dotted">
            {redirect}
          </button>
        </li>
        <li>In the app’s <b>User Management</b>, add the email of your Spotify account.</li>
        <li>Copy the app’s <b>Client ID</b> and paste it here:</li>
      </ol>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          setClientId(id.trim());
          setId("");
          toast({ text: "Spotify app saved. Tap Connect Spotify." });
        }}
      >
        <input
          aria-label="Spotify Client ID"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="32-character Client ID"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-11 min-w-0 grow rounded-xl border border-ink/15 bg-paper px-3 font-mono text-[13px] outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={!valid}
          className="h-11 shrink-0 rounded-full bg-ink px-4 text-[14px] font-semibold text-on-ink disabled:opacity-35"
        >
          Save
        </button>
      </form>
      {id && !valid && <p className="text-[12px] text-music-deep">A Client ID is 32 letters and numbers (0–9, a–f).</p>}
      <p className="text-[12px] text-muted">
        Playing and skipping needs Spotify Premium. Free accounts can browse playlists and open them in Spotify.
      </p>
    </div>
  );
}
