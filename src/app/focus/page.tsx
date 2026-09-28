"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Chips } from "@/components/sheet";
import { PdfCover } from "@/components/pdf-cover";
import { useFocus, useTick } from "@/components/focus-provider";
import { useNowPlaying } from "@/components/now-playing";
import { useToast } from "@/components/toast";
import { BackIcon, PauseIcon, PlayIcon } from "@/components/icons";
import { addNote, getNotes, getPdfs, getSaved } from "@/lib/db";
import {
  clockText,
  focusedMs,
  getHistory,
  remainingMs,
  stats,
  type FocusSession,
  type FocusTarget,
} from "@/lib/focus";
import { canGoBack } from "@/lib/nav";
import { useStore } from "@/lib/use-store";

const LENGTHS = [
  { value: "15", label: "15 min" },
  { value: "25", label: "25 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
] as const;
type Length = (typeof LENGTHS)[number]["value"];

const NONE: FocusTarget = { kind: "none", title: "Just focus" };
const sameTarget = (a: FocusTarget, b: FocusTarget) => a.kind === b.kind && a.id === b.id;

export default function Page() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <Focus />
    </Suspense>
  );
}

function Focus() {
  const { session } = useFocus();
  const router = useRouter();
  const back = () => (canGoBack() ? router.back() : router.push("/"));

  return (
    <main className="min-h-dvh px-5 pt-5 pb-16 md:px-10 md:pt-8">
      <div className="flex h-8 items-center justify-between">
        <button aria-label="Back" onClick={back} className="-ml-2.5 flex size-11 items-center justify-center">
          <BackIcon size={22} />
        </button>
        <Stats />
      </div>
      <div className="mx-auto max-w-[640px]">
        {!session && <Setup />}
        {session && !session.endedAt && <Running session={session} />}
        {session?.endedAt && <Summary session={session} />}
      </div>
    </main>
  );
}

function Stats() {
  const { session } = useFocus();
  const [s, setS] = useState<ReturnType<typeof stats> | null>(null);
  // Re-read after a session ends.
  useEffect(() => {
    getHistory().then((h) => setS(stats(h)));
  }, [session?.endedAt]);
  if (!s || s.sessions === 0) return null;
  return (
    <span className="label text-[10px]">
      {s.todayMinutes} min today{s.streak > 1 ? ` · ${s.streak}-day streak` : ""}
    </span>
  );
}

// ---- 1. Set up ----
function Setup() {
  const params = useSearchParams();
  const { start } = useFocus();
  const now = useNowPlaying();
  const [pdfs] = useStore(getPdfs, []);
  const [saved] = useStore(getSaved, []);
  const [length, setLength] = useState<Length>("25");
  const [music, setMusic] = useState(true);

  // Arriving from a reader preselects what you were reading.
  const asked = useMemo<FocusTarget | null>(() => {
    const kind = params.get("kind");
    const id = params.get("id");
    if ((kind !== "pdf" && kind !== "article") || !id) return null;
    const title = params.get("title") ?? "";
    return kind === "pdf"
      ? { kind, id, title, href: `/library/read?id=${id}` }
      : { kind, id, title: title || "Article", href: `/read?id=${id}` };
  }, [params]);

  const options = useMemo(() => {
    const list: FocusTarget[] = [
      ...[...pdfs]
        .sort((a, b) => (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt))
        .slice(0, 10)
        .map((p) => ({ kind: "pdf" as const, id: p.id, title: p.title, href: `/library/read?id=${p.id}` })),
      ...saved
        .slice(0, 10)
        .map((a) => ({ kind: "article" as const, id: a.id, title: a.title, href: `/read?id=${a.id}` })),
    ];
    if (asked && !list.some((t) => sameTarget(t, asked))) list.unshift(asked);
    return [NONE, ...list];
  }, [pdfs, saved, asked]);

  const [picked, setPicked] = useState<FocusTarget | null>(null);
  const target = picked ?? options.find((t) => asked && sameTarget(t, asked)) ?? options[1] ?? NONE;

  return (
    <>
      <h1 className="display -ml-2 mt-3 text-[clamp(96px,33vw,170px)]">FOCUS</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        One thing to read, a timer, your music, and notes you make along the way.
      </p>

      <h2 className="label mt-7 text-[11px] font-medium">01 — What are you reading?</h2>
      <div role="radiogroup" aria-label="What to focus on" className="rail -mx-5 mt-3 gap-3 px-5 md:mx-0 md:px-0">
        {options.map((t) => {
          const on = sameTarget(t, target);
          return (
            <button
              key={`${t.kind}-${t.id ?? ""}`}
              role="radio"
              aria-checked={on}
              onClick={() => setPicked(t)}
              className={`flex w-[118px] flex-col gap-2 rounded-[14px] p-1.5 text-left ${on ? "bg-ink text-on-ink" : ""}`}
            >
              {t.kind === "pdf" ? (
                <PdfCover id={t.id!} title={t.title} className="h-[150px] w-[106px]" />
              ) : (
                <span
                  className={`flex h-[150px] w-[106px] items-end rounded-md p-2.5 ${
                    t.kind === "article" ? "bg-news-tint text-news-deep" : "bg-card text-ink"
                  }`}
                >
                  <span className="label text-[9px]">{t.kind === "article" ? "Article" : "No reading"}</span>
                </span>
              )}
              <span className="line-clamp-2 px-0.5 text-[13px] leading-tight font-semibold">{t.title}</span>
            </button>
          );
        })}
      </div>

      <h2 className="label mt-7 text-[11px] font-medium">02 — How long?</h2>
      <div className="mt-3">
        <Chips label="Session length" options={[...LENGTHS]} value={length} onChange={setLength} />
      </div>

      <h2 className="label mt-7 text-[11px] font-medium">03 — Music</h2>
      <label className="mt-3 flex items-center gap-3 rounded-2xl bg-card p-4">
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-[15px] font-semibold">Play music while I focus</span>
          <span className="label truncate text-[10px] text-muted">
            {now ? `${now.title} · ${now.artist}` : "Nothing loaded yet"}
          </span>
        </span>
        <input
          type="checkbox"
          checked={music}
          onChange={(e) => setMusic(e.target.checked)}
          className="size-6 accent-[var(--color-music)]"
        />
      </label>
      {music && !now && (
        <Link href="/music" className="label mt-2 inline-block text-[10px] underline">
          Pick music first
        </Link>
      )}

      <button
        onClick={() => start(target, Number(length), music)}
        className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink text-[16px] font-semibold text-on-ink"
      >
        <PlayIcon size={18} /> Start {length} minutes
      </button>
    </>
  );
}

// ---- 2. Running ----
function Running({ session }: { session: FocusSession }) {
  const { pause, resume, finish } = useFocus();
  const now = useNowPlaying();
  const toast = useToast();
  const [notes] = useStore(getNotes, []);
  const [thought, setThought] = useState("");
  const paused = !!session.pausedAt;
  const tick = useTick(!paused);
  const left = remainingMs(session, tick);
  const pct = 100 - (left / (session.minutes * 60_000)) * 100;
  const during = notes.filter((n) => n.createdAt >= session.startedAt);

  const capture = async () => {
    if (!thought.trim()) return;
    await addNote({
      kind: "idea",
      body: thought.trim(),
      sourceTitle: session.target.kind === "none" ? undefined : session.target.title,
      href: session.target.href,
    });
    setThought("");
    toast({ text: "Saved to Notes" });
  };

  return (
    <>
      <p className="label mt-6 text-[11px] text-muted">{paused ? "Paused" : "Focusing on"}</p>
      <p className="mt-1 line-clamp-2 font-serif text-[24px] leading-tight font-semibold">{session.target.title}</p>

      <div
        role="timer"
        aria-label={`${clockText(left)} left`}
        className={`display mt-6 text-[clamp(110px,34vw,190px)] tabular-nums ${paused ? "opacity-40" : ""}`}
      >
        {clockText(left)}
      </div>
      <div className="mt-4 h-1 rounded-full bg-rule">
        <div className="h-1 rounded-full bg-music transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
      </div>
      <div className="label mt-2 flex justify-between text-[10px] text-muted">
        <span>{Math.floor(focusedMs(session, tick) / 60_000)} min done</span>
        <span>{session.minutes} min</span>
      </div>

      <div className="mt-6 flex gap-2.5">
        <button
          onClick={paused ? resume : pause}
          className="flex h-14 grow items-center justify-center gap-2 rounded-full bg-ink text-[16px] font-semibold text-on-ink"
        >
          {paused ? <PlayIcon size={18} /> : <PauseIcon size={18} />} {paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={finish}
          className="h-14 rounded-full border border-ink/20 px-6 text-[15px] font-semibold"
        >
          End
        </button>
      </div>
      {session.target.href && (
        <Link
          href={session.target.href}
          className="mt-2.5 flex h-12 items-center justify-center rounded-full bg-card text-[15px] font-semibold"
        >
          Open {session.target.kind === "pdf" ? "PDF" : "article"}
        </Link>
      )}

      {now && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-card p-3">
          <span className={`size-2 shrink-0 rounded-full ${now.playing ? "bg-music" : "bg-muted"}`} />
          <span className="flex min-w-0 grow flex-col">
            <span className="song truncate text-[14px]">{now.title}</span>
            <span className="label truncate text-[9px] text-muted">{now.artist}</span>
          </span>
          <button
            aria-label={now.playing ? "Pause music" : "Play music"}
            onClick={now.toggle}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-music text-white"
          >
            {now.playing ? <PauseIcon /> : <PlayIcon />}
          </button>
        </div>
      )}

      <h2 className="label mt-7 text-[11px] font-medium">Capture a thought</h2>
      <div className="mt-2.5 flex gap-2">
        <input
          aria-label="Thought"
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && capture()}
          enterKeyHint="done"
          placeholder="An idea, a question, a to-do…"
          className="h-12 min-w-0 grow rounded-full border border-ink/15 bg-card px-4 text-[15px] outline-none focus:border-ink"
        />
        <button
          onClick={capture}
          disabled={!thought.trim()}
          className="h-12 rounded-full bg-ink px-5 text-[14px] font-semibold text-on-ink disabled:opacity-40"
        >
          Save
        </button>
      </div>
      {during.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {during.map((n) => (
            <li key={n.id} className="rounded-xl bg-card px-3.5 py-2.5 text-[14px] leading-snug">
              {n.quote ? `“${n.quote}”` : n.body || n.title}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ---- 3. Summary ----
function Summary({ session }: { session: FocusSession }) {
  const { clear } = useFocus();
  const toast = useToast();
  const [notes] = useStore(getNotes, []);
  const [pdfs] = useStore(getPdfs, []);
  const [savedId, setSavedId] = useState<string | null>(null);

  const mins = Math.max(1, Math.round(focusedMs(session) / 60_000));
  const full = focusedMs(session) >= session.minutes * 60_000 - 1000;
  const during = notes.filter(
    (n) => n.createdAt >= session.startedAt && n.createdAt <= session.endedAt! && n.id !== savedId,
  );
  const highlights = during.filter((n) => n.quote);
  const thoughts = during.filter((n) => !n.quote);
  const endPage = pdfs.find((p) => p.id === session.target.id)?.lastPage;
  const pages = session.startPage && endPage ? Math.max(0, endPage - session.startPage) : null;

  const saveSummary = async () => {
    const lines = [
      `${mins} min focused${session.target.kind === "none" ? "" : ` on ${session.target.title}`}`,
      pages !== null ? `Pages ${session.startPage} → ${endPage} (${pages} read)` : "",
      highlights.length ? `\nHighlights:\n${highlights.map((n) => `• ${n.quote}`).join("\n")}` : "",
      thoughts.length ? `\nThoughts:\n${thoughts.map((n) => `• ${n.body ?? n.title ?? ""}`).join("\n")}` : "",
    ].filter(Boolean);
    const note = await addNote({
      kind: "idea",
      title: `Focus session · ${new Date(session.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
      body: lines.join("\n"),
      color: "green",
      sourceTitle: session.target.kind === "none" ? undefined : session.target.title,
      href: session.target.href,
    });
    setSavedId(note.id);
    toast({ text: "Summary saved to Notes", href: `/notes/edit?id=${note.id}` });
  };

  const tiles = [
    { n: mins, label: mins === 1 ? "Minute" : "Minutes" },
    ...(pages !== null ? [{ n: pages, label: pages === 1 ? "Page" : "Pages" }] : []),
    { n: highlights.length, label: highlights.length === 1 ? "Highlight" : "Highlights" },
    { n: thoughts.length, label: thoughts.length === 1 ? "Note" : "Notes" },
  ];

  return (
    <>
      <h1 className="display -ml-2 mt-3 text-[clamp(88px,30vw,160px)]">{full ? "DONE" : "ENDED"}</h1>
      <p className="mt-3 font-serif text-[22px] leading-snug italic">
        {full ? "Nice work." : "Every minute counts."} {mins} minute{mins > 1 ? "s" : ""}
        {session.target.kind === "none" ? " of focus." : ` on ${session.target.title}.`}
      </p>

      <div className={`mt-6 grid gap-2.5 ${tiles.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col gap-1 rounded-2xl bg-card px-3 py-3.5">
            <span className="display text-[40px] tabular-nums">{t.n}</span>
            <span className="label text-[9px] text-muted">{t.label}</span>
          </div>
        ))}
      </div>

      {during.length > 0 && (
        <>
          <h2 className="label mt-7 text-[11px] font-medium">From this session</h2>
          <ul className="mt-2.5 flex flex-col gap-2">
            {during.map((n) => (
              <li key={n.id}>
                <Link href={`/notes/edit?id=${n.id}`} className="block rounded-xl bg-card px-3.5 py-2.5 text-[14px] leading-snug">
                  {n.quote ? `“${n.quote}”` : n.body || n.title}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-8 flex flex-col gap-2.5">
        <button
          onClick={saveSummary}
          disabled={!!savedId}
          className="h-14 rounded-full bg-ink text-[16px] font-semibold text-on-ink disabled:opacity-40"
        >
          {savedId ? "Saved to Notes" : "Save summary to Notes"}
        </button>
        <button onClick={clear} className="h-12 rounded-full border border-ink/20 text-[15px] font-semibold">
          Start another session
        </button>
      </div>
    </>
  );
}
