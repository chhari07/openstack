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
import { addNote, getNotes, getPdf, updatePdf, type PdfMeta } from "@/lib/db";
import { useStore } from "@/lib/use-store";
import { openPdf, pdfjs } from "@/lib/pdf";
import { markPageRead, useReadingTimer } from "@/lib/reading";
import { ListenButton } from "@/components/listen-button";
import { paintHighlights } from "@/lib/highlights";
import { clock } from "@/lib/format";
import { ZoomInIcon, ZoomOutIcon } from "@/components/stack-icons";
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

  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

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
          <button
            aria-label={zoom === 1 ? "Zoom in" : "Fit to width"}
            aria-pressed={zoom !== 1}
            onClick={() => setZoom((z) => (z === 1 ? 1.6 : 1))}
            className="flex size-11 items-center justify-center"
          >
            {zoom === 1 ? <ZoomInIcon size={21} /> : <ZoomOutIcon size={21} />}
          </button>
        </div>
        <div className="mt-1.5 h-0.5 bg-rule">
          <div className="h-0.5 bg-ink transition-[width]" style={{ width: `${(page / total) * 100}%` }} />
        </div>
      </div>

      <div ref={wrap} className="mx-auto mt-4 overflow-x-auto px-3 md:max-w-[880px] md:px-6">
        <div className="relative mx-auto w-fit bg-white shadow-[0_4px_18px_rgba(0,0,0,.08)]">
          <canvas ref={canvasRef} className="block" />
          <div ref={textRef} className="textLayer" />
        </div>
      </div>

      {pageNotes.filter((n) => n.body).length > 0 && (
        <div className="mt-4 flex flex-col gap-2.5 px-5">
          {pageNotes
            .filter((n) => n.body)
            .map((n) => (
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
