"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TabBar } from "@/components/tab-bar";
import { Logo } from "@/components/logo";
import { Chips, Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { DownloadIcon } from "@/components/stack-icons";
import { ShareIcon } from "@/components/icons";
import { notesToMarkdown, saveMarkdown, shareMarkdown } from "@/lib/export-md";
import { NoteCard } from "@/components/note-card";
import { ListIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { getNotes, type Note, type NoteKind } from "@/lib/db";
import { useStore } from "@/lib/use-store";

type Filter = "all" | "lists" | NoteKind;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "idea", label: "My notes" },
  { value: "lists", label: "Lists" },
  { value: "article", label: "Articles" },
  { value: "pdf", label: "PDFs" },
  { value: "music", label: "Music" },
];

const matches = (n: Note, f: Filter) =>
  f === "all" || (f === "lists" ? !!n.checklist : n.kind === f);

// Masonry: 2 columns on phones, 3–4 on tablets.
function Grid({ notes }: { notes: Note[] }) {
  return (
    <div className="mt-2.5 columns-2 gap-3 md:columns-3 lg:columns-4">
      {notes.map((n) => (
        <div key={n.id} className="mb-3 break-inside-avoid">
          <NoteCard note={n} />
        </div>
      ))}
    </div>
  );
}

export default function Notes() {
  const [notes, ready] = useStore(getNotes, []);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter(
      (n) =>
        matches(n, filter) &&
        (!q ||
          [n.title, n.quote, n.body, n.sourceTitle, ...(n.checklist ?? []).map((i) => i.text)].some(
            (s) => s?.toLowerCase().includes(q),
          )),
    );
  }, [notes, filter, query]);
  const pinned = shown.filter((n) => n.pinned);
  const others = shown.filter((n) => !n.pinned);

  const today = notes.filter(
    (n) => new Date(n.createdAt).toDateString() === new Date().toDateString(),
  );
  const sourcesToday = new Set(today.map((n) => n.sourceTitle).filter(Boolean)).size;

  return (
    <main className="px-5 pt-5 pb-[180px] md:px-10 md:pt-8">
      <div className="flex h-8 items-center justify-between">
        <Logo size={26} className="-ml-1 md:invisible" />
        <div className="flex items-center gap-1">
          <span className="label text-[10px]">
            {notes.length} notes · {sourcesToday} sources today
          </span>
          {notes.length > 0 && (
            <button
              aria-label="Export notes as Markdown"
              onClick={() => setExporting(true)}
              className="-mr-2.5 flex size-11 items-center justify-center"
            >
              <DownloadIcon size={20} />
            </button>
          )}
        </div>
      </div>
      <h1 className="mt-2 font-serif text-[92px] leading-[0.95] font-medium tracking-[-0.02em]">
        Notes
      </h1>

      <label className="mt-4 flex h-[46px] items-center gap-2.5 rounded-full border border-ink/12 bg-card px-4">
        <SearchIcon size={18} className="text-muted" />
        <input
          aria-label="Search notes"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes, lists, highlights"
          className="grow bg-transparent text-[14px] outline-none"
        />
      </label>

      <div className="mt-3.5">
        <Chips label="Filter notes" options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      {ready && notes.length === 0 && (
        <div className="mt-10 flex flex-col gap-2 text-center">
          <p className="font-serif text-[22px] italic">Nothing here yet.</p>
          <p className="mx-auto max-w-[280px] text-[14px] text-muted">
            Tap <b>+</b> to write a note or start a list, or select text in an
            article or PDF and tap <b>+ Note</b>.
          </p>
        </div>
      )}
      {ready && notes.length > 0 && shown.length === 0 && (
        <p className="mt-10 text-center text-[14px] text-muted">No notes match.</p>
      )}

      {pinned.length > 0 && (
        <>
          <h2 className="label mt-5 text-[10px] text-muted">Pinned</h2>
          <Grid notes={pinned} />
          {others.length > 0 && <h2 className="label mt-3 text-[10px] text-muted">Others</h2>}
        </>
      )}
      {others.length > 0 && <Grid notes={others} />}

      {/* New list (small) and new note (big) */}
      <div className="fixed right-[max(20px,calc(50vw-220px))] bottom-[calc(var(--above-tabs)+6px)] z-30 flex items-center gap-3 md:right-8">
        <Link
          href="/notes/edit?list=1"
          aria-label="New list"
          className="flex size-12 items-center justify-center rounded-full bg-card text-ink shadow-[0_8px_20px_rgba(0,0,0,.18)]"
        >
          <ListIcon size={20} />
        </Link>
        <Link
          href="/notes/edit"
          aria-label="New note"
          className="flex size-[58px] items-center justify-center rounded-full bg-ink text-on-ink shadow-[0_10px_24px_rgba(0,0,0,.28)]"
        >
          <PlusIcon size={22} />
        </Link>
      </div>

      <ExportSheet
        open={exporting}
        onClose={() => setExporting(false)}
        notes={shown}
        all={shown.length === notes.length}
        onDone={(text) => toast({ text })}
      />
      <TabBar />
    </main>
  );
}

// Export as Markdown: a .md file, or straight into another app.
function ExportSheet({
  open,
  onClose,
  notes,
  all,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  notes: Note[];
  all: boolean;
  onDone: (text: string) => void;
}) {
  const row = "flex h-14 items-center gap-3 rounded-xl px-1 text-left text-[15px]";
  const what = `${all ? "All " : ""}${notes.length} note${notes.length === 1 ? "" : "s"}`;
  return (
    <Sheet open={open} onClose={onClose} title="Export as Markdown">
      <p className="text-[14px] leading-relaxed text-muted">
        {what}
        {all ? "" : " (the ones shown now)"}. Highlights are grouped by article or PDF, with a link to the original. Works
        with Obsidian, Notion, Logseq and any text editor.
      </p>
      <div className="flex flex-col">
        <button
          onClick={async () => {
            const r = await saveMarkdown(notesToMarkdown(notes));
            onClose();
            if (r === "saved") onDone("Notes exported as a .md file");
          }}
          className={row}
        >
          <DownloadIcon size={20} /> Save as a .md file
        </button>
        <button
          onClick={async () => {
            onClose();
            const shared = await shareMarkdown(notesToMarkdown(notes)).catch(() => true);
            if (!shared) onDone("Markdown copied");
          }}
          className={row}
        >
          <ShareIcon size={20} /> Share to another app
        </button>
      </div>
    </Sheet>
  );
}
