"use client";

// The daily digest notification (Android app only). It's a local notification
// scheduled on the phone: no push server, nothing leaves the device.
import { LocalNotifications } from "@capacitor/local-notifications";
import { getPdfs } from "./db";
import { loadNews } from "./platform";
import { nextHighlight } from "./review";

const KEY = "stack.reminder";
const DIGEST_ID = 1001;

export type Reminder = { on: boolean; hour: number; minute: number };
const DEFAULT: Reminder = { on: false, hour: 9, minute: 0 };

export function getReminder(): Reminder {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT;
  }
}

function saveReminder(r: Reminder) {
  localStorage.setItem(KEY, JSON.stringify(r));
}

export async function notificationsAllowed() {
  return (await LocalNotifications.checkPermissions()).display === "granted";
}

// Shows Android's "Allow Stack to send you notifications?" prompt.
export async function askForNotifications() {
  const status = await LocalNotifications.requestPermissions();
  return status.display === "granted";
}

// What the digest says: today's top story and the PDF in progress.
async function digestText() {
  const [stories, pdfs, highlight] = await Promise.all([
    loadNews("top").catch(() => []),
    getPdfs(),
    nextHighlight().catch(() => null),
  ]);
  const top = stories[0];
  const reading = [...pdfs].sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0];
  const quote = highlight?.quote
    ? highlight.quote.length > 110
      ? `${highlight.quote.slice(0, 110)}…`
      : highlight.quote
    : "";
  const lines = [
    top ? `Top story: ${top.title}` : "Fresh stories from Hacker News and dev.to",
    reading ? `Continue “${reading.title}” at p. ${reading.lastPage}` : "",
    quote ? `Remember: “${quote}”` : "",
  ].filter(Boolean);
  // With a highlight waiting, tapping opens the daily review.
  return { body: lines.join("\n"), href: quote ? "/review" : top ? `/read?id=${top.id}` : "/news" };
}

// (Re)schedules the daily digest. Called when settings change and each time
// the app opens, so the text stays close to what's current.
export async function scheduleDigest(r = getReminder()) {
  await LocalNotifications.cancel({ notifications: [{ id: DIGEST_ID }] }).catch(() => {});
  if (!r.on || !(await notificationsAllowed())) return;
  const { body, href } = await digestText();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: DIGEST_ID,
        title: "Your tech day",
        body,
        largeBody: body,
        schedule: { on: { hour: r.hour, minute: r.minute }, allowWhileIdle: true },
        isExactNotification: false,
        extra: { href },
      },
    ],
  });
}

export async function setReminder(r: Reminder) {
  if (r.on && !(await notificationsAllowed()) && !(await askForNotifications())) {
    saveReminder({ ...r, on: false });
    return false;
  }
  saveReminder(r);
  await scheduleDigest(r);
  return true;
}

export async function sendTestNotification() {
  if (!(await notificationsAllowed()) && !(await askForNotifications())) return false;
  const { body, href } = await digestText();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.floor(Math.random() * 100000) + 2000,
        title: "Your tech day",
        body,
        largeBody: body,
        // No schedule = show right away. Never ask for the exact-alarm permission.
        isExactNotification: false,
        extra: { href },
      },
    ],
  });
  return true;
}
