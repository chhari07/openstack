"use client";

import { useEffect, useState } from "react";
import { useIsNative } from "@/lib/platform";
import { getReminder, notificationsAllowed, setReminder } from "@/lib/reminders";
import { useToast } from "./toast";
import { CloseIcon } from "./icons";

const DISMISSED = "stack.notify-prompt-dismissed";

// One-time card on Today (Android app): offer the daily digest and ask for
// the notification permission in context, not at launch.
export function NotifyPrompt() {
  const native = useIsNative();
  const toast = useToast();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!native || localStorage.getItem(DISMISSED) || getReminder().on) return;
    // Async so the card appears after the first paint.
    notificationsAllowed()
      .catch(() => false)
      .then(() => setShow(true));
  }, [native]);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED, "1");
    setShow(false);
  };

  return (
    <div className="mt-[22px] flex flex-col gap-3 rounded-2xl bg-ink p-4 text-on-ink">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="label text-[10px] text-on-ink/65">Daily digest</span>
          <span className="text-[16px] leading-snug font-semibold">
            Get the top story and your reading every morning at 9:00?
          </span>
        </div>
        <button aria-label="Not now" onClick={dismiss} className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center">
          <CloseIcon size={18} />
        </button>
      </div>
      <button
        onClick={async () => {
          const ok = await setReminder({ ...getReminder(), on: true });
          dismiss();
          toast(
            ok
              ? { text: "Daily digest on · change the time in Settings", href: "/settings", action: "Settings" }
              : { text: "Notifications blocked. You can allow them in Settings." },
          );
        }}
        className="h-11 rounded-full bg-music text-[14px] font-semibold"
      >
        Allow notifications
      </button>
    </div>
  );
}
