"use client";

// PDFs on the phone (Android app only): the whole phone with "All files
// access", or one folder picked with Android's own picker.
// See native/android/PhoneFilesPlugin.java.
import { useCallback, useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { isNative } from "./platform";

export type PhoneFile = { uri: string; name: string; path: string; size: number; modified: number };

type PhoneFilesPlugin = {
  allFilesStatus(): Promise<{ granted: boolean }>;
  requestAllFiles(): Promise<{ granted: boolean; openedSettings?: boolean }>;
  scanPdfs(): Promise<{ files: PhoneFile[] }>;
  getFolder(): Promise<{ name?: string }>;
  pickFolder(): Promise<{ name: string }>;
  forgetFolder(): Promise<void>;
  listPdfs(): Promise<{ files: PhoneFile[] }>;
  copyToCache(opts: { uri: string }): Promise<{ path: string }>;
  clearCache(): Promise<void>;
};

export const PhoneFiles = registerPlugin<PhoneFilesPlugin>("PhoneFiles");

// Loads one PDF from the phone as a File, ready for the normal "add PDF" flow.
export async function readPhoneFile(f: PhoneFile): Promise<File> {
  // A plain file path (all-files access): the WebView can read it directly.
  if (f.uri.startsWith("/")) {
    const res = await fetch(Capacitor.convertFileSrc(f.uri));
    if (!res.ok) throw new Error(`read ${res.status}`);
    return new File([await res.blob()], f.name, { type: "application/pdf" });
  }
  const { path } = await PhoneFiles.copyToCache({ uri: f.uri });
  try {
    const res = await fetch(Capacitor.convertFileSrc(path));
    if (!res.ok) throw new Error(`read ${res.status}`);
    return new File([await res.blob()], f.name, { type: "application/pdf" });
  } finally {
    PhoneFiles.clearCache().catch(() => {});
  }
}

export function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// "All files access" status, re-checked whenever Stack comes back to the
// front (the switch lives in Android Settings).
export function useAllFiles() {
  const [granted, setGranted] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    if (!isNative()) return;
    const r = await PhoneFiles.allFilesStatus().catch(() => ({ granted: false }));
    setGranted(r.granted);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const request = useCallback(async () => {
    const r = await PhoneFiles.requestAllFiles().catch(() => ({ granted: false }));
    setGranted(r.granted);
    return r.granted;
  }, []);

  return { granted, request, refresh };
}
