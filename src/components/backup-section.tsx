"use client";

import { useEffect, useRef, useState } from "react";
import { pdfFilesSize, readBackup, restoreBackup, saveBackup, type Backup, type Summary } from "@/lib/backup";
import { DownloadIcon, UploadIcon } from "./stack-icons";
import { Sheet } from "./sheet";
import { useToast } from "./toast";

const mb = (bytes: number) => (bytes < 1e6 ? `${Math.max(1, Math.round(bytes / 1e3))} KB` : `${(bytes / 1e6).toFixed(1)} MB`);

// Settings → Backup: save everything to a file, or bring a backup back.
export function BackupSection() {
  const [withPdfs, setWithPdfs] = useState(true);
  const [pdfBytes, setPdfBytes] = useState(0);
  const [busy, setBusy] = useState<"save" | "restore" | null>(null);
  const [pending, setPending] = useState<{ backup: Backup; summary: Summary } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    pdfFilesSize().then(setPdfBytes);
  }, []);

  const save = async () => {
    setBusy("save");
    try {
      const r = await saveBackup(withPdfs);
      if (r === "saved") toast({ text: "Backup saved" });
    } catch {
      toast({ text: "Couldn’t save the backup" });
    }
    setBusy(null);
  };

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy("restore");
    const r = await readBackup(file);
    setBusy(null);
    if ("error" in r) return toast({ text: r.error });
    setPending(r);
  };

  const restore = async () => {
    if (!pending) return;
    setBusy("restore");
    try {
      await restoreBackup(pending.backup);
      toast({ text: "Backup restored" });
      setPending(null);
    } catch {
      toast({ text: "Couldn’t restore that backup" });
    }
    setBusy(null);
  };

  const s = pending?.summary;
  const lines = s
    ? [
        [s.notes, "note"],
        [s.highlights, "highlight"],
        [s.saved, "saved article"],
        [s.pdfs, "PDF"],
        [s.playlists, "playlist"],
        [s.focus, "focus session"],
        [s.feeds, "feed"],
      ].filter(([n]) => (n as number) > 0)
    : [];

  return (
    <>
      <p className="text-[14px] leading-relaxed text-muted">
        Keep everything in one file: notes, highlights, saved articles, PDFs, playlists, focus history, feeds and your
        profile. Works without an account.
      </p>
      <label className="flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-[14px] font-semibold">Include PDF files</span>
          <span className="text-[12px] text-muted">{pdfBytes ? `About ${mb(pdfBytes * 1.34)} more` : "No PDF files on this device"}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={withPdfs}
          onChange={(e) => setWithPdfs(e.target.checked)}
          className="h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-rule transition-colors before:block before:size-6 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-music checked:before:translate-x-[22px]"
        />
      </label>
      <div className="flex gap-2.5">
        <button
          onClick={save}
          disabled={!!busy}
          className="flex h-12 grow items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-50"
        >
          <DownloadIcon size={18} />
          {busy === "save" ? "Saving…" : "Back up"}
        </button>
        <button
          onClick={() => input.current?.click()}
          disabled={!!busy}
          className="flex h-12 grow items-center justify-center gap-2 rounded-full border border-ink/20 text-[15px] font-semibold disabled:opacity-50"
        >
          <UploadIcon size={18} />
          {busy === "restore" && !pending ? "Reading…" : "Restore"}
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <Sheet open={!!pending} onClose={() => busy !== "restore" && setPending(null)} title="Restore this backup?">
        {s && (
          <>
            <p className="text-[15px] leading-relaxed">
              From{" "}
              <b>
                {new Date(s.exportedAt).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
              </b>
              :
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {lines.map(([n, word]) => (
                <li key={word as string} className="label rounded-full bg-card px-3 py-1.5 text-[10px]">
                  {n as number} {word as string}
                  {(n as number) === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
            {s.pdfs > 0 && s.pdfFiles < s.pdfs && (
              <p className="text-[13px] text-muted">
                {s.pdfFiles === 0 ? "PDF files aren’t in this backup" : `${s.pdfFiles} of ${s.pdfs} PDF files are in it`}: the others
                open only if they’re already on this device or in your account.
              </p>
            )}
            <p className="text-[13px] leading-relaxed text-muted">
              It’s added to what’s already here. Anything in both is replaced by the backup’s copy. Nothing is deleted.
            </p>
            <button
              onClick={restore}
              disabled={busy === "restore"}
              className="h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-50"
            >
              {busy === "restore" ? "Restoring…" : "Restore"}
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}
