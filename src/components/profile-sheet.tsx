"use client";

import { useState } from "react";
import { pickImage } from "@/lib/image";
import { TOPICS, type Topic } from "@/lib/news";
import {
  ACCENTS,
  BIO_MAX,
  DEFAULT_GOAL,
  GOALS,
  MOODS,
  MOOD_ICONS,
  initials,
  moodIcon,
  saveProfile,
  type Accent,
  type Mood,
  type Profile,
} from "@/lib/profile";
import { CheckIcon } from "./icons";
import { NamedIcon } from "./profile-icons";
import { TopicIcon } from "./topic-icon";
import { Sheet } from "./sheet";

// Edit profile: photo, name, bio, mood, colour, interests and daily goal.
// Changes are kept in a draft and saved together with "Save".
export function ProfileSheet({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: Profile }) {
  return (
    <Sheet open={open} onClose={onClose} title="Edit profile">
      {/* Remount on open so the draft starts from the saved profile. */}
      {open && <Form profile={profile} onDone={onClose} />}
    </Sheet>
  );
}

function Form({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [avatar, setAvatar] = useState(profile.avatar);
  const [name, setName] = useState(profile.name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [mood, setMood] = useState<Mood | undefined>(profile.mood);
  const [accent, setAccent] = useState<Accent>(profile.accent ?? "ink");
  const [interests, setInterests] = useState<Topic[]>(profile.interests ?? []);
  const [goal, setGoal] = useState(profile.dailyGoal ?? DEFAULT_GOAL);
  const [saving, setSaving] = useState(false);

  const colour = ACCENTS.find((a) => a.value === accent)!;
  const toggleTopic = (t: Topic) =>
    setInterests((all) => (all.includes(t) ? all.filter((x) => x !== t) : [...all, t]));

  const save = async () => {
    setSaving(true);
    await saveProfile({
      avatar,
      name: name.trim() || undefined,
      bio: bio.trim() || undefined,
      mood: mood?.text.trim() ? { icon: moodIcon(mood), text: mood.text.trim() } : undefined,
      accent,
      interests,
      dailyGoal: goal,
    });
    setSaving(false);
    onDone();
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <button
          onClick={async () => {
            const picked = await pickImage(384);
            if (picked) setAvatar(picked);
          }}
          aria-label="Change profile photo"
          className="relative shrink-0"
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="size-[76px] rounded-full object-cover" />
          ) : (
            <span
              className={`flex size-[76px] items-center justify-center rounded-full text-[29px] font-bold ${colour.bg} ${colour.text}`}
            >
              {initials(name)}
            </span>
          )}
          <span className="label absolute -right-1 -bottom-1 rounded-full bg-music px-2 py-1 text-[9px] text-white">
            {avatar ? "Edit" : "Add"}
          </span>
        </button>
        <div className="flex min-w-0 grow flex-col gap-1.5">
          <Label htmlFor="edit-name">Name</Label>
          <input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should Stack call you?"
            autoComplete="name"
            maxLength={40}
            className="h-12 w-full rounded-xl border border-ink/15 bg-card px-4 text-[17px] font-semibold outline-none focus:border-ink"
          />
          {avatar && (
            <button onClick={() => setAvatar(undefined)} className="label self-start text-[9px] text-muted underline">
              Remove photo
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="edit-bio">Bio</Label>
          <span className="label text-[9px] text-muted">
            {bio.length}/{BIO_MAX}
          </span>
        </div>
        <textarea
          id="edit-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value.replace(/\n/g, " ").slice(0, BIO_MAX))}
          placeholder="Frontend dev. Reading about AI and old maps."
          rows={2}
          className="w-full resize-none rounded-xl border border-ink/15 bg-card px-4 py-3 text-[15px] leading-snug outline-none focus:border-ink"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Right now</Label>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {MOODS.map((m) => {
            const on = !!mood && moodIcon(mood) === m.icon && mood.text === m.text;
            return (
              <button
                key={m.text}
                onClick={() => setMood(on ? undefined : m)}
                aria-pressed={on}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ${
                  on ? "bg-ink text-on-ink" : "border border-ink/20"
                }`}
              >
                <NamedIcon name={m.icon} size={17} />
                {m.text}
              </button>
            );
          })}
        </div>
        <p className="label mt-1 text-[9px] text-muted">Or pick an icon and write your own</p>
        <div role="radiogroup" aria-label="Status icon" className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
          {MOOD_ICONS.map((icon) => {
            const on = !!mood && moodIcon(mood) === icon;
            return (
              <button
                key={icon}
                role="radio"
                aria-checked={on}
                aria-label={icon.replace(/-/g, " ")}
                onClick={() => setMood({ icon, text: mood?.text ?? "" })}
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                  on ? "bg-ink text-on-ink" : "border border-ink/15"
                }`}
              >
                <NamedIcon name={icon} size={19} />
              </button>
            );
          })}
        </div>
        <input
          aria-label="Status"
          value={mood?.text ?? ""}
          onChange={(e) => setMood({ icon: mood ? moodIcon(mood) : "chat", text: e.target.value.slice(0, 32) })}
          placeholder="Write your own status"
          className="h-11 w-full rounded-xl border border-ink/15 bg-card px-4 text-[15px] outline-none focus:border-ink"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Profile colour</Label>
        <div role="radiogroup" aria-label="Profile colour" className="flex gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              role="radio"
              aria-checked={accent === a.value}
              aria-label={a.label}
              onClick={() => setAccent(a.value)}
              className={`flex size-10 items-center justify-center rounded-full ${a.bg} ${a.text} ${
                accent === a.value ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : ""
              }`}
            >
              {accent === a.value && <CheckIcon size={18} />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Interests</Label>
        <p className="-mt-1 text-[13px] text-muted">News shows these topics first.</p>
        <div className="flex flex-wrap gap-2">
          {TOPICS.filter((t) => t.value !== "top" && t.value !== "mine").map((t) => {
            const on = interests.includes(t.value);
            return (
              <button
                key={t.value}
                onClick={() => toggleTopic(t.value)}
                aria-pressed={on}
                className={`label flex h-8 items-center gap-1.5 rounded-full pr-3 pl-2.5 text-[10px] ${
                  on ? "bg-news text-white" : "border border-ink/20"
                }`}
              >
                {on ? <CheckIcon size={13} /> : <TopicIcon topic={t.value} size={13} />}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Daily focus goal</Label>
        <div role="radiogroup" aria-label="Daily focus goal" className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <button
              key={g}
              role="radio"
              aria-checked={goal === g}
              onClick={() => setGoal(g)}
              className={`label h-8 rounded-full px-3 text-[10px] ${goal === g ? "bg-ink text-on-ink" : "border border-ink/20"}`}
            >
              {g < 60 ? `${g} min` : `${g / 60} h`}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-1 h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </>
  );
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="label text-[10px] text-muted">
      {children}
    </label>
  );
}
