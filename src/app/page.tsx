"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TabBar } from "@/components/tab-bar";
import { Logo } from "@/components/logo";
import { MiniPlayer } from "@/components/mini-player";
import { HeroStory, StoryCard } from "@/components/story";
import { NoteCard } from "@/components/note-card";
import { Avatar } from "@/components/avatar";
import { PdfCover } from "@/components/pdf-cover";
import { getNotes, getPdfs } from "@/lib/db";
import { useStore } from "@/lib/use-store";
import { useNews } from "@/lib/use-news";
import { dayStamp } from "@/lib/format";
import { ClockIcon, MenuIcon, PlayIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { NotifyPrompt } from "@/components/notify-prompt";
import { WeekCard } from "@/components/week-card";
import { useFocus, useTick } from "@/components/focus-provider";
import { clockText, remainingMs } from "@/lib/focus";
import { reviewStreak, todaysReview } from "@/lib/review";

function Section({
  n,
  title,
  href,
  link,
  color = "",
}: {
  n: string;
  title: string;
  href: string;
  link: string;
  color?: string;
}) {
  return (
    <div className="mt-[22px] flex items-baseline justify-between">
      <h2 className="label text-[11px] font-medium">
        {n} — {title}
      </h2>
      <Link href={href} className={`label text-[11px] underline ${color}`}>
        {link}
      </Link>
    </div>
  );
}

// Start a focus session, or see the one that's running.
function FocusCard() {
  const { session } = useFocus();
  const live = !!session && !session.endedAt;
  const tick = useTick(live && !session?.pausedAt);
  return (
    <Link
      href="/focus"
      className="mt-5 flex items-center gap-3.5 rounded-2xl bg-ink px-4 py-3.5 text-on-ink"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-music text-white">
        {live ? <ClockIcon size={20} /> : <PlayIcon size={18} />}
      </span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-[16px] font-semibold">
          {!session
            ? "Start a focus session"
            : session.endedAt
              ? "Session complete: see summary"
              : `${clockText(remainingMs(session, tick))} ${session.pausedAt ? "paused" : "left"}`}
        </span>
        <span className="label truncate text-[10px] text-on-ink/65">
          {session ? session.target.title : "Read · music · notes, on a timer"}
        </span>
      </span>
    </Link>
  );
}

// Today's highlights to review; hidden when there's nothing to review.
function ReviewCard() {
  const [{ items, done }] = useStore(todaysReview, { items: [], done: [] });
  if (items.length === 0) return null;
  const left = items.filter((n) => !done.includes(n.id));
  if (left.length === 0) {
    const streak = reviewStreak();
    return (
      <Link href="/review" className="mt-2.5 flex items-center justify-between rounded-2xl bg-news-tint px-4 py-3 text-news-deep">
        <span className="text-[14px] font-semibold">Daily review done</span>
        <span className="label text-[10px]">{streak > 1 ? `${streak}-day streak` : "See you tomorrow"}</span>
      </Link>
    );
  }
  const next = left[0];
  return (
    <Link href="/review" className="mt-2.5 flex flex-col gap-2 rounded-2xl bg-card px-4 py-3.5">
      <span className="flex items-baseline justify-between">
        <span className="label text-[10px] font-medium text-news-text">Daily review</span>
        <span className="label text-[10px] text-muted">
          {left.length} highlight{left.length > 1 ? "s" : ""} to recall
        </span>
      </span>
      <span className="line-clamp-2 font-serif text-[18px] leading-snug italic">“{next.quote}”</span>
      <span className="label truncate text-[9px] text-muted">{next.sourceTitle ?? "Highlight"}</span>
    </Link>
  );
}

export default function Today() {
  const [stamp, setStamp] = useState<{ day: string; date: string } | null>(
    null,
  );
  // Date is read on the client only, so server and client HTML match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setStamp(dayStamp()), []);

  const news = useNews("top");
  const [notes] = useStore(getNotes, []);
  const [pdfs] = useStore(getPdfs, []);

  const top = news.stories[0];
  const more = news.stories.slice(1, 10);
  const reading = [...pdfs]
    .sort((a, b) => (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt))
    .slice(0, 10);
  const recent = notes.slice(0, 8);
  // Rails bleed to the screen edge on phones; tablets keep them in the column.
  const rail = "rail -mx-5 mt-2 gap-3 px-5 md:mx-0 md:px-0";

  return (
    <main className="px-5 pt-5 pb-[180px] md:px-10 md:pt-8 md:pb-28">
      <div className="flex h-8 items-center justify-between md:hidden">
        <Logo size={30} animate className="-ml-1.5" />
        <div className="-mr-2.5 flex items-center">
          <Link href="/search" aria-label="Search everything" className="flex size-11 items-center justify-center">
            <SearchIcon size={22} />
          </Link>
          <Link href="/account" aria-label="Your account" className="flex size-11 items-center justify-center">
            <Avatar size={30} />
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex size-11 items-center justify-center"
          >
            <MenuIcon size={22} />
          </Link>
        </div>
      </div>
      <h1 className="display -ml-2.5 mt-2.5 text-[clamp(96px,33vw,150px)] md:mt-0 md:text-[clamp(150px,22vw,260px)]">
        STACK
      </h1>
      <div className="mt-2.5 flex justify-between">
        <span className="label text-[11px]">Your day</span>
        <span className="label text-[11px]">
          {stamp ? `${stamp.day} ${stamp.date}` : ""}
        </span>
      </div>

      <FocusCard />
      <ReviewCard />
      <WeekCard />
      <NotifyPrompt />

      <div className="md:mt-4 md:grid md:grid-cols-[1.45fr_1fr] md:items-start md:gap-10">
        <div>
          <Section
            n="01"
            title="Top story"
            href="/news"
            link="All news"
            color="text-news-text"
          />
          <div className="mt-2 flex flex-col md:[&>a]:h-[400px]!">
            {top ? (
              <HeroStory story={top} height={180} />
            ) : (
              <div className="flex h-[180px] items-center justify-center rounded-2xl bg-soft">
                <span className="label text-[10px] text-[#BDBAB2]">
                  {news.status === "error"
                    ? "Couldn't load news"
                    : "Loading news…"}
                </span>
              </div>
            )}
          </div>
          {more.length > 0 && (
            <>
              <Section
                n="02"
                title="More stories"
                href="/news"
                link="See all"
                color="text-news-text"
              />
              <div role="list" aria-label="More stories" className={rail}>
                {more.map((st) => (
                  <div key={st.id} role="listitem">
                    <StoryCard story={st} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div>
          <Section
            n="03"
            title="Continue reading"
            href="/library"
            link="Library"
          />
          {reading.length > 0 ? (
            <div role="list" aria-label="Your PDFs" className={rail}>
              {reading.map((p) => (
                <Link
                  key={p.id}
                  role="listitem"
                  href={`/library/read?id=${p.id}`}
                  className="flex w-[112px] flex-col gap-1.5"
                >
                  <PdfCover id={p.id} title={p.title} className="h-[152px] w-[112px]" />
                  <span className="line-clamp-2 font-serif text-[14px] leading-[1.15] font-semibold">
                    {p.title}
                  </span>
                  <div className="h-[3px] rounded-sm bg-rule">
                    <div
                      className="h-[3px] rounded-sm bg-ink"
                      style={{ width: `${(p.lastPage / Math.max(1, p.pages)) * 100}%` }}
                    />
                  </div>
                  <span className="label text-[9px] text-muted">
                    p. {p.lastPage} / {p.pages}
                  </span>
                </Link>
              ))}
              <Link
                href="/library"
                className="flex h-[152px] w-[112px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-ink/25 text-muted"
              >
                <PlusIcon size={20} />
                <span className="label text-[9px]">Add PDF</span>
              </Link>
            </div>
          ) : (
            <Link
              href="/library"
              className="mt-2 flex h-[88px] items-center justify-center rounded-xl border border-dashed border-ink/25"
            >
              <span className="label text-[10px] text-muted">
                Add your first PDF
              </span>
            </Link>
          )}

          <Section n="04" title="Recent notes" href="/notes" link="Notes" />
          <div role="list" aria-label="Recent notes" className={`${rail} items-start`}>
            {recent.map((n) => (
              <div key={n.id} role="listitem" className="w-[216px]">
                <NoteCard note={n} compact />
              </div>
            ))}
            <Link
              href="/notes/edit"
              className={`flex w-[150px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-ink/25 text-muted ${recent.length ? "h-[120px]" : "h-[88px]"}`}
            >
              <PlusIcon size={20} />
              <span className="label text-[9px]">New note</span>
            </Link>
          </div>
        </div>
      </div>

      <MiniPlayer />
      <TabBar />
    </main>
  );
}
