"use client";

import { registerPlugin } from "@capacitor/core";

// See native/android/AppSettingsPlugin.java (Android app only).
export const AppSettings = registerPlugin<{
  open(opts: { page?: "app" | "notifications" }): Promise<void>;
  openSpotify(opts: { uri?: string }): Promise<{ opened: boolean }>;
}>("AppSettings");
