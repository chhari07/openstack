"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Chips } from "@/components/sheet";
import { BackIcon, CloseIcon, NoteIcon, SearchIcon } from "@/components/icons";
import { FilePdfIcon, HighlighterIcon, HistoryIcon, NewspaperIcon, PlaylistIcon } from "@/components/stack-icons";
import { AiAsk } from "@/components/ai-ask";
import { aiAvailable } from "@/lib/ai";
import { subscribe } from "@/lib/db";
import { canGoBack } from "@/lib/nav";
import { clearSearches, recentSearches, rememberSearch, searchAll, terms, type Hit, type Kind } from "@/lib/search";

type Filter = "all" | Kind;

const KINDS: { value: Kind; label: string; icon: (size: number) => ReactNode; tint: string }[] = [
  { value: "note", label: "Notes", icon: (s) => <NoteIcon size={s} />, tint: "bg-card text-ink" },
  { value: "highlight", label: "Highlights", icon: (s) => <HighlighterIcon size={s} />, tint: "bg-pdf-tint text-pdf-deep" },
  { value: "article", label: "Articles", icon: (s) => <NewspaperIcon size={s} />, tint: "bg-news-tint text-news-deep" },
  { value: "pdf", label: "PDFs", icon: (s) => <FilePdfIcon size={s} />, tint: "bg-blue-tint text-blue-deep" },
  { value: "playlist", label: "Playlists", icon: (s) => <PlaylistIcon size={s} />, tint: "bg-music-tint text-music-deep" },
];
const kindOf = (k: Kind) => KINDS.find((x) => x.value === k)!;

export default function Search() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(recentSearches());
    input.current?.focus();
  }, []);

  // Search as you type (and again if something changes while you look).
  useEffect(() => {
    let alive = true;
    const run = () => searchAll(q).then((h) => alive && setHits(q.trim() ? h : null));
    const t = setTimeout(run, 120);
    const off = subscribe(run);
    return () => {
      alive = false;
      clearTimeout(t);
      off();
    };
  }, [q]);

  const counts = useMemo(() => {
    const c = new Map<Kind, number>();
    for (const h of hits ?? []) c.set(h.kind, (c.get(h.kind) ?? 0) + 1);
    return c;
  }, [hits]);
  const shown = (hits ?? []).filter((h) => filter === "all" || h.kind === filter);
  const words = terms(q);

  const filters = [
    { value: "all" as Filter, label: `All ${hits?.length ?? 0}` },
    ...KINDS.filter((k) => counts.get(k.value)).map((k) => ({
      value: k.value as Filter,
      label: `${k.label} ${counts.get(k.value)}`,
      icon: k.icon(14),
    })),
  ];

  const back = () => (canGoBack() ? router.back() : router.push("/"));
  const open = () => {
    rememberSearch(q);
    setRecent(recentSearches());
  };

  return (
    <main className="min-h-dvh px-5 pt-5 pb-16 md:px-10 md:pt-8">
      <div className="mx-auto max-w-[680px]">
        <div className="flex items-center gap-2">
          <button aria-label="Back" onClick={back} className="-ml-2.5 flex size-11 shrink-0 items-center justify-center">
            <BackIcon size={22} />
          </button>
          <label className="flex h-12 min-w-0 grow items-center gap-2.5 rounded-full border border-ink/15 bg-card px-4 focus-within:border-ink">
            <SearchIcon size={19} className="shrink-0 text-muted" />
            <input
              ref={input}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setFilter("all");
              }}
              onKeyDown={(e) => e.key === "Enter" && (open(), (e.target as HTMLInputElement).blur())}
              type="search"
              enterKeyHint="search"
              placeholder="Notes, highlights, articles, PDFs…"
              aria-label="Search everything"
              className="h-full min-w-0 grow bg-transparent text-[16px] outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <button aria-label="Clear" onClick={() => setQ("")} className="-mr-1.5 flex size-8 items-center justify-center">
                <CloseIcon size={16} />
              </button>
            )}
          </label>
        </div>

        {!q.trim() && (
          <>
            <h1 className="display -ml-1.5 mt-8 text-[clamp(84px,28vw,150px)]">FIND</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Everything you’ve kept in Stack, in one search: notes, highlights, saved articles, PDFs and playlists.
            </p>
            {recent.length > 0 && (
              <>
                <div className="mt-8 flex items-baseline justify-between">
                  <h2 className="label text-[11px] font-medium">Recent searches</h2>
                  <button
                    onClick={() => {
                      clearSearches();
                      setRecent([]);
                    }}
                    className="label text-[10px] text-muted underline"
                  >
                    Clear
                  </button>
                </div>
                <ul className="mt-2">
                  {recent.map((r) => (
                    <li key={r}>
                      <button
                        onClick={() => setQ(r)}
                        className="flex h-12 w-full items-center gap-3 border-b border-line text-left text-[16px]"
                      >
                        <HistoryIcon size={18} className="shrink-0 text-muted" />
                        {r}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {q.trim() && <AiAsk question={q} />}

        {hits && hits.length > 0 && (
          <div className="mt-5">
            <Chips label="Show" options={filters} value={filter} onChange={setFilter} />
          </div>
        )}

        {hits && hits.length === 0 && (
          <p className="mt-16 text-center text-[16px] text-muted">
            Nothing matches “{q.trim()}”.
            <br />
            <span className="text-[14px]">
              {aiAvailable() && q.trim().length >= 3 ? "Try “Ask your Stack” above, or fewer words." : "Try fewer or different words."}
            </span>
          </p>
        )}

        <ul className="mt-4 flex flex-col gap-2">
          {shown.map((h) => {
            const k = kindOf(h.kind);
            return (
              <li key={`${h.kind}-${h.id}`}>
                <Link href={h.href} onClick={open} className="flex gap-3.5 rounded-2xl bg-card p-3.5">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${k.tint}`}>
                    {k.icon(20)}
                  </span>
                  <span className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="line-clamp-2 text-[16px] leading-snug font-semibold">
                      <Marked text={h.title} words={words} />
                    </span>
                    {h.snippet && (
                      <span
                        className={`line-clamp-3 text-[14px] leading-snug text-muted ${h.kind === "highlight" ? "font-serif italic" : ""}`}
                      >
                        <Marked text={h.snippet} words={words} />
                      </span>
                    )}
                    <span className="label mt-0.5 text-[9px] text-muted">
                      {k.label.replace(/s$/, "")}
                      {h.meta ? ` · ${h.meta}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}

// Text with the searched words marked.
function Marked({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const f = fold(text);
  // Folding can change the length (é → e + accent), so only mark when it didn't.
  if (f.length !== text.length) return <>{text}</>;
  const marks: [number, number][] = [];
  for (const w of words) {
    let i = f.indexOf(w);
    while (i >= 0) {
      marks.push([i, i + w.length]);
      i = f.indexOf(w, i + w.length);
    }
  }
  if (!marks.length) return <>{text}</>;
  marks.sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  for (const [s, e] of marks) {
    if (s < pos) continue;
    out.push(text.slice(pos, s));
    out.push(
      <mark key={s} className="rounded-[3px] bg-pdf/40 text-inherit">
        {text.slice(s, e)}
      </mark>,
    );
    pos = e;
  }
  out.push(text.slice(pos));
  return <>{out}</>;
}
