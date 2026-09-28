"use client";

import { useState, type ReactNode } from "react";
import { useIsNative } from "@/lib/platform";
import { APP_REDIRECT, isClientId, setClientId } from "@/lib/spotify";
import { useToast } from "./toast";

const WEB_REDIRECT = "http://127.0.0.1:3000/music/callback";
const DASHBOARD = "https://developer.spotify.com/dashboard";

// Connect Stack to Spotify: Spotify only lets apps log people in through a
// (free) developer app of their own, so this walks through making one and
// pasting its Client ID (public; Stack uses PKCE, no secret).
export function SpotifySetup({ compact = false }: { compact?: boolean }) {
  const app = useIsNative();
  const toast = useToast();
  const [id, setId] = useState("");
  const valid = isClientId(id);

  const copy = (text: string) =>
    navigator.clipboard?.writeText(text).then(
      () => toast({ text: "Copied" }),
      () => toast({ text: "Couldn’t copy: select the text and copy it" }),
    );

  return (
    <div className={`flex flex-col gap-4 text-[14px] leading-relaxed ${compact ? "" : "mt-6 rounded-2xl bg-card p-5"}`}>
      {!compact && <p className="label text-[11px] font-medium text-music-text">Connect Spotify</p>}
      <p className="text-muted">
        Spotify only lets apps log you in through your own free <b className="text-ink">Spotify developer app</b>.
        It’s a one-time setup of about 3 minutes.
      </p>

      <ol className="flex flex-col gap-3.5">
        <Step n={1} title="Open the Spotify developer dashboard">
          Log in with your normal Spotify account and accept the terms if asked.
          <a
            href={DASHBOARD}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex h-10 w-fit items-center rounded-full bg-[#1DB954] px-4 text-[13px] font-semibold text-black"
          >
            Open developer.spotify.com
          </a>
        </Step>
        <Step n={2} title="Create an app">
          Tap <b>Create app</b>. Name: <i>Stack</i>, description: anything. Under <b>Redirect URIs</b> add both of
          these (tap <b>Add</b> after each):
          <Uri value={APP_REDIRECT} label="Android app redirect URI" onCopy={copy} />
          <Uri value={WEB_REDIRECT} label="website redirect URI" onCopy={copy} />
          <span className="mt-1.5 block text-[12px] text-muted">
            {app ? "The first is for this Android app; the second is for Stack on a computer." : "The second is for this website; the first is for the Android app."}{" "}
            They must match exactly.
          </span>
          Under <b>Which API/SDKs</b> tick <b>Web API</b> and <b>Web Playback SDK</b>, agree, and <b>Save</b>.
        </Step>
        <Step n={3} title="Allow your Spotify account">
          In the app’s <b>Settings → User Management</b>, add your name and the email of your Spotify account. New
          Spotify apps only work for people added here.
        </Step>
        <Step n={4} title="Copy the Client ID">
          In <b>Settings → Basic Information</b>, copy the <b>Client ID</b> (32 letters and numbers). You never need
          the Client secret.
        </Step>
        <Step n={5} title="Paste it here, then log in">
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              setClientId(id.trim());
              setId("");
              toast({ text: "Saved. Now tap Log in with Spotify." });
            }}
          >
            <input
              aria-label="Spotify Client ID"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Client ID"
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
          {id && !valid && (
            <span className="mt-1.5 block text-[12px] text-music-deep">
              That doesn’t look right: a Client ID is 32 characters, only 0–9 and a–f.
            </span>
          )}
        </Step>
      </ol>

      <SpotifyLoginNote />
      <SpotifyTroubleshooting />
    </div>
  );
}

// A redirect URI with a Copy button.
function Uri({ value, label, onCopy }: { value: string; label: string; onCopy: (v: string) => void }) {
  return (
    <span className="mt-1.5 flex items-center gap-2">
      <code className="min-w-0 grow truncate rounded-lg bg-paper px-2.5 py-2 font-mono text-[12px]">{value}</code>
      <button
        type="button"
        onClick={() => onCopy(value)}
        aria-label={`Copy ${label}`}
        className="label h-9 shrink-0 rounded-full border border-ink/20 px-3 text-[10px]"
      >
        Copy
      </button>
    </span>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-on-ink">
        {n}
      </span>
      <div className="min-w-0 grow">
        <p className="font-semibold">{title}</p>
        <div className="text-[13px] text-prose">{children}</div>
      </div>
    </li>
  );
}

// What happens after tapping "Log in with Spotify".
export function SpotifyLoginNote() {
  const app = useIsNative();
  return (
    <div className="rounded-xl bg-paper px-3.5 py-3 text-[13px] leading-relaxed text-prose">
      <b>When you tap Log in with Spotify:</b> Spotify’s login page opens
      {app ? " in your phone’s browser" : ""}. Log in, check the permissions and tap <b>Agree</b>. You come back to
      Stack automatically and your playlists appear in Music → Spotify.
      {app && " If it doesn’t come back, switch to Stack yourself and tap Log in again."}
      <span className="mt-1.5 block text-muted">
        Play, pause and skip need Spotify Premium. Free accounts can browse playlists and use “Open in Spotify”.
      </span>
    </div>
  );
}

// Spotify's own error messages, in plain words.
export function SpotifyTroubleshooting() {
  const items: [string, string][] = [
    ["“INVALID_CLIENT: Invalid redirect URI”", "The redirect URI in your Spotify app doesn’t match. Copy it again from step 2, add it, and tap Save at the bottom of the Spotify settings."],
    ["“INVALID_CLIENT: Invalid client”", "The Client ID is wrong. Copy it again from Basic Information and paste it in step 5."],
    ["“User not registered in the Developer Dashboard” or playlists don’t load", "Add your Spotify email under User Management (step 3), then log out of Spotify in Stack and log in again."],
    ["“Spotify isn’t running” / nothing plays", "Open the Spotify app, play any song for a second, then come back to Stack and try again."],
    ["“Needs Spotify Premium”", "Controlling playback from other apps is a Premium feature. Use “Open in Spotify” instead."],
    ["On a computer, the login page won’t come back", "Open Stack at http://127.0.0.1:3000 (not localhost): Spotify only accepts that address."],
  ];
  return (
    <details className="rounded-xl border border-ink/12 px-3.5 py-2.5 text-[13px]">
      <summary className="cursor-pointer font-semibold">Something went wrong?</summary>
      <dl className="mt-2.5 flex flex-col gap-2.5">
        {items.map(([problem, fix]) => (
          <div key={problem}>
            <dt className="font-semibold">{problem}</dt>
            <dd className="text-muted">{fix}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
