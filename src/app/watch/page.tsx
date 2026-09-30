"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { BackIcon, BookmarkIcon, ClockIcon, ExternalIcon, ShareIcon } from "@/components/icons";
import { useNowPlaying } from "@/components/now-playing";
import { useToast } from "@/components/toast";
import { getSaved, toggleSaved } from "@/lib/db";
import { useStore } from "@/lib/use-store";
import { ago, newsTime } from "@/lib/format";
import { isVideoId, type Story } from "@/lib/news";

export default function Page() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <Watch />
    </Suspense>
  );
}

// A news video from the Video topic, played in YouTube's privacy-enhanced player.
function Watch() {
  const raw = useSearchParams().get("v") ?? "";
  const v = isVideoId(raw) ? raw : "";
  const id = `yt-${v}`;
  const router = useRouter();
  const toast = useToast();
  const [saved] = useStore(getSaved, []);
  const [story, setStory] = useState<Story | null>(null);
  const now = useNowPlaying();
  const paused = useRef(false);

  // The list hands over the title, channel and time (rememberStory).
  useEffect(() => {
    try {
      const s = sessionStorage.getItem(`stack.story:${id}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (s) setStory(JSON.parse(s));
    } catch {}
  }, [id]);

  // Don't play music over the video.
  useEffect(() => {
    if (!paused.current && now?.playing) {
      paused.current = true;
      now.toggle();
    }
  }, [now]);

  const fromLibrary = saved.find((a) => a.id === id);
  const title = story?.title ?? fromLibrary?.title ?? "News video";
  const source = story?.source ?? fromLibrary?.source ?? "YouTube";
  const isSaved = !!fromLibrary;
  const url = `https://www.youtube.com/watch?v=${v}`;

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(`${title}\n${url}`);
        toast({ text: "Link copied" });
      }
    } catch {
      /* cancelled */
    }
  };

  const round = "flex size-11 shrink-0 items-center justify-center rounded-full border border-ink/15";

  return (
    <main className="min-h-dvh bg-paper pb-24">
      <div className="sticky top-0 z-10 bg-black pt-[env(safe-area-inset-top)]">
        <div className="flex h-12 items-center px-2 text-white">
          <button
            aria-label="Back"
            onClick={() => (history.length > 1 ? router.back() : router.push("/news"))}
            className="flex size-11 items-center justify-center"
          >
            <BackIcon size={22} />
          </button>
          <span className="label truncate text-[11px]">{source}</span>
        </div>
        <div className="mx-auto aspect-video w-full max-w-[960px] bg-black">
          {v ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${v}?autoplay=1&playsinline=1&rel=0`}
              title={title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="size-full border-0"
            />
          ) : (
            <p className="flex size-full items-center justify-center text-[14px] text-white/70">This video link isn’t valid.</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[760px] px-5 pt-5">
        <span className="label rounded-full bg-news px-2.5 py-1 text-[10px] text-white">
          {source}
          {story ? ` · ${ago(story.createdAt)}` : ""}
        </span>
        <h1 className="mt-3 text-[22px] leading-[1.2] font-bold">{title}</h1>
        {story && (
          <time dateTime={story.createdAt} className="label mt-2 flex items-center gap-1.5 text-[10px] text-muted">
            <ClockIcon size={13} />
            {newsTime(story.createdAt)}
          </time>
        )}

        <div className="mt-4 flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 grow items-center justify-center gap-2 rounded-full bg-ink text-[14px] font-semibold text-on-ink"
          >
            Open in YouTube <ExternalIcon size={15} />
          </a>
          <button
            aria-label={isSaved ? "Remove from saved" : "Save for later"}
            aria-pressed={isSaved}
            onClick={async () => {
              const nowSaved = await toggleSaved({ id, title, source, image: `https://i.ytimg.com/vi/${v}/hqdefault.jpg` });
              toast(nowSaved ? { text: "Saved to your Library", href: "/library" } : { text: "Removed from saved" });
            }}
            className={round}
          >
            <BookmarkIcon size={18} filled={isSaved} />
          </button>
          <button aria-label="Share" onClick={share} className={round}>
            <ShareIcon size={18} />
          </button>
        </div>

        {story?.summary && (
          <p className="mt-5 text-[15px] leading-[1.6] whitespace-pre-line text-muted">{story.summary}</p>
        )}
        <p className="mt-6 text-[12px] leading-relaxed text-muted">
          If the video doesn’t play here, the channel may only allow it on YouTube. Use Open in YouTube.
        </p>
      </div>
    </main>
  );
}
