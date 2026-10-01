"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  BackIcon,
  CloseIcon,
  ExternalIcon,
  FontIcon,
  ListIcon,
  PaletteIcon,
  PinIcon,
  PlusIcon,
  ShareIcon,
  TrashIcon,
} from "@/components/icons";
import { useToast } from "@/components/toast";
import {
  COLORS,
  colorCls,
  colorOf,
  noteHref,
  noteText,
} from "@/components/note-card";
import {
  addNote,
  deleteNote,
  getNote,
  restoreNote,
  uid,
  updateNote,
  type ChecklistItem,
  type Note,
  type NoteColor,
} from "@/lib/db";
import { noteTime } from "@/lib/format";
import { AiError, aiAvailable, answerText, runAi } from "@/lib/ai";
import { useAiConsent } from "@/components/ai-kit";
import { SparkleIcon } from "@/components/stack-icons";
import { canGoBack } from "@/lib/nav";
import {
  FONTS,
  addCustomFont,
  customFont,
  fontFamily,
  removeCustomFont,
  useCustomFonts,
} from "@/lib/note-fonts";

export default function Page() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <Editor />
    </Suspense>
  );
}

type Draft = {
  title: string;
  body: string;
  checklist?: ChecklistItem[];
  color: NoteColor;
  pinned: boolean;
  font?: string;
};

const isEmpty = (d: Draft, n: Note | null) =>
  !d.title.trim() &&
  !d.body.trim() &&
  !(d.checklist ?? []).some((i) => i.text.trim()) &&
  !n?.quote;

// A textarea that grows with its text, so the page scrolls instead of the box.
function AutoText(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

function Editor() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const paramId = params.get("id");

  const [note, setNote] = useState<Note | null>(null); // the stored note, if any
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    title: "",
    body: "",
    checklist: params.get("list") ? [{ id: uid(), text: "", done: false }] : undefined,
    color: "default",
    pinned: false,
  });
  const [panel, setPanel] = useState<"colour" | "font" | null>(null);
  const customFonts = useCustomFonts();
  const fontInput = useRef<HTMLInputElement>(null);
  const [showDone, setShowDone] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Refs so the save queue and unmount cleanup always see the latest values.
  const idRef = useRef<string | null>(paramId);
  const draftRef = useRef(draft);
  const noteRef = useRef(note);
  const dirty = useRef(false);
  const deleted = useRef(false);
  const createdHere = useRef(false); // only a note made on this visit is dropped when left empty
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const itemRefs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    draftRef.current = draft;
    noteRef.current = note;
  });

  useEffect(() => {
    if (!paramId) return;
    getNote(paramId).then((n) => {
      if (!n) return setMissing(true);
      setNote(n);
      setDraft({
        title: n.title ?? "",
        body: n.body ?? "",
        checklist: n.checklist,
        color: colorOf(n),
        pinned: !!n.pinned,
        font: n.font,
      });
    });
  }, [paramId]);

  // Saves one after another, so a new note is only created once.
  const save = useCallback(() => {
    queue.current = queue.current.then(async () => {
      if (deleted.current || !dirty.current) return;
      dirty.current = false;
      const d = draftRef.current;
      const n = noteRef.current;
      const fields = {
        title: d.title.trim() || undefined,
        body: d.body.trim() ? d.body : undefined,
        checklist: d.checklist,
        color: d.color,
        pinned: d.pinned,
        font: d.font,
        highlight: !!n?.quote && !d.body.trim(),
      };
      if (idRef.current) {
        await updateNote(idRef.current, fields);
        setNote((cur) => (cur ? { ...cur, ...fields, updatedAt: Date.now() } : cur));
      } else if (!isEmpty(d, null)) {
        const created = await addNote({ kind: "idea", ...fields });
        idRef.current = created.id;
        createdHere.current = true;
        setNote(created);
        // Reopening or going back returns to this note, not a blank one.
        window.history.replaceState(window.history.state, "", noteHref(created.id));
      }
    });
    return queue.current;
  }, []);

  const change = (patch: Partial<Draft>) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, ...patch }));
    clearTimeout(timer.current);
    timer.current = setTimeout(save, 400);
  };

  // Leaving the page: save what's pending, and drop a new note that was
  // emptied again. Existing notes are never removed here (they may not have
  // finished loading yet); only the Delete button removes them.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      save().then(() => {
        if (
          createdHere.current &&
          !deleted.current &&
          idRef.current &&
          isEmpty(draftRef.current, noteRef.current)
        ) {
          deleteNote(idRef.current);
          idRef.current = null;
          createdHere.current = false;
        }
      });
    },
    [save],
  );

  useEffect(() => {
    if (!focusId) return;
    const el = itemRefs.current.get(focusId);
    if (el) {
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFocusId(null);
  }, [focusId, draft.checklist]);

  const goBack = () => {
    if (canGoBack()) router.back();
    else router.replace("/notes");
  };

  // ---- Checklist ----
  const items = draft.checklist ?? [];
  const setItems = (next: ChecklistItem[]) => change({ checklist: next });
  const addItemAfter = (id: string | null) => {
    const item = { id: uid(), text: "", done: false };
    const at = id ? items.findIndex((i) => i.id === id) + 1 : items.filter((i) => !i.done).length;
    setItems([...items.slice(0, at), item, ...items.slice(at)]);
    setFocusId(item.id);
  };
  const onItemKey = (e: KeyboardEvent<HTMLInputElement>, item: ChecklistItem) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItemAfter(item.id);
    } else if (e.key === "Backspace" && item.text === "") {
      e.preventDefault();
      const open = items.filter((i) => !i.done);
      const prev = open[open.findIndex((i) => i.id === item.id) - 1];
      setItems(items.filter((i) => i.id !== item.id));
      if (prev) setFocusId(prev.id);
    }
  };
  const toggleList = () => {
    if (draft.checklist) {
      // List → text: one line per item.
      change({ checklist: undefined, body: items.map((i) => i.text).filter(Boolean).join("\n") });
    } else {
      const lines = draft.body.split("\n").filter((l) => l.trim());
      const next = (lines.length ? lines : [""]).map((text) => ({ id: uid(), text, done: false }));
      change({ checklist: next, body: "" });
      setFocusId(next[next.length - 1].id);
    }
  };

  // ---- Actions ----
  // Stack AI tidies the note: title, clean wording, bullets or a checklist. Undo puts it back.
  const [tidying, setTidying] = useState(false);
  const [confirmAi, aiSheet] = useAiConsent();
  const tidy = async () => {
    const before = draft;
    const list = (before.checklist ?? []).map((i) => `[${i.done ? "x" : " "}] ${i.text}`).join("\n");
    const text = [before.title, before.body, list].filter((x) => x.trim()).join("\n\n");
    if (!text.trim() || tidying) return;
    if (!(await confirmAi("tidy", "this note’s text"))) return;
    setTidying(true);
    try {
      const out = answerText(await runAi({ task: "tidy", text }));
      const [first, ...rest] = out.split("\n");
      const lines = rest.join("\n").trim().split("\n");
      const todo = lines.filter((l) => /^\[[ xX]\] /.test(l.trim()));
      const next: Partial<Draft> =
        todo.length && todo.length >= lines.filter((l) => l.trim()).length * 0.8
          ? {
              title: first.trim(),
              body: "",
              checklist: todo.map((l) => ({ id: uid(), text: l.trim().slice(4), done: /^\[[xX]\]/.test(l.trim()) })),
            }
          : { title: first.trim(), body: lines.join("\n").trim(), checklist: undefined };
      change(next);
      toast({ text: "Note tidied", action: "Undo", onAction: () => change(before) });
    } catch (e) {
      toast({ text: e instanceof AiError ? e.message : "Couldn’t tidy the note" });
    }
    setTidying(false);
  };

  const share = async () => {
    const text = noteText({
      ...(note ?? { id: "", kind: "idea", createdAt: 0 }),
      title: draft.title,
      body: draft.body,
      checklist: draft.checklist,
    });
    try {
      if (navigator.share) await navigator.share({ title: draft.title || undefined, text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ text: "Note copied" });
      }
    } catch {
      /* cancelled */
    }
  };

  const addFont = async (file: File) => {
    try {
      change({ font: customFont(await addCustomFont(file)).value });
    } catch (e) {
      toast({ text: e instanceof Error ? e.message : "Couldn’t add that font" });
    }
  };
  const removeFont = async (id: string, value: string) => {
    await removeCustomFont(id);
    if (draft.font === value) change({ font: undefined });
    toast({ text: "Font removed from this device" });
  };

  const remove = async () => {
    clearTimeout(timer.current);
    await queue.current;
    deleted.current = true;
    const stored = idRef.current ? await getNote(idRef.current) : null;
    if (stored) {
      await deleteNote(stored.id);
      toast({ text: "Note deleted", action: "Undo", onAction: () => restoreNote(stored) });
    }
    goBack();
  };

  if (missing) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5">
        <p className="font-serif text-[22px] italic">This note no longer exists.</p>
        <Link href="/notes" className="label text-[11px] underline">
          Back to notes
        </Link>
      </main>
    );
  }

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const dark = draft.color === "ink";
  const tone = colorCls(draft.color);
  const iconBtn = "flex size-11 items-center justify-center rounded-full";
  const edited = note?.updatedAt ?? note?.createdAt;

  const itemRow = (item: ChecklistItem) => (
    <li key={item.id} className="flex min-h-11 items-center gap-2.5">
      <button
        role="checkbox"
        aria-checked={item.done}
        aria-label={item.done ? "Mark as not done" : "Mark as done"}
        onClick={() => setItems(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
        className="flex size-9 shrink-0 items-center justify-center"
      >
        <span
          className={`flex size-[18px] items-center justify-center rounded-[5px] border-[1.5px] border-current text-[12px] ${
            item.done ? "opacity-50" : "opacity-80"
          }`}
        >
          {item.done ? "✓" : ""}
        </span>
      </button>
      <input
        ref={(el) => {
          if (el) itemRefs.current.set(item.id, el);
          else itemRefs.current.delete(item.id);
        }}
        aria-label="List item"
        value={item.text}
        onChange={(e) => setItems(items.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)))}
        onKeyDown={(e) => onItemKey(e, item)}
        enterKeyHint="next"
        className={`min-w-0 grow bg-transparent text-[16px] outline-none ${item.done ? "line-through opacity-55" : ""}`}
      />
      <button
        aria-label="Remove item"
        onClick={() => setItems(items.filter((i) => i.id !== item.id))}
        className="flex size-9 shrink-0 items-center justify-center opacity-45"
      >
        <CloseIcon size={16} />
      </button>
    </li>
  );

  return (
    <main className={`min-h-dvh pb-[calc(120px+env(safe-area-inset-bottom))] ${tone}`}>
      {/* Top bar */}
      <div className={`sticky top-0 z-20 -mt-[env(safe-area-inset-top)] flex items-center justify-between px-2 pt-[calc(env(safe-area-inset-top)+8px)] pb-1 md:px-8 ${tone}`}>
        <button aria-label="Back to notes" onClick={goBack} className={iconBtn}>
          <BackIcon size={22} />
        </button>
        <button
          aria-label={draft.pinned ? "Unpin note" : "Pin note"}
          aria-pressed={draft.pinned}
          onClick={() => change({ pinned: !draft.pinned })}
          className={iconBtn}
        >
          <PinIcon size={21} filled={draft.pinned} />
        </button>
      </div>

      <div className="mx-auto max-w-[720px] px-5 md:px-8" style={{ fontFamily: fontFamily(draft.font) }}>
        {note?.quote && (
          <div className="mt-2 flex flex-col gap-2.5">
            <blockquote
              className={`rounded-xl px-3.5 py-3 text-[15px] leading-snug ${dark ? "bg-on-ink/10" : "bg-paper/70"} ${
                note.kind === "pdf" ? "font-serif text-[17px] italic" : ""
              }`}
            >
              “{note.quote}”
            </blockquote>
            {note.href && (
              <Link href={note.href} className="label flex items-center gap-1.5 self-start text-[10px] underline">
                {note.sourceTitle ?? "Open source"}
                {note.page ? ` · p. ${note.page}` : ""} <ExternalIcon size={12} />
              </Link>
            )}
          </div>
        )}

        <AutoText
          aria-label="Title"
          value={draft.title}
          onChange={(e) => change({ title: e.target.value.replace(/\n/g, " ") })}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (!draft.checklist) document.getElementById("note-body")?.focus();
            else if (items[0]) setFocusId(items[0].id);
            else addItemAfter(null);
          }}
          placeholder="Title"
          enterKeyHint="next"
          className="mt-3 w-full resize-none bg-transparent text-[26px] leading-[1.2] font-bold outline-none [font-stretch:87%] placeholder:text-current placeholder:opacity-35"
        />

        {draft.checklist ? (
          <div className="mt-2">
            <ul>{open.map(itemRow)}</ul>
            <button
              onClick={() => addItemAfter(null)}
              className="flex h-11 items-center gap-2.5 text-[15px] opacity-60"
            >
              <span className="flex size-9 items-center justify-center">
                <PlusIcon size={18} />
              </span>
              List item
            </button>
            {done.length > 0 && (
              <>
                <button
                  onClick={() => setShowDone((s) => !s)}
                  aria-expanded={showDone}
                  className="label mt-2 h-10 w-full border-t border-current/15 pt-2 text-left text-[10px] opacity-60"
                >
                  {showDone ? "▾" : "▸"} {done.length} checked item{done.length > 1 ? "s" : ""}
                </button>
                {showDone && <ul>{done.map(itemRow)}</ul>}
              </>
            )}
          </div>
        ) : (
          <AutoText
            id="note-body"
            aria-label="Note"
            value={draft.body}
            onChange={(e) => change({ body: e.target.value })}
            autoFocus={!paramId}
            placeholder={note?.quote ? "Add your thoughts" : "Note"}
            className="mt-2 min-h-[40vh] w-full resize-none bg-transparent text-[17px] leading-[1.55] outline-none placeholder:text-current placeholder:opacity-35"
          />
        )}
      </div>

      {/* Bottom toolbar */}
      <div className={`fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-current/10 pb-[env(safe-area-inset-bottom)] md:left-[var(--rail)] md:max-w-none ${tone}`}>
        {panel === "colour" && (
          <div role="radiogroup" aria-label="Note colour" className="rail gap-3 px-5 pt-3 pb-1">
            {COLORS.map((c) => (
              <button
                key={c.value}
                role="radio"
                aria-checked={draft.color === c.value}
                aria-label={c.label}
                onClick={() => change({ color: c.value })}
                className={`size-10 rounded-full border ${c.swatch} ${
                  draft.color === c.value ? "border-2 border-music outline-2 outline-offset-2 outline-music/40" : "border-ink/20"
                }`}
              />
            ))}
          </div>
        )}
        {panel === "font" && (
          <div role="radiogroup" aria-label="Note font" className="rail gap-2 px-5 pt-3 pb-1">
            {[...FONTS, ...customFonts.map(customFont)].map((f) => {
              const on = (draft.font ?? "sans") === f.value;
              const mine = f.value.startsWith("custom:");
              return (
                <span
                  key={f.value}
                  className={`flex h-11 items-center rounded-full border ${
                    on ? "border-2 border-music" : "border-current/25"
                  }`}
                >
                  <button
                    role="radio"
                    aria-checked={on}
                    onClick={() => change({ font: f.value === "sans" ? undefined : f.value })}
                    style={{ fontFamily: f.family }}
                    className={`h-full text-[15px] ${mine && on ? "pr-1 pl-4" : "px-4"}`}
                  >
                    {f.label}
                  </button>
                  {mine && on && (
                    <button
                      aria-label={`Remove the font ${f.label} from this device`}
                      onClick={() => removeFont(f.value.slice(7), f.value)}
                      className="flex size-9 items-center justify-center opacity-60"
                    >
                      <CloseIcon size={14} />
                    </button>
                  )}
                </span>
              );
            })}
            <button
              onClick={() => fontInput.current?.click()}
              className="flex h-11 items-center gap-1.5 rounded-full border border-dashed border-current/40 px-4 text-[15px]"
            >
              <PlusIcon size={16} /> Add font
            </button>
            <input
              ref={fontInput}
              type="file"
              accept=".ttf,.otf,.woff,.woff2,font/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) addFont(f);
              }}
            />
          </div>
        )}
        <div className="mx-auto flex h-14 max-w-[720px] items-center px-2 md:px-6">
          <button
            aria-label={draft.checklist ? "Change to plain text" : "Change to checklist"}
            aria-pressed={!!draft.checklist}
            onClick={toggleList}
            className={iconBtn}
          >
            <ListIcon size={21} />
          </button>
          <button
            aria-label="Colour"
            aria-expanded={panel === "colour"}
            onClick={() => setPanel((p) => (p === "colour" ? null : "colour"))}
            className={iconBtn}
          >
            <PaletteIcon size={21} />
          </button>
          <button
            aria-label="Font"
            aria-expanded={panel === "font"}
            onClick={() => setPanel((p) => (p === "font" ? null : "font"))}
            className={iconBtn}
          >
            <FontIcon size={21} />
          </button>
          <span className="label grow text-center text-[10px] opacity-60">
            {edited ? `Edited ${noteTime(edited)}` : "New note"}
          </span>
          {aiAvailable() && !note?.quote && (
            <button aria-label="Tidy with Stack AI" onClick={tidy} disabled={tidying} className={`${iconBtn} disabled:animate-pulse`}>
              <SparkleIcon size={20} />
            </button>
          )}
          <button aria-label="Share note" onClick={share} className={iconBtn}>
            <ShareIcon size={20} />
          </button>
          <button aria-label="Delete note" onClick={remove} className={iconBtn}>
            <TrashIcon size={20} />
          </button>
        </div>
      </div>
      {aiSheet}
    </main>
  );
}
