"use client";

import Link from "next/link";
import { useStore } from "@/lib/use-store";
import { getWeek, minutesText, type Week } from "@/lib/reading";

const EMPTY: Week = { minutes: 0, articles: 0, pages: 0, days: [], todayMinutes: 0, lastWeekMinutes: 0 };

// "This week" on Today: time read, articles finished, PDF pages, a bar per day.
export function WeekCard() {
  const [week, ready] = useStore(getWeek, EMPTY);
  if (!ready) return null;
  const top = Math.max(15, ...week.days.map((d) => d.minutes));
  const diff = week.minutes - week.lastWeekMinutes;
  const compare =
    week.lastWeekMinutes === 0
      ? null
      : diff >= 0
        ? `↑ ${minutesText(diff)} on last week`
        : `↓ ${minutesText(-diff)} on last week`;

  return (
    <Link
      href="/account"
      aria-label={`This week: ${minutesText(week.minutes)} read, ${week.articles} articles, ${week.pages} PDF pages`}
      className="mt-3 flex items-end gap-4 rounded-2xl bg-card px-4 py-3.5"
    >
      <div className="flex min-w-0 grow flex-col gap-1">
        <span className="label text-[10px] text-muted">This week</span>
        <span className="text-[22px] leading-none font-bold">
          {week.minutes ? minutesText(week.minutes) : "0m"} <span className="text-[14px] font-medium text-muted">read</span>
        </span>
        <span className="label truncate text-[10px]">
          {week.articles} article{week.articles === 1 ? "" : "s"} · {week.pages} page{week.pages === 1 ? "" : "s"}
          {week.todayMinutes ? ` · ${minutesText(week.todayMinutes)} today` : ""}
        </span>
        {compare && <span className="label text-[9px] text-muted">{compare}</span>}
        {!week.minutes && !week.articles && !week.pages && (
          <span className="text-[12px] text-muted">Open an article or PDF and your reading shows up here.</span>
        )}
      </div>
      <div aria-hidden className="flex h-[64px] shrink-0 items-end gap-[5px]">
        {week.days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="flex h-[48px] w-[9px] items-end rounded-full bg-rule">
              <div
                className={`w-[9px] rounded-full ${d.today ? "bg-news" : "bg-ink"}`}
                style={{ height: `${d.minutes ? Math.max(12, (d.minutes / top) * 100) : 0}%` }}
              />
            </div>
            <span className={`label text-[8px] ${d.today ? "text-news-text" : "text-muted"}`}>{d.label}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}
