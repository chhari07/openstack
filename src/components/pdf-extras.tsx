"use client";

// Extras for the PDF reader: the page view (contrast, zoom, cover), bookmarks
// and sticky notes that sit on the page.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from "react";
import {
  addNote,
  deleteNote,
  setCover,
  updateNote,
  updatePdf,
  type Bookmark,
  type Note,
  type NoteColor,
  type PdfMeta,
  type PdfView,
  type Sticky,
} from "@/lib/db";
import { clock } from "@/lib/format";
import { BookmarkIcon, TrashIcon } from "./icons";
import { Chips, Sheet } from "./sheet";
import { FlagIcon, HelpIcon, NoteAddIcon } from "./stack-icons";
import { useToast } from "./toast";

// ---- Page view ----
const PLAIN: PdfView = { mode: "normal", contrast: 100, brightness: 100 };
const MODES: Record<PdfView["mode"], string> = {
  normal: "",
  sepia: "sepia(.55) ",
  dark: "invert(1) hue-rotate(180deg) ",
  grey: "grayscale(1) ",
};

// The CSS filter that shows the page the way the reader chose.
export function pageFilter(v: PdfView = PLAIN) {
  const f = `${MODES[v.mode]}contrast(${v.contrast}%) brightness(${v.brightness}%)`;
  return f === "contrast(100%) brightness(100%)" ? undefined : f;
}

// A cover-sized JPEG of a canvas or a picture.
function shrink(from: HTMLCanvasElement | HTMLImageElement, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = 240;
  c.height = Math.round((240 * h) / w);
  c.getContext("2d")!.drawImage(from, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

const pill = "label h-10 rounded-full border border-ink/15 px-4 text-[10px]";

export function ViewSheet({
  open,
  onClose,
  meta,
  onMeta,
  zoom,
  onZoom,
  showStickies,
  onShowStickies,
  canvas,
  page,
}: {
  open: boolean;
  onClose: () => void;
  meta: PdfMeta;
  onMeta: (patch: Partial<PdfMeta>) => void;
  zoom: number;
  onZoom: (z: number) => void;
  showStickies: boolean;
  onShowStickies: (on: boolean) => void;
  canvas: RefObject<HTMLCanvasElement | null>;
  page: number;
}) {
  const toast = useToast();
  const photo = useRef<HTMLInputElement>(null);
  const view = meta.view ?? PLAIN;
  const set = (patch: Partial<PdfView>) => onMeta({ view: { ...view, ...patch } });
  const slider = (label: string, key: "contrast" | "brightness", min: number, max: number) => (
    <label className="flex items-center gap-3">
      <span className="label w-[76px] text-[10px] text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={5}
        value={view[key]}
        onChange={(e) => set({ [key]: Number(e.target.value) })}
        className="h-11 grow accent-music"
      />
      <span className="label w-9 text-right text-[10px]">{view[key]}%</span>
    </label>
  );
  const cover = async (data: string, text: string) => {
    await setCover(meta.id, data);
    onMeta({ coverStyle: undefined });
    toast({ text });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Page view">
      <Chips
        label="Page colours"
        value={view.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: "normal", label: "Normal" },
          { value: "sepia", label: "Sepia" },
          { value: "dark", label: "Dark" },
          { value: "grey", label: "Grey" },
        ]}
      />
      {view.mode === "dark" && <p className="-mt-2 text-[12px] text-muted">Dark also turns pictures inside the PDF.</p>}
      <div className="flex flex-col">
        {slider("Contrast", "contrast", 60, 220)}
        {slider("Brightness", "brightness", 60, 140)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onZoom(zoom === 1 ? 1.6 : 1)} aria-pressed={zoom !== 1} className={pill}>
          {zoom === 1 ? "Zoom in" : "Fit to width"}
        </button>
        <button onClick={() => onShowStickies(!showStickies)} aria-pressed={!showStickies} className={pill}>
          {showStickies ? "Hide sticky notes" : "Show sticky notes"}
        </button>
        <button onClick={() => onMeta({ view: undefined })} disabled={!meta.view} className={`${pill} disabled:opacity-30`}>
          Reset
        </button>
      </div>

      <span className="label text-[10px] text-muted">Cover on the shelf</span>
      <div className="-mt-2 flex flex-wrap gap-2">
        <button
          onClick={() => canvas.current && cover(shrink(canvas.current, canvas.current.width, canvas.current.height), `Page ${page} is the cover`)}
          className={pill}
        >
          Use this page
        </button>
        <button onClick={() => photo.current?.click()} className={pill}>
          Photo
        </button>
        <button
          onClick={() => {
            onMeta({ coverStyle: "stack" });
            toast({ text: "Stack cover set" });
          }}
          aria-pressed={meta.coverStyle === "stack"}
          className={`${pill} ${meta.coverStyle === "stack" ? "bg-ink text-on-ink" : ""}`}
        >
          Stack cover
        </button>
        <input
          ref={photo}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const img = new Image();
            img.onload = () => {
              cover(shrink(img, img.naturalWidth, img.naturalHeight), "Cover changed");
              URL.revokeObjectURL(img.src);
            };
            img.src = URL.createObjectURL(file);
          }}
        />
      </div>
    </Sheet>
  );
}

// ---- Bookmarks ----
// The ribbon that hangs from the top of a bookmarked page.
export function Ribbon({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Bookmarks"
      onClick={onClick}
      className="ribbon ribbon-drop absolute -top-1 right-4 z-[3] flex h-12 w-6 justify-center bg-music pt-1.5 text-white shadow-[0_2px_4px_rgba(0,0,0,.25)]"
    >
      <svg width="12" height="12" viewBox="242.5 130 124 124" fill="currentColor" aria-hidden>
        <rect x="272.2" y="236" width="65" height="18" rx="2" />
        <rect x="273.9" y="194.8" width="60" height="18" rx="2" transform="rotate(-26.6 303.9 203.8)" />
        <rect x="274.7" y="167.9" width="38" height="18" rx="2" transform="rotate(-32 293.7 176.9)" />
        <rect x="272.5" y="130.5" width="18" height="29" rx="2" />
      </svg>
    </button>
  );
}

export function BookmarkSheet({
  open,
  onClose,
  bookmarks,
  onChange,
  page,
  onPage,
}: {
  open: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  onChange: (next: Bookmark[]) => void;
  page: number;
  onPage: (page: number) => void;
}) {
  const here = bookmarks.find((b) => b.page === page);
  const [label, setLabel] = useState("");
  const sorted = [...bookmarks].sort((a, b) => a.page - b.page);

  return (
    <Sheet open={open} onClose={onClose} title="Bookmarks">
      {here ? (
        <button onClick={() => onChange(bookmarks.filter((b) => b.page !== page))} className="h-12 rounded-full border border-ink/15 text-[15px] font-semibold">
          Remove the bookmark on p. {page}
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onChange([...bookmarks, { page, label: label.trim() || undefined, at: Date.now() }]);
            setLabel("");
          }}
          className="flex gap-2"
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            aria-label="Bookmark label"
            maxLength={40}
            className="h-12 min-w-0 grow rounded-full border border-ink/15 bg-card px-4 text-[15px] outline-none focus:border-ink"
          />
          <button className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-on-ink">
            <BookmarkIcon size={16} filled /> p. {page}
          </button>
        </form>
      )}
      {sorted.length === 0 ? (
        <p className="text-[14px] text-muted">No bookmarks in this PDF yet.</p>
      ) : (
        <ul className="-mt-1 flex max-h-[40dvh] flex-col overflow-y-auto">
          {sorted.map((b) => (
            <li key={b.page} className="flex items-center border-b border-line last:border-0">
              <button
                onClick={() => {
                  onPage(b.page);
                  onClose();
                }}
                className="flex h-12 min-w-0 grow items-center gap-3 text-left"
              >
                <span className="ribbon h-6 w-3 shrink-0 bg-music" />
                <span className="truncate text-[15px] font-semibold">{b.label || `Page ${b.page}`}</span>
                <span className="label ml-auto shrink-0 text-[10px] text-muted">p. {b.page}</span>
              </button>
              <button
                aria-label={`Remove the bookmark on page ${b.page}`}
                onClick={() => onChange(bookmarks.filter((x) => x.page !== b.page))}
                className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted"
              >
                <TrashIcon size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

// ---- Sticky notes ----
// Paper colours stay the same in the dark theme, like real paper.
const PAPER: Partial<Record<NoteColor, [front: string, back: string]>> = {
  orange: ["#FFE08A", "#EFCB6A"],
  green: ["#BFE8C8", "#A3D6AF"],
  red: ["#F9C4BF", "#EBA9A3"],
  blue: ["#BFDCF7", "#A2C7EA"],
};
const paperOf = (n: Note) => PAPER[n.color ?? "orange"] ?? PAPER.orange!;
const WIDTH: Record<Sticky["size"], number> = { s: 0.11, m: 0.3, l: 0.44 }; // of the page's width
const TYPE_ICON = { note: NoteAddIcon, flag: FlagIcon, question: HelpIcon };

function StickyNote({ note, pageW, pageH, onEdit }: { note: Note; pageW: number; pageH: number; onEdit: (n: Note) => void }) {
  const s = note.sticky!;
  const [up, setUp] = useState(false);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null); // while dragging
  const drag = useRef<{ px: number; py: number; moved: boolean } | null>(null);

  const small = s.size === "s";
  const flag = s.type === "flag";
  const w = Math.max(30, WIDTH[s.size] * pageW);
  const h = small ? w : flag ? Math.max(24, w * 0.3) : w;
  const [front, back] = paperOf(note);
  const Icon = TYPE_ICON[s.type];
  const font = Math.max(9, Math.min(15, w * 0.1));
  // A small tilt, the same every time for the same note.
  const tilt = (([...note.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 5) - 2) * 0.9;
  const x = at?.x ?? s.x;
  const y = at?.y ?? s.y;

  const onDown = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, moved: false };
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    setAt({
      x: Math.min(Math.max(0, s.x + dx / pageW), 1 - w / pageW),
      y: Math.min(Math.max(0, s.y + dy / pageH), 1 - h / pageH),
    });
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved && at) return void updateNote(note.id, { sticky: { ...s, ...at } }).then(() => setAt(null));
    // A tap: small ones open, the rest lift to show the page underneath.
    if (small) onEdit(note);
    else setUp((u) => !u);
  };

  const face = "sticky-face absolute inset-0 overflow-hidden";
  const shape: CSSProperties = flag ? { clipPath: "polygon(0 0, 100% 0, calc(100% - 9px) 50%, 100% 100%, 0 100%)" } : {};
  return (
    <div
      data-sticky
      role="button"
      tabIndex={0}
      aria-label={`Sticky note: ${note.body ?? ""}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => ((drag.current = null), setAt(null))}
      onKeyDown={(e) => e.key === "Enter" && onEdit(note)}
      className="sticky-note absolute z-[2] cursor-grab"
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: w, height: h, rotate: `${tilt}deg`, color: "#111", filter: "drop-shadow(0 3px 5px rgba(0,0,0,.22))" }}
    >
      <div className={`sticky-paper relative size-full ${up ? "up" : ""}`}>
        <div className={`${face} ${flag || small ? "" : "sticky-curl"}`} style={{ background: front, ...shape }}>
          {!flag && !small && <div className="h-[14%] bg-black/[0.06]" />}
          {small ? (
            <span className="flex size-full items-center justify-center">
              <Icon size={Math.round(w * 0.55)} />
            </span>
          ) : (
            <p
              className={`flex gap-1 px-[8%] font-medium ${flag ? "h-full items-center truncate pr-[14px]" : "pt-[5%] leading-[1.25] whitespace-pre-wrap"}`}
              style={{ fontSize: font }}
            >
              {s.type !== "note" && <Icon size={font + 3} className="shrink-0" />}
              <span className={flag ? "truncate" : ""}>{note.body}</span>
            </p>
          )}
        </div>
        <div className={`${face} sticky-back flex flex-col items-center justify-center gap-1`} style={{ background: back, ...shape }}>
          {!flag && <span className="label text-[8px] opacity-70">{clock(note.updatedAt ?? note.createdAt)}</span>}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onEdit(note)}
            className="label rounded-full bg-black/80 px-2.5 py-1 text-[9px] text-white"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// Every sticky on this page, over the text.
export function Stickies({ notes, pageW, pageH, onEdit }: { notes: Note[]; pageW: number; pageH: number; onEdit: (n: Note) => void }) {
  if (!pageW || !pageH) return null;
  return notes.map((n) => <StickyNote key={n.id} note={n} pageW={pageW} pageH={pageH} onEdit={onEdit} />);
}

type Draft = { text: string; type: Sticky["type"]; size: Sticky["size"]; color: NoteColor };
const NEW: Draft = { text: "", type: "note", size: "m", color: "orange" };

// Write a new sticky, or change one. `editing` is the note being changed.
export function StickySheet({
  open,
  onClose,
  editing,
  pdf,
  page,
}: {
  open: boolean;
  onClose: () => void;
  editing: Note | null;
  pdf: PdfMeta;
  page: number;
}) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(NEW);
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setD(
      editing?.sticky
        ? { text: editing.body ?? "", type: editing.sticky.type, size: editing.sticky.size, color: editing.color ?? "orange" }
        : NEW,
    );
  }, [open, editing]);

  const save = async () => {
    const body = d.text.trim() || (d.type === "flag" ? "Come back here" : "");
    if (!body) return;
    if (editing?.sticky) await updateNote(editing.id, { body, color: d.color, sticky: { ...editing.sticky, type: d.type, size: d.size } });
    else {
      await addNote({
        kind: "pdf",
        body,
        color: d.color,
        sticky: { x: 0.34, y: 0.22, type: d.type, size: d.size },
        sourceTitle: pdf.title,
        sourceLabel: "PDF",
        pdfId: pdf.id,
        page,
        href: `/library/read?id=${pdf.id}&page=${page}`,
      });
      toast({ text: "Sticky added · drag it into place" });
    }
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Sticky note" : "New sticky note"}>
      <textarea
        value={d.text}
        onChange={(e) => setD({ ...d, text: e.target.value })}
        placeholder={d.type === "question" ? "What do you want to ask?" : d.type === "flag" ? "Come back here" : "Write a note…"}
        aria-label="Sticky note text"
        rows={3}
        maxLength={400}
        className="resize-none rounded-2xl p-3.5 text-[15px] leading-snug text-[#111] outline-none placeholder:text-black/40"
        style={{ background: (PAPER[d.color] ?? PAPER.orange!)[0] }}
      />
      <Chips
        label="Kind of sticky"
        value={d.type}
        onChange={(type) => setD({ ...d, type })}
        options={[
          { value: "note", label: "Note", icon: <NoteAddIcon size={14} /> },
          { value: "flag", label: "Flag", icon: <FlagIcon size={14} /> },
          { value: "question", label: "Question", icon: <HelpIcon size={14} /> },
        ]}
      />
      <Chips
        label="Size"
        value={d.size}
        onChange={(size) => setD({ ...d, size })}
        options={[
          { value: "s", label: "Small" },
          { value: "m", label: "Medium" },
          { value: "l", label: "Large" },
        ]}
      />
      <div role="radiogroup" aria-label="Colour" className="flex gap-3">
        {(Object.keys(PAPER) as NoteColor[]).map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={d.color === c}
            aria-label={c === "orange" ? "yellow" : c}
            onClick={() => setD({ ...d, color: c })}
            className={`size-10 rounded-[6px] shadow-[0_2px_4px_rgba(0,0,0,.18)] ${d.color === c ? "outline-2 outline-offset-2 outline-ink" : ""}`}
            style={{ background: PAPER[c]![0] }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="h-12 grow rounded-full bg-ink text-[15px] font-semibold text-on-ink">
          {editing ? "Save" : "Stick it on the page"}
        </button>
        {editing && (
          <button
            aria-label="Delete this sticky note"
            onClick={() => {
              deleteNote(editing.id);
              onClose();
            }}
            className="flex size-12 shrink-0 items-center justify-center rounded-full border border-ink/15"
          >
            <TrashIcon size={18} />
          </button>
        )}
      </div>
    </Sheet>
  );
}

// Saves a change to the PDF's row and hands the new row back to the reader.
export const patchPdf = (meta: PdfMeta, patch: Partial<PdfMeta>, set: (m: PdfMeta) => void) => {
  set({ ...meta, ...patch });
  updatePdf(meta.id, patch);
};
