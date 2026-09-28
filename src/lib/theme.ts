"use client";

import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

import { THEME_KEY } from "./theme-boot";

export type Theme = "system" | "light" | "dark";

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "dark" || t === "light" ? t : "system";
  } catch {
    return "system";
  }
}

const isDark = (t: Theme) =>
  t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

// Status bar icons and browser chrome follow the theme.
export function applyTheme(t: Theme = getTheme()) {
  const root = document.documentElement;
  if (t === "system") delete root.dataset.theme;
  else root.dataset.theme = t;
  const dark = isDark(t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#141413" : "#F7F5F0");
  if (Capacitor.isNativePlatform()) {
    SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
  }
}

export function setTheme(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {}
  applyTheme(t);
}

// Keeps the status bar right when the phone switches light/dark in "system" mode.
export function watchSystemTheme() {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => getTheme() === "system" && applyTheme("system");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
