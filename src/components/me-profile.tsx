"use client";

import Link from "next/link";
import { useState } from "react";
import { HEAT_WEEKS, EMPTY_STATS, getMeStats, type Badge, type MeStats } from "@/lib/me-stats";
import { TOPICS } from "@/lib/news";
import { DEFAULT_GOAL, accentOf, getProfile, moodIcon, type Profile } from "@/lib/profile";
import { useStore } from "@/lib/use-store";
import { Avatar } from "./avatar";
import { NamedIcon } from "./profile-icons";
import { TopicIcon } from "./topic-icon";
import { ProfileSheet } from "./profile-sheet";
import { Sheet } from "./sheet";

// The top of the YOU page: a cover in your colour, photo, name, status, bio,
// interests and your reader type, with "Edit profile".
export function ProfileHero() {
  const [profile] = useStore(getProfile, { id: "me", updatedAt: 0 } as Profile);
  const [stats] = useStore(getMeStats, EMPTY_STATS);
  const [editing, setEditing] = useState(false);
  const accent = accentOf(profile.accent);

  return (
    <section className="overflow-hidden rounded-[26px] bg-card">
      <div className={`relative h-24 ${accent.bg}`}>
        {/* A quiet pattern of stacked blocks, like the logo. */}
        <svg aria-hidden className={`absolute inset-0 h-full w-full opacity-15 ${accent.text}`}>
          <defs>
            <pattern id="blocks" width="28" height="28" patternUnits="userSpaceOnUse">
              <rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor" />
              <rect x="17" y="17" width="8" height="8" rx="2" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#blocks)" />
        </svg>
        <button
          onClick={() => setEditing(true)}
          className="absolute top-3 right-3 h-9 rounded-full bg-paper/90 px-4 text-[13px] font-semibold text-ink"
        >
          Edit profile
        </button>
      </div>
      <div className="relative -mt-10 flex flex-col gap-2 px-5 pb-5">
        <button onClick={() => setEditing(true)} aria-label="Edit profile" className="self-start rounded-full ring-4 ring-card">
          <Avatar size={84} />
        </button>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 className="text-[24px] leading-tight font-bold">{profile.name || "Your name"}</h2>
          {profile.mood && (
            <span className="flex items-center gap-1.5 rounded-full bg-paper-2 py-1 pr-2.5 pl-2 text-[12px] font-medium">
              <NamedIcon name={moodIcon(profile.mood)} size={15} />
              {profile.mood.text}
            </span>
          )}
        </div>
        {profile.bio ? (
          <p className="text-[15px] leading-snug text-prose">{profile.bio}</p>
        ) : (
          <button onClick={() => setEditing(true)} className="self-start text-[14px] text-muted underline">
            {profile.mood || profile.interests?.length ? "Add a bio" : "Add a bio, a status and your interests"}
          </button>
        )}
        {!!profile.interests?.length && (
          <div className="flex flex-wrap gap-1.5">
            {profile.interests.map((t) => (
              <span key={t} className="label flex items-center gap-1 rounded-full bg-news-tint py-1 pr-2.5 pl-2 text-[9px] text-news-deep">
                <TopicIcon topic={t} size={12} />
                {TOPICS.find((x) => x.value === t)?.label ?? t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-paper-2 p-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-card">
            <NamedIcon name={stats.type.icon} size={24} />
          </span>
          <div className="min-w-0">
            <p className="label text-[9px] text-muted">
              Reader type{stats.timeOfDay === "night" ? " · night owl" : stats.timeOfDay === "early" ? " · early bird" : ""}
            </p>
            <p className="text-[16px] font-bold">{stats.type.title}</p>
            <p className="text-[13px] leading-snug text-muted">{stats.type.line}</p>
          </div>
        </div>
      </div>
      <ProfileSheet open={editing} onClose={() => setEditing(false)} profile={profile} />
    </section>
  );
}

// Totals, the daily goal ring, streaks, the activity heatmap and badges.
export function MeStatsView() {
  const [stats, ready] = useStore(getMeStats, EMPTY_STATS);
  const [profile] = useStore(getProfile, { id: "me", updatedAt: 0 } as Profile);
  if (!ready) return null;
  const goal = profile.dailyGoal ?? DEFAULT_GOAL;

  return (
    <>
      <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-4 rounded-[22px] bg-card p-4">
        <GoalRing minutes={stats.todayMinutes} goal={goal} />
        <div className="flex flex-col gap-1">
          <p className="label text-[9px] text-muted">Today’s focus</p>
          <p className="text-[17px] leading-snug font-bold">
            {stats.todayMinutes >= goal
              ? "Goal done. Nice work!"
              : stats.todayMinutes > 0
                ? `${goal - stats.todayMinutes} min to go`
                : `Your goal is ${goal} min`}
          </p>
          <Link href="/focus" className="label self-start text-[10px] text-music-text underline">
            Start a focus session
          </Link>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Streak icon="streak" tint="text-music-text" value={stats.activeStreak} label="Day streak" />
        <Streak icon="target" tint="text-news-text" value={stats.focusStreak} label="Focus streak" />
        <Streak icon="brain" tint="text-blue-deep" value={stats.reviewStreak} label="Review streak" />
      </div>

      <h2 className="label mt-8 text-[11px] font-medium">Your Stack in numbers</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat value={stats.notes} label="Notes" tint="bg-card" />
        <Stat value={stats.highlights} label="Highlights" tint="bg-pdf-tint" />
        <Stat value={stats.saved} label="Saved articles" tint="bg-news-tint" />
        <Stat value={stats.pdfs} label="PDFs" tint="bg-card" />
        <Stat value={stats.pagesRead} label="Pages read" tint="bg-blue-tint" />
        <Stat
          value={stats.focusMinutes >= 120 ? Math.round(stats.focusMinutes / 6) / 10 : stats.focusMinutes}
          unit={stats.focusMinutes >= 120 ? "h" : "min"}
          label="Focused"
          tint="bg-music-tint"
        />
      </div>

      <h2 className="label mt-8 text-[11px] font-medium">Activity</h2>
      <Heatmap stats={stats} />

      <Badges badges={stats.badges} />
    </>
  );
}

function GoalRing({ minutes, goal }: { minutes: number; goal: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const done = Math.min(1, minutes / goal);
  return (
    <div className="relative size-[76px]">
      <svg viewBox="0 0 76 76" className="size-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" strokeWidth="8" className="stroke-paper-2" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - done)}
          className={`transition-[stroke-dashoffset] duration-700 ${done >= 1 ? "stroke-news" : "stroke-music"}`}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[18px] leading-none font-bold">{minutes}</span>
        <span className="label text-[8px] text-muted">/{goal} min</span>
      </span>
    </div>
  );
}

function Streak({ icon, tint, value, label }: { icon: string; tint: string; value: number; label: string }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 rounded-2xl p-3 ${value > 0 ? "bg-card" : "bg-card/60"}`}>
      <NamedIcon name={icon} size={22} className={value > 0 ? tint : "text-muted opacity-50"} />
      <span className="text-[20px] leading-tight font-bold">{value}</span>
      <span className="label text-center text-[8px] text-muted">{label}</span>
    </div>
  );
}

function Stat({ value, unit, label, tint }: { value: number; unit?: string; label: string; tint: string }) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl p-4 ${tint}`}>
      <span className="display text-[40px]">
        {value.toLocaleString()}
        {unit && <span className="ml-0.5 text-[20px]">{unit}</span>}
      </span>
      <span className="label text-[9px] text-muted">{label}</span>
    </div>
  );
}

const LEVELS = ["bg-ink/8", "bg-news/35", "bg-news/60", "bg-news/85", "bg-news-deep"];
const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4);

// GitHub-style grid: one column per week, one square per day.
function Heatmap({ stats }: { stats: MeStats }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeDays = stats.heat.filter((n) => n > 0).length;
  const months: { col: number; label: string }[] = [];
  for (let w = 0; w < HEAT_WEEKS; w++) {
    const d = new Date(stats.heatStart + w * 7 * 86_400_000);
    const label = d.toLocaleString(undefined, { month: "short" });
    if (!months.length || months[months.length - 1].label !== label) {
      // A month that starts right after the first column pushes out the first label.
      if (months.length === 1 && w - months[0].col < 3) months.pop();
      months.push({ col: w, label });
    }
  }
  return (
    <div className="mt-3 rounded-[22px] bg-card p-4">
      <div className="no-scrollbar overflow-x-auto">
        <div className="inline-grid grid-flow-col grid-rows-[auto_repeat(7,12px)] gap-[3px]">
          {Array.from({ length: HEAT_WEEKS }, (_, w) => (
            <div key={w} className="contents">
              <span className="label h-3 text-[8px] whitespace-nowrap text-muted">
                {months.find((m) => m.col === w && w < HEAT_WEEKS - 1)?.label ?? ""}
              </span>
              {Array.from({ length: 7 }, (_, d) => {
                const i = w * 7 + d;
                const t = stats.heatStart + i * 86_400_000;
                const future = t > today.getTime();
                const n = stats.heat[i] ?? 0;
                return (
                  <span
                    key={d}
                    title={future ? undefined : `${new Date(t).toDateString()}: ${n} thing${n === 1 ? "" : "s"}`}
                    className={`size-3 rounded-[3px] ${future ? "" : LEVELS[level(n)]} ${
                      t === today.getTime() ? "ring-1 ring-ink" : ""
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted">
          {activeDays} active day{activeDays === 1 ? "" : "s"} · best streak {stats.bestStreak}
        </span>
        <span className="flex items-center gap-[3px]" aria-hidden>
          <span className="label mr-1 text-[8px] text-muted">Less</span>
          {LEVELS.map((c) => (
            <span key={c} className={`size-2.5 rounded-[2px] ${c}`} />
          ))}
          <span className="label ml-1 text-[8px] text-muted">More</span>
        </span>
      </div>
    </div>
  );
}

function Badges({ badges }: { badges: Badge[] }) {
  const [open, setOpen] = useState<Badge | null>(null);
  const earned = badges.filter((b) => b.value >= b.target).length;
  return (
    <>
      <h2 className="label mt-8 flex justify-between text-[11px] font-medium">
        Badges
        <span className="text-muted">
          {earned}/{badges.length}
        </span>
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {badges.map((b) => {
          const got = b.value >= b.target;
          const pct = Math.min(100, Math.round((b.value / b.target) * 100));
          return (
            <button
              key={b.id}
              onClick={() => setOpen(b)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center ${got ? "bg-card" : "bg-card/50"}`}
            >
              <span
                className={`flex size-12 items-center justify-center rounded-full ${
                  got ? "bg-pdf-tint text-pdf-deep" : "bg-paper-2 text-muted opacity-60"
                }`}
              >
                <NamedIcon name={b.icon} size={24} />
              </span>
              <span className={`text-[12px] leading-tight font-semibold ${got ? "" : "text-muted"}`}>{b.title}</span>
              {!got && (
                <span className="h-1 w-full overflow-hidden rounded-full bg-paper-2">
                  <span className="block h-full rounded-full bg-pdf" style={{ width: `${pct}%` }} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ""}>
        {open && (
          <div className="flex flex-col items-center gap-3 pb-2 text-center">
            <span
              className={`flex size-20 items-center justify-center rounded-full ${
                open.value >= open.target ? "bg-pdf-tint text-pdf-deep" : "bg-paper-2 text-muted"
              }`}
            >
              <NamedIcon name={open.icon} size={38} />
            </span>
            <p className="text-[16px]">{open.hint}</p>
            <p className="label text-[11px] text-muted">
              {open.value >= open.target
                ? "Earned ✓"
                : `${Math.min(open.value, open.target).toLocaleString()} / ${open.target.toLocaleString()}`}
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}
