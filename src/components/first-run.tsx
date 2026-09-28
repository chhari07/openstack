"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const KEY = "stack.onboarded";

export function markOnboarded() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* storage blocked */
  }
}

// Opens the welcome screen the first time Stack starts.
export function FirstRun() {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(KEY) === "1";
    } catch {
      /* storage blocked: don't loop on the welcome screen */
    }
    if (!seen && path === "/") router.replace("/welcome");
  }, [path, router]);
  return null;
}
