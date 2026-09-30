"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { App } from "@capacitor/app";
import { registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "@/lib/platform";
import { countPage } from "@/lib/nav";
import { importShared, RESULT_KEY, resultTitle, ShareIn, type ShareResult } from "@/lib/share-in";
import { useToast } from "./toast";
import { scheduleDigest } from "@/lib/reminders";
import { applyNewsAlerts } from "@/lib/news-alerts";
import { applyTheme, watchSystemTheme } from "@/lib/theme";

const Splash = registerPlugin<{ hide(): Promise<void> }>("Splash");

// Android-app-only startup work: open the right screen when a notification is
// tapped, and refresh tomorrow's digest text.
export function NativeBoot() {
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();

  useEffect(() => countPage(path), [path]);

  // Theme: status bar colour, and follow the phone in "system" mode (web too).
  useEffect(() => {
    applyTheme();
    return watchSystemTheme();
  }, []);

  useEffect(() => {
    if (!isNative()) return;
    // First screen is painted: let the native splash go (next frame, so it's on screen).
    requestAnimationFrame(() => Splash.hide().catch(() => {}));
    const sub = LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
      const href = notification.extra?.href;
      if (typeof href === "string" && href.startsWith("/")) router.push(href);
    });
    // Breaking-news alerts open com.chhari.stack://open?href=/read?id=…
    const openLink = (url?: string) => {
      if (!url?.startsWith("com.chhari.stack://open")) return;
      const href = new URL(url).searchParams.get("href");
      if (href?.startsWith("/")) router.push(href);
    };
    const opened = App.addListener("appUrlOpen", ({ url }) => openLink(url));
    App.getLaunchUrl()
      .then((l) => {
        // Only once per launch, not again after a reload.
        if (!l?.url || sessionStorage.getItem("stack.launch-url") === l.url) return;
        sessionStorage.setItem("stack.launch-url", l.url);
        openLink(l.url);
      })
      .catch(() => {});
    applyNewsAlerts().catch(() => {});
    scheduleDigest().catch(() => {});

    // Share to Stack: import what the share card saved, at launch, when Stack
    // comes back to the front, and when a share arrives while it's open.
    // One import at a time, so an item is never saved twice.
    let busy = Promise.resolve();
    const importInbox = () => {
      busy = busy.then(async () => {
        const { items, open } = await ShareIn.takeInbox().catch(() => ({ items: [], open: false }));
        let last: ShareResult | null = null;
        for (const item of items) {
          last = await importShared(item);
          // Confirm each one as it's saved, so none is lost or saved twice.
          await ShareIn.ackInbox({ count: 1 }).catch(() => {});
        }
        if (open && last) {
          sessionStorage.setItem(RESULT_KEY, JSON.stringify(last));
          router.push(`/share?t=${Date.now()}`);
        } else if (last && last.kind !== "error") {
          toast({
            text: items.length > 1 ? `${items.length} items saved from other apps` : `Saved “${resultTitle(last)}”`,
            href: last.kind === "note" ? "/notes" : "/library",
          });
        }
      });
    };
    importInbox();
    const shared = ShareIn.addListener("shared", importInbox);
    const resumed = App.addListener("resume", importInbox);
    return () => {
      sub.then((s) => s.remove());
      opened.then((s) => s.remove());
      shared.then((s) => s.remove());
      resumed.then((s) => s.remove());
    };
  }, [router, toast]);

  return null;
}
