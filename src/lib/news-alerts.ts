"use client";

// Breaking-news alerts (Android app only): a background check of the feeds of
// the topics you pick, about every 30 minutes, with at most one alert an hour
// (native/android/NewsAlertWorker.java).
import { registerPlugin } from "@capacitor/core";
import { alertFeeds, type Topic } from "./news";
import { isNative } from "./platform";

type AlertsPlugin = {
  configure(opts: { on: boolean; feeds: { source: string; url: string }[] }): Promise<void>;
  test(): Promise<void>;
};
const Native = registerPlugin<AlertsPlugin>("NewsAlerts");

export type NewsAlerts = { on: boolean; topics: Topic[] };
const KEY = "stack.news-alerts";
const DEFAULT: NewsAlerts = { on: false, topics: ["top"] };

export function getNewsAlerts(): NewsAlerts {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT;
  }
}

/** Saves the choice and (re)schedules the background check. */
export async function setNewsAlerts(a: NewsAlerts) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {}
  await applyNewsAlerts(a);
}

export async function applyNewsAlerts(a = getNewsAlerts()) {
  if (!isNative()) return;
  await Native.configure({ on: a.on && a.topics.length > 0, feeds: alertFeeds(a.topics) });
}

export async function testNewsAlert() {
  await applyNewsAlerts();
  await Native.test();
}
