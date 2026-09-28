"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fileSize, PhoneFiles, readPhoneFile, useAllFiles, type PhoneFile } from "@/lib/phone-files";
import { useIsNative } from "@/lib/platform";
import { PlusIcon, SearchIcon } from "./icons";

// "On this phone": PDFs that aren't in the Library yet, from the whole phone
// (All files access) or from one picked folder. Android app only.
export function PhoneShelf({
  added,
  onPick,
}: {
  added: Set<string>; // source URIs/paths already in the Library
  onPick: (file: File, uri: string) => void;
}) {
  const native = useIsNative();
  const all = useAllFiles();
  const [folder, setFolder] = useState<string | null | undefined>(undefined);
  const [files, setFiles] = useState<PhoneFile[] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const scan = useCallback(async () => {
    if (all.granted === null) return;
    try {
      if (all.granted) {
        setFiles((await PhoneFiles.scanPdfs()).files);
      } else {
        const f = await PhoneFiles.getFolder();
        setFolder(f.name ?? null);
        setFiles(f.name ? (await PhoneFiles.listPdfs()).files : null);
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [all.granted]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (native) scan();
  }, [native, scan]);

  if (!native || all.granted === null) return null;

  if (!all.granted && folder === null) {
    return (
      <section className="mt-5 flex flex-col gap-3 rounded-2xl bg-card p-4">
        <h2 className="text-[16px] font-semibold">PDFs on your phone</h2>
        <p className="text-[14px] leading-relaxed text-muted">
          Turn on <b className="text-ink">All files access</b> and Stack will find every PDF on this phone, including
          Download, and your music too. Android shows a switch for Stack; turn it on and come back.
        </p>
        <button onClick={all.request} className="h-11 rounded-full bg-ink text-[14px] font-semibold text-on-ink">
          Allow access to all files
        </button>
        <button
          onClick={() => PhoneFiles.pickFolder().then(scan).catch(() => {})}
          className="text-[13px] text-muted underline"
        >
          Or pick just one folder
        </button>
      </section>
    );
  }

  if (folder === undefined && !all.granted) return null;

  const q = query.trim().toLowerCase();
  const fresh = (files ?? [])
    .filter((f) => !added.has(f.uri))
    .filter((f) => !q || f.path.toLowerCase().includes(q))
    .sort((a, b) => b.modified - a.modified);
  const shown = showAll ? fresh : fresh.slice(0, 8);

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold">On this phone</h2>
        <Link href="/settings" className="label text-[10px] text-muted underline">
          {all.granted ? "All folders" : folder}
        </Link>
      </div>
      {files && files.length > 8 && (
        <label className="mt-2 flex h-10 items-center gap-2 rounded-full border border-ink/12 bg-card px-3.5">
          <SearchIcon size={16} className="text-muted" />
          <input
            aria-label="Search PDFs on this phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${files.length} PDFs`}
            className="grow bg-transparent text-[13px] outline-none"
          />
        </label>
      )}
      {error && <p className="mt-2 text-[13px] text-music-deep">{error}</p>}
      {files === null && !error && <p className="label mt-2 text-[10px] text-muted">Looking for PDFs…</p>}
      {files && !error && fresh.length === 0 && (
        <p className="mt-2 text-[13px] text-muted">
          {q ? "No PDFs match." : files.length ? "Every PDF found is already in your Library." : "No PDFs found."}
        </p>
      )}
      <ul className="mt-1 md:grid md:grid-cols-2 md:gap-x-10">
        {shown.map((f) => (
          <li key={f.uri} className="flex items-center gap-3 border-b border-line py-2.5">
            <span className="label flex h-11 w-8 shrink-0 items-center justify-center bg-card text-[7px] text-music-deep shadow-[0_2px_6px_rgba(0,0,0,.12)]">
              PDF
            </span>
            <span className="flex min-w-0 grow flex-col">
              <span className="truncate text-[14px] font-medium">{f.name.replace(/\.pdf$/i, "")}</span>
              <span className="label truncate text-[9px] text-muted">
                {f.path.includes("/") ? `${f.path.slice(0, f.path.lastIndexOf("/"))} · ` : ""}
                {fileSize(f.size)}
              </span>
            </span>
            <button
              aria-label={`Add ${f.name}`}
              disabled={loading !== null}
              onClick={async () => {
                setLoading(f.uri);
                try {
                  onPick(await readPhoneFile(f), f.uri);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setLoading(null);
                }
              }}
              className="label flex h-9 shrink-0 items-center gap-1 rounded-full border border-ink/15 px-3 text-[10px] disabled:opacity-40"
            >
              {loading === f.uri ? (
                "…"
              ) : (
                <>
                  <PlusIcon size={12} /> Add
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
      {fresh.length > 8 && (
        <button onClick={() => setShowAll((a) => !a)} className="label mt-2 h-8 text-[10px] underline">
          {showAll ? "Show fewer" : `Show all ${fresh.length}`}
        </button>
      )}
    </section>
  );
}
