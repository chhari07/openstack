"use client";

import { useEffect, useState } from "react";
import { pickImage } from "@/lib/image";
import { getProfile, saveProfile } from "@/lib/profile";
import { useStore } from "@/lib/use-store";
import { Avatar } from "./avatar";

// Photo + name. Saves as you go.
export function ProfileEditor() {
  const [profile, ready] = useStore(getProfile, { id: "me", updatedAt: 0 });
  const [name, setName] = useState("");

  // Fill the field once the stored (or synced) profile arrives.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ready) setName(profile.name ?? "");
  }, [ready, profile.name]);

  const choosePhoto = async () => {
    const avatar = await pickImage(384);
    if (avatar) await saveProfile({ avatar });
  };

  return (
    <div className="flex items-center gap-4">
      <button onClick={choosePhoto} aria-label="Change profile photo" className="relative shrink-0">
        <Avatar size={84} />
        <span className="label absolute -right-1 -bottom-1 rounded-full bg-music px-2 py-1 text-[9px] text-white">
          {profile.avatar ? "Edit" : "Add"}
        </span>
      </button>
      <div className="flex min-w-0 grow flex-col gap-1.5">
        <label className="label text-[10px] text-muted" htmlFor="profile-name">
          Your name
        </label>
        <input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() !== (profile.name ?? "") && saveProfile({ name: name.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          placeholder="What should Stack call you?"
          autoComplete="name"
          className="h-12 w-full rounded-xl border border-ink/15 bg-card px-4 text-[17px] font-semibold outline-none focus:border-ink"
        />
        {profile.avatar && (
          <button onClick={() => saveProfile({ avatar: undefined })} className="label self-start text-[9px] text-muted underline">
            Remove photo
          </button>
        )}
      </div>
    </div>
  );
}
