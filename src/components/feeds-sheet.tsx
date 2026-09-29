"use client";

import { useState } from "react";
import { addFeed, getFeeds, removeFeed, sameFeed, SUGGESTED } from "@/lib/feeds";
import { useStore } from "@/lib/use-store";
import { PlusIcon, TrashIcon } from "./icons";
import { Sheet } from "./sheet";
import { RssIcon } from "./stack-icons";
import { useToast } from "./toast";

// Add and remove your own feeds. `onChange` runs after a change so News can reload.
export function FeedsSheet({ open, onClose, onChange }: { open: boolean; onClose: () => void; onChange: () => void }) {
  const [feeds] = useStore(getFeeds, []);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // the address being added
  const [error, setError] = useState("");
  const toast = useToast();

  const add = async (address: string) => {
    if (!address.trim() || busy) return;
    setBusy(address);
    setError("");
    const { feed, error } = await addFeed(address);
    setBusy(null);
    if (error) return setError(error);
    setUrl("");
    toast({ text: `Added ${feed!.title}` });
    onChange();
  };

  const remove = async (id: string, title: string) => {
    await removeFeed(id);
    toast({ text: `Removed ${title}` });
    onChange();
  };

  const suggestions = SUGGESTED.filter((s) => !feeds.some((f) => sameFeed(f.url, s.url)));

  return (
    <Sheet open={open} onClose={onClose} title="My feeds">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(url);
        }}
        className="flex gap-2"
      >
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError("");
          }}
          type="text"
          inputMode="url"
          autoCorrect="off"
          spellCheck={false}
          autoCapitalize="none"
          placeholder="Feed or website address"
          aria-label="Feed or website address"
          className="h-12 min-w-0 grow rounded-full border border-ink/15 bg-card px-4 text-[15px] outline-none focus:border-ink"
        />
        <button
          disabled={!url.trim() || !!busy}
          className="h-12 shrink-0 rounded-full bg-ink px-5 text-[15px] font-semibold text-on-ink disabled:opacity-40"
        >
          {busy === url && url ? "Checking…" : "Add"}
        </button>
      </form>
      {error ? (
        <p className="-mt-2 text-[13px] text-music-text">{error}</p>
      ) : (
        <p className="-mt-2 text-[13px] text-muted">Paste an RSS or Atom link, or just a site like theverge.com.</p>
      )}

      {feeds.length > 0 && (
        <ul className="flex flex-col">
          {feeds.map((f) => (
            <li key={f.id} className="flex items-center gap-3 border-b border-line py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-news-tint text-news-deep">
                <RssIcon size={18} />
              </span>
              <span className="flex min-w-0 grow flex-col">
                <span className="truncate text-[15px] font-semibold">{f.title}</span>
                <span className="label truncate text-[9px] text-muted">{f.url.replace(/^https?:\/\//, "")}</span>
              </span>
              <button
                aria-label={`Remove ${f.title}`}
                onClick={() => remove(f.id, f.title)}
                className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted"
              >
                <TrashIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {suggestions.length > 0 && (
        <>
          <h3 className="label mt-1 text-[10px] text-muted">Suggestions</h3>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.url}
                onClick={() => add(s.url)}
                disabled={!!busy}
                className="flex h-10 items-center gap-1.5 rounded-full border border-ink/20 pr-3.5 pl-2.5 text-[13px] font-medium disabled:opacity-50"
              >
                <PlusIcon size={14} />
                {busy === s.url ? "Adding…" : s.title}
                <span className="text-muted">· {s.note}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
