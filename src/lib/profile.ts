"use client";

// Your profile: name and photo. Stored like everything else (IndexedDB) and
// synced to your account when you're signed in.
import { get, set } from "idb-keyval";
import { emit } from "./db";
import { track } from "./sync-state";

export type Profile = {
  id: "me";
  name?: string;
  avatar?: string; // small JPEG data URL (lib/image.ts)
  updatedAt: number;
};

export async function getProfile(): Promise<Profile> {
  return (await get<Profile>("profile")) ?? { id: "me", updatedAt: 0 };
}

export async function saveProfile(patch: Partial<Omit<Profile, "id">>) {
  const next: Profile = { ...(await getProfile()), ...patch, id: "me", updatedAt: Date.now() };
  await set("profile", next);
  await track("profile", "me");
  emit();
  return next;
}

export const initials = (name?: string) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "S";
