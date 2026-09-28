"use client";

import { getProfile, initials } from "@/lib/profile";
import { useStore } from "@/lib/use-store";

// Your profile photo, or your initials on ink.
export function Avatar({ size = 36, className = "" }: { size?: number; className?: string }) {
  const [profile] = useStore(getProfile, { id: "me", updatedAt: 0 });
  return profile.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={profile.avatar}
      alt=""
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  ) : (
    <span
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-ink font-bold text-on-ink ${className}`}
    >
      {initials(profile.name)}
    </span>
  );
}
