"use client";

import { useEffect, useState } from "react";
import { useToast } from "./toast";
import { TopicIcon } from "./topic-icon";
import { ALERT_TOPICS, TOPICS } from "@/lib/news";
import { getNewsAlerts, setNewsAlerts, testNewsAlert, type NewsAlerts } from "@/lib/news-alerts";
import { askForNotifications, notificationsAllowed } from "@/lib/reminders";
import { useIsNative } from "@/lib/platform";

const SWITCH =
  "h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-rule transition-colors before:block before:size-6 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-news checked:before:translate-x-[22px]";

// Settings → Breaking news: on/off, which topics, and a test alert.
export function NewsAlertsSection() {
  const native = useIsNative();
  const toast = useToast();
  const [alerts, setAlerts] = useState<NewsAlerts | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setAlerts(getNewsAlerts()), []);

  if (!native || !alerts) {
    return <p className="text-[14px] text-muted">Breaking-news alerts are available in the Android app.</p>;
  }

  const save = async (next: NewsAlerts) => {
    if (next.on && !(await notificationsAllowed()) && !(await askForNotifications())) {
      toast({ text: "Notifications are blocked for Stack" });
      return;
    }
    setAlerts(next);
    await setNewsAlerts(next);
  };

  return (
    <>
      <label className="flex items-center justify-between gap-4">
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">Breaking-news alerts</span>
          <span className="text-[13px] text-muted">A notification when a new top story appears</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={alerts.on}
          onChange={(e) => save({ ...alerts, on: e.target.checked })}
          className={SWITCH}
        />
      </label>
      {alerts.on && (
        <>
          <div role="group" aria-label="Alert topics" className="flex flex-wrap gap-2">
            {ALERT_TOPICS.map((t) => {
              const on = alerts.topics.includes(t);
              return (
                <button
                  key={t}
                  aria-pressed={on}
                  onClick={() =>
                    save({ ...alerts, topics: on ? alerts.topics.filter((x) => x !== t) : [...alerts.topics, t] })
                  }
                  className={`label flex h-8 items-center gap-1.5 rounded-full px-3 text-[10px] ${on ? "bg-ink text-on-ink" : "border border-ink/20"}`}
                >
                  <TopicIcon topic={t} size={14} />
                  {TOPICS.find((x) => x.value === t)?.label}
                </button>
              );
            })}
          </div>
          <p className="text-[12px] leading-relaxed text-muted">
            {alerts.topics.length === 0
              ? "Pick at least one topic."
              : "Checked about every 30 minutes, with at most one alert an hour, so it never floods you."}
          </p>
          <button
            onClick={async () => {
              await testNewsAlert();
              toast({ text: "Test alert on its way (a few seconds)" });
            }}
            className="h-11 rounded-full border border-ink/15 text-[14px] font-semibold"
          >
            Send a test alert
          </button>
        </>
      )}
    </>
  );
}
