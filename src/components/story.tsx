"use client";

import Link from "next/link";
import { ago } from "@/lib/format";
import { safeImage, type Story } from "@/lib/use-news";

const readHref = (s: Story) => `/read?id=${s.id}`;

// The reader gets the headline, image and summary from the list, so a page
// that can't be fetched still shows something useful.
export function rememberStory(s: Story) {
  try {
    sessionStorage.setItem(`stack.story:${s.id}`, JSON.stringify(s));
  } catch {}
}
const meta = (s: Story) =>
  s.readMinutes ? `${s.source} · ${s.readMinutes} min` : `${s.source} · ${s.domain ?? ""}`;

// Dark hero card from the TechCrunch-style reference.
export function HeroStory({ story, height = 200 }: { story: Story; height?: number }) {
  const img = safeImage(story.image);
  return (
    <Link
      href={readHref(story)}
      onClick={() => rememberStory(story)}
      style={{ height }}
      className="relative flex shrink-0 flex-col justify-end overflow-hidden rounded-2xl bg-soft p-[18px] text-white"
    >
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" decoding="async" className="absolute inset-0 size-full object-cover opacity-55" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <span className="label absolute top-4 left-[18px] rounded-full bg-news px-2 py-1 text-[10px]">
        {story.source} · {ago(story.createdAt)}
      </span>
      {!img && story.domain && (
        <span className="label absolute top-4 right-[18px] text-[10px] text-[#8C8A84]">{story.domain}</span>
      )}
      <span className="relative line-clamp-3 text-[20px] leading-[1.22] font-bold">{story.title}</span>
      <span className="label relative mt-2.5 text-[10px] text-[#BDBAB2]">
        {story.points !== undefined
          ? `${story.points} pts · ${story.comments ?? 0} comments`
          : story.summary
            ? story.summary.slice(0, 70) + (story.summary.length > 70 ? "…" : "")
            : story.domain}
      </span>
    </Link>
  );
}

// Small card for horizontal rows ("More stories" on Today).
export function StoryCard({ story }: { story: Story }) {
  const img = safeImage(story.image);
  return (
    <Link
      href={readHref(story)}
      onClick={() => rememberStory(story)}
      className="relative flex h-[168px] w-[236px] flex-col justify-end overflow-hidden rounded-2xl bg-soft p-3.5 text-white"
    >
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover opacity-50"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
      <span className="label absolute top-3 left-3.5 max-w-[80%] truncate rounded-full bg-black/45 px-2 py-1 text-[9px]">
        {story.source} · {ago(story.createdAt)}
      </span>
      <span className="relative line-clamp-3 text-[15px] leading-[1.25] font-bold">{story.title}</span>
    </Link>
  );
}

const THUMBS = ["#2F4B3A", "#54473A", "#3A3A37", "#2C3E57", "#4A2F3A"];

export function StoryRow({ story, index }: { story: Story; index: number }) {
  const img = safeImage(story.image);
  return (
    <Link href={readHref(story)} onClick={() => rememberStory(story)} className="flex gap-3.5 border-b border-line py-3.5">
      <div className="flex min-w-0 grow flex-col gap-2">
        <span className="line-clamp-3 text-[15px] leading-[1.3] font-semibold">{story.title}</span>
        <span className="label text-[10px] text-muted">
          {meta(story)} · {ago(story.createdAt)}
        </span>
      </div>
      <div
        className="flex h-[72px] w-[92px] shrink-0 items-end overflow-hidden rounded-[10px] p-2"
        style={{ background: THUMBS[index % THUMBS.length] }}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" loading="lazy" decoding="async" className="-m-2 h-[72px] w-[92px] max-w-none object-cover" />
        ) : (
          <span className="label truncate text-[8px] text-white/70">{story.domain}</span>
        )}
      </div>
    </Link>
  );
}

export function StorySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="animate-pulse">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3.5 border-b border-line py-3.5">
          <div className="flex grow flex-col gap-2">
            <div className="h-4 w-11/12 rounded bg-rule" />
            <div className="h-4 w-2/3 rounded bg-rule" />
          </div>
          <div className="h-[72px] w-[92px] rounded-[10px] bg-rule" />
        </div>
      ))}
    </div>
  );
}
