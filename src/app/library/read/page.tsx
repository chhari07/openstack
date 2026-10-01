"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import { ChevronLeft, ChevronRight, ClockIcon, NoteIcon, PauseIcon, PlayIcon } from "@/components/icons";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { QuoteNoteSheet } from "@/components/quote-note-sheet";
import { useNowPlaying } from "@/components/now-playing";
import { useFocus, useTick } from "@/components/focus-provider";
import { clockText, remainingMs } from "@/lib/focus";
import { useToast } from "@/components/toast";
import { addNote, getNotes, getPdf, updatePdf, type Note, type PdfMeta } from "@/lib/db";
import { useStore } from "@/lib/use-store";
import { openPdf, pdfjs } from "@/lib/pdf";
import { markPageRead, useReadingTimer } from "@/lib/reading";
import { ListenButton } from "@/components/listen-button";
import { paintHighlights } from "@/lib/highlights";
import { clock } from "@/lib/format";
import { ContrastIcon, NoteAddIcon } from "@/components/stack-icons";
import { BookmarkIcon } from "@/components/icons";
import { BookmarkSheet, Ribbon, Stickies, StickySheet, ViewSheet, pageFilter, patchPdf } from "@/components/pdf-extras";
import { AiPdfButton } from "@/components/ai-pdf-chat";

const MIN_PER_PAGE = 1.5; // rough reading pace for the "time left" pill

export default function Page() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <PdfReader />
    </Suspense>
  );
}

function PdfReader() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const startPage = Number(params.get("page")) || 0;
  const now = useNowPlaying();
  const { session: focus } = useFocus();
  const focusing = !!focus && !focus.endedAt;
  const tick = useTick(focusing && !focus?.pausedAt);
  const toast = useToast();

  const [meta, setMeta] = useState<PdfMeta | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [missing, setMissing] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rendered, setRendered] = useState(0); // bumps after each page paint
  const [noteQuote, setNoteQuote] = useState<string | null>(null);
  const [notes] = useStore(getNotes, []);
  const [size, setSize] = useState({ w: 0, h: 0 }); // the painted page, in CSS pixels
  const [panel, setPanel] = useState<"view" | "bookmarks" | "sticky" | null>(null);
  const [editing, setEditing] = useState<Note | null>(null); // the sticky being changed
  const [showStickies, setShowStickies] = useState(true);

  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null); // the page itself: it follows the finger

  // Load the file from IndexedDB and open it with pdf.js.
  useEffect(() => {
    let alive = true;
    let opened: PDFDocumentProxy | null = null;
    getPdf(id).then(async (found) => {
      if (!found) return alive && setMissing(true);
      const d = await openPdf(await found.blob.arrayBuffer());
      if (!alive) return d.loadingTask.destroy();
      opened = d;
      setMeta(found.meta);
      setPage(Math.min(Math.max(1, startPage || found.meta.lastPage), d.numPages));
      setDoc(d);
      updatePdf(id, { lastOpenedAt: Date.now() });
    });
    return () => {
      alive = false;
      opened?.loadingTask.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Paint the current page: canvas for the image, text layer for selection.
  useEffect(() => {
    if (!doc || !wrap.current || !canvasRef.current || !textRef.current) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    (async () => {
      const { TextLayer } = await pdfjs();
      const p = await doc.getPage(page);
      if (cancelled) return;
      const width = wrap.current!.clientWidth * zoom;
      const base = p.getViewport({ scale: 1 });
      const viewport = p.getViewport({ scale: width / base.width });
      const ratio = window.devicePixelRatio || 1;

      const canvas = canvasRef.current!;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      task = p.render({
        canvas,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });
      await task.promise.catch(() => {});
      if (cancelled) return;
      setSize({ w: viewport.width, h: viewport.height });

      const layer = textRef.current!;
      layer.replaceChildren();
      layer.style.setProperty("--total-scale-factor", String(viewport.scale));
      const text = new TextLayer({
        textContentSource: p.streamTextContent(),
        container: layer,
        viewport,
      });
      await text.render();
      if (!cancelled) setRendered((r) => r + 1);
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, zoom]);

  // Reading stats: time in the PDF, and a page counts as read after 8 seconds on it.
  useReadingTimer(!!doc);
  useEffect(() => {
    if (!doc) return;
    const t = setTimeout(() => markPageRead(id, page), 8000);
    return () => clearTimeout(t);
  }, [doc, id, page]);

  // Remember where the reader is.
  useEffect(() => {
    if (!meta) return;
    const t = setTimeout(() => updatePdf(id, { lastPage: page }), 400);
    return () => clearTimeout(t);
  }, [id, page, meta]);

  const pageNotes = notes.filter((n) => n.pdfId === id && n.page === page);
  const quotesKey = pageNotes.map((n) => n.quote).join("\u0000");
  useEffect(() => {
    paintHighlights(
      "stack-pdf",
      textRef.current,
      pageNotes.filter((n) => n.quote).map((n) => n.quote!),
    );
    return () => paintHighlights("stack-pdf", null, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered, quotesKey]);

  const total = doc?.numPages ?? meta?.pages ?? 1;
  const go = useCallback(
    (delta: number) => {
      setPage((p) => Math.min(Math.max(1, p + delta), total));
      window.scrollTo({ top: 0 });
    },
    [total],
  );

  // Swipe the page left or right to turn it, like a book. The page follows the
  // finger and turns once it's dragged far enough; a short or mostly vertical
  // drag is left to scrolling, and selecting text never turns the page.
  // Zoomed in, a swipe first pans across the page and turns it only from the edge.
  useEffect(() => {
    const el = sheet.current;
    const box = wrap.current;
    if (!el || !box || !doc) return;
    let start: { x: number; y: number; atLeft: boolean; atRight: boolean } | null = null;
    let axis: "x" | "y" | null = null;
    const selecting = () => window.getSelection()?.isCollapsed === false;
    const settle = (animate: boolean) => {
      el.style.transition = animate ? "transform .18s ease-out" : "";
      el.style.transform = "";
    };
    // Where this swipe may turn to: +1, -1, or 0 when it should pan or do nothing.
    const turnFor = (dx: number, s: NonNullable<typeof start>) => {
      const delta = dx < 0 ? 1 : -1;
      if (zoom !== 1 && !(delta > 0 ? s.atRight : s.atLeft)) return 0;
      return delta;
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || selecting()) return void (start = null);
      // Dragging a sticky note moves the note, not the page.
      if ((e.target as HTMLElement).closest("[data-sticky]")) return void (start = null);
      const t = e.touches[0];
      start = {
        x: t.clientX,
        y: t.clientY,
        atLeft: box.scrollLeft <= 1,
        atRight: box.scrollLeft + box.clientWidth >= box.scrollWidth - 1,
      };
      axis = null;
      el.style.transition = "";
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      if (e.touches.length !== 1 || selecting()) {
        start = null;
        return settle(true);
      }
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (!axis) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
      }
      if (axis !== "x") return;
      const delta = turnFor(dx, start);
      if (!delta) return;
      // Nothing to turn to at the first and last page: the page resists.
      const end = delta > 0 ? page >= total : page <= 1;
      el.style.transform = `translateX(${end ? dx / 5 : dx}px)`;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const s = start;
      start = null;
      const dx = e.changedTouches[0].clientX - s.x;
      const delta = axis === "x" && !selecting() ? turnFor(dx, s) : 0;
      const far = Math.abs(dx) >= Math.min(90, box.clientWidth * 0.22);
      if (!delta || !far || (delta > 0 ? page >= total : page <= 1)) return settle(true);
      settle(false);
      box.scrollLeft = 0;
      go(delta);
      // The new page slides in from the side it came from.
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        el.animate(
          [{ transform: `translateX(${delta * 28}%)`, opacity: 0.35 }, { transform: "none", opacity: 1 }],
          { duration: 200, easing: "ease-out" },
        );
    };
    const onCancel = () => {
      start = null;
      settle(true);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
      settle(false);
    };
  }, [doc, page, total, zoom, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, dialog")) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const save = async (quote: string, body?: string) => {
    if (!meta) return;
    await addNote({
      kind: "pdf",
      quote,
      body: body || undefined,
      highlight: !body,
      sourceTitle: meta.title,
      sourceLabel: "PDF",
      pdfId: id,
      page,
      href: `/library/read?id=${id}&page=${page}`,
    });
    toast({ text: `Saved to Notes · p. ${page}`, href: "/notes" });
  };

  const listed = pageNotes.filter((n) => n.body && !n.sticky); // stickies are on the page already
  const marked = !!meta?.bookmarks?.some((b) => b.page === page);

  const minutesLeft = Math.round((total - page) * MIN_PER_PAGE);
  const left =
    minutesLeft >= 60 ? `${Math.floor(minutesLeft / 60)}:${String(minutesLeft % 60).padStart(2, "0")}` : `${minutesLeft}m`;

  if (missing) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="font-serif text-[24px] italic">This PDF isn’t on this device.</p>
        <Link href="/library" className="label rounded-full bg-ink px-5 py-3 text-[11px] text-on-ink">
          Back to Library
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-paper pb-40">
      <div className="sticky top-0 z-20 -mt-[env(safe-area-inset-top)] bg-paper px-5 pt-[calc(env(safe-area-inset-top)+20px)] md:px-[max(24px,calc((100%-880px)/2))]">
        <div className="flex h-11 items-center gap-1">
          <Link href="/library" aria-label="Back to library" className="-ml-2 flex size-11 items-center justify-center">
            <ChevronLeft size={22} />
          </Link>
          <span className="label grow truncate text-center text-[10px]">
            {meta?.title ?? "Loading…"} · p. {page}
          </span>
          {!focusing && meta && (
            <Link
              href={`/focus?kind=pdf&id=${id}&title=${encodeURIComponent(meta.title)}`}
              aria-label="Start a focus session with this PDF"
              className="flex size-11 items-center justify-center"
            >
              <ClockIcon size={20} />
            </Link>
          )}
          {meta && doc && (
            <ListenButton
              label="Listen from this page"
              title={`${meta.title} · from p. ${page}`}
              source="PDF"
              getText={() => pdfText(doc, page, Math.min(doc.numPages, page + 29))}
            />
          )}
          {meta && <AiPdfButton id={id} title={meta.title} page={page} onPage={setPage} />}
          <button aria-label="Bookmarks" onClick={() => setPanel("bookmarks")} className="flex size-11 items-center justify-center">
            <BookmarkIcon size={20} filled={marked} />
          </button>
          <button aria-label="Page view: contrast, zoom and cover" onClick={() => setPanel("view")} className="flex size-11 items-center justify-center">
            <ContrastIcon size={21} />
          </button>
        </div>
        <div className="mt-1.5 h-0.5 bg-rule">
          <div className="h-0.5 bg-ink transition-[width]" style={{ width: `${(page / total) * 100}%` }} />
        </div>
      </div>

      <div ref={wrap} className="mx-auto mt-4 overflow-x-auto px-3 md:max-w-[880px] md:px-6">
        {/* At normal size a sideways drag belongs to the page turn, not to the browser's panning. */}
        <div
          ref={sheet}
          style={{ touchAction: zoom === 1 ? "pan-y pinch-zoom" : undefined }}
          className="relative mx-auto w-fit bg-white shadow-[0_4px_18px_rgba(0,0,0,.08)]"
        >
          <canvas ref={canvasRef} className="block" style={{ filter: pageFilter(meta?.view) }} />
          <div ref={textRef} className="textLayer" />
          {showStickies && (
            <Stickies
              notes={pageNotes.filter((n) => n.sticky)}
              pageW={size.w}
              pageH={size.h}
              onEdit={(n) => {
                setEditing(n);
                setPanel("sticky");
              }}
            />
          )}
          {marked && <Ribbon key={page} onClick={() => setPanel("bookmarks")} />}
        </div>
      </div>

      {listed.length > 0 && (
        <div className="mt-4 flex flex-col gap-2.5 px-5">
          {listed.map((n) => (
            <div key={n.id} className="flex items-start gap-2.5 rounded-xl bg-card px-3.5 py-3 shadow-[0_4px_14px_rgba(0,0,0,.06)]">
              <NoteIcon size={18} className="mt-0.5 shrink-0 text-pdf-deep" />
              <div className="flex flex-col gap-1">
                <span className="text-[14px] leading-snug">{n.body}</span>
                <span className="label text-[9px] text-muted">Saved to Notes · {clock(n.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between px-5">
        <button
          onClick={() => go(-1)}
          disabled={page <= 1}
          className="label flex h-11 items-center gap-1 rounded-full border border-ink/15 px-4 text-[10px] disabled:opacity-30"
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <span className="label text-[10px] text-muted">
          {page} / {total}
        </span>
        <button
          onClick={() => go(1)}
          disabled={page >= total}
          className="label flex h-11 items-center gap-1 rounded-full border border-ink/15 px-4 text-[10px] disabled:opacity-30"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>

      {/* Reading-time + music pill from the design */}
      <div className="fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),24px)] z-30 mx-auto flex h-[60px] max-w-[448px] md:left-[calc(var(--rail)+16px)] items-center gap-2.5 rounded-full bg-ink pr-2 pl-[18px] text-on-ink">
        {focusing && focus ? (
          // During a focus session the pill counts down the session instead.
          <Link href="/focus" aria-label="Focus session" className="flex items-center gap-2.5">
            <span className={`size-2 rounded-full ${focus.pausedAt ? "bg-pdf" : "animate-pulse bg-music"}`} />
            <span className="text-[15px] font-semibold tabular-nums">{clockText(remainingMs(focus, tick))}</span>
            <span className="label text-[9px] text-on-ink/65">{focus.pausedAt ? "paused" : "focus"}</span>
          </Link>
        ) : (
          <>
            <ClockIcon size={18} />
            <span className="text-[15px] font-semibold">{left}</span>
            <span className="label text-[9px] text-on-ink/65">left</span>
          </>
        )}
        <span className="mx-1 h-[26px] w-px bg-on-ink/20" />
        <Link href="/music" className="flex min-w-0 grow items-center gap-2">
          <span className={`size-2 shrink-0 rounded-full ${now?.playing ? "bg-music" : "bg-[#6B6862]"}`} />
          <span className="label truncate text-[10px]">
            {now ? `${now.title} · ${now.artist}` : "Add music"}
          </span>
        </Link>
        {now && (
          <button
            aria-label={now.playing ? "Pause music" : "Play music"}
            onClick={now.toggle}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-music text-white"
          >
            {now.playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
          </button>
        )}
      </div>

      <button
        aria-label="Add a sticky note to this page"
        onClick={() => {
          setEditing(null);
          setShowStickies(true);
          setPanel("sticky");
        }}
        className="fixed right-4 bottom-[calc(max(env(safe-area-inset-bottom),24px)+72px)] z-30 flex size-12 items-center justify-center rounded-full bg-[#FFE08A] text-[#111] shadow-[0_4px_12px_rgba(0,0,0,.25)]"
      >
        <NoteAddIcon size={21} />
      </button>
      {meta && (
        <>
          <ViewSheet
            open={panel === "view"}
            onClose={() => setPanel(null)}
            meta={meta}
            onMeta={(patch) => patchPdf(meta, patch, setMeta)}
            zoom={zoom}
            onZoom={setZoom}
            showStickies={showStickies}
            onShowStickies={setShowStickies}
            canvas={canvasRef}
            page={page}
          />
          <BookmarkSheet
            open={panel === "bookmarks"}
            onClose={() => setPanel(null)}
            bookmarks={meta.bookmarks ?? []}
            onChange={(bookmarks) => patchPdf(meta, { bookmarks }, setMeta)}
            page={page}
            onPage={setPage}
          />
          <StickySheet open={panel === "sticky"} onClose={() => setPanel(null)} editing={editing} pdf={meta} page={page} />
        </>
      )}

      <SelectionToolbar
        container={textRef}
        accent="text-pdf-deep"
        onHighlight={(t) => save(t)}
        onNote={(t) => setNoteQuote(t)}
      />
      <QuoteNoteSheet
        quote={noteQuote}
        tint="bg-pdf-tint"
        onClose={() => setNoteQuote(null)}
        onSave={(body) => {
          if (noteQuote) save(noteQuote, body);
          setNoteQuote(null);
        }}
      />
    </main>
  );
}

// The text of pages `from`..`to`, for Listen mode.
async function pdfText(doc: PDFDocumentProxy, from: number, to: number) {
  const pages: string[] = [];
  for (let i = from; i <= to; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(
      content.items
        .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
        .join("")
        .replace(/-\n(?=[a-z])/g, ""),
    );
  }
  return pages.join("\n\n");
}
