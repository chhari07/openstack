"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { BackIcon, ExternalIcon, PlayIcon } from "@/components/icons";
import { useSpotify } from "@/components/spotify-provider";
import { mmss } from "@/lib/format";
import { api, art, artists, SpotifyError, type SpImage, type SpTrack } from "@/lib/spotify";
import { HeartFilledIcon } from "@/components/stack-icons";

type Meta = { name: string; owner?: string; total: number; image?: string; uri?: string; web: string };
type Row = { track?: SpTrack | null; item?: SpTrack | null };
type Page = { items: Row[]; total: number; next: string | null };

const LIKED = "liked";
const PAGE = 50;

// Spotify has renamed the playlist-items endpoint (/tracks → /items), so try
// the new one first and fall back.
async function playlistPage(id: string, offset: number): Promise<Page | null> {
  const q = `?limit=${PAGE}&offset=${offset}`;
  try {
    return await api<Page>(`/playlists/${id}/items${q}`);
  } catch (e) {
    if (e instanceof SpotifyError && e.status === 404) return api<Page>(`/playlists/${id}/tracks${q}`);
    throw e;
  }
}

export default function Page() {
  return (
    <Suspense>
      <Playlist />
    </Suspense>
  );
}

function Playlist() {
  const id = useSearchParams().get("id") ?? "";
  const sp = useSpotify();
  const liked = id === LIKED;
  const [meta, setMeta] = useState<Meta | null>(null);
  const [tracks, setTracks] = useState<SpTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (offset: number) => {
      setLoading(true);
      try {
        const page = liked
          ? await api<Page>(`/me/tracks?limit=${PAGE}&offset=${offset}`)
          : await playlistPage(id, offset);
        const got = (page?.items ?? [])
          .map((r) => r.item ?? r.track)
          .filter((t): t is SpTrack => !!t && !!t.id);
        setTracks((prev) => (offset === 0 ? got : [...prev, ...got]));
        setTotal(page?.total ?? 0);
      } catch (e) {
        setError(
          e instanceof SpotifyError && (e.status === 403 || e.status === 404)
            ? "Spotify doesn’t let apps read this playlist’s tracks (Spotify-made playlists are blocked). You can still open it in Spotify."
            : (e as Error).message,
        );
      } finally {
        setLoading(false);
      }
    },
    [id, liked],
  );

  useEffect(() => {
    if (!sp.connected || !id) return;
    if (liked) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMeta({ name: "Liked Songs", total: 0, web: "https://open.spotify.com/collection/tracks" });
    } else {
      api<{ name: string; uri: string; owner: { display_name?: string }; images: SpImage[] | null; external_urls: { spotify: string } }>(
        `/playlists/${id}?fields=name,uri,owner(display_name),images,external_urls`,
      )
        .then((p) =>
          p &&
          setMeta({
            name: p.name,
            owner: p.owner?.display_name,
            total: 0,
            image: art(p.images, true),
            uri: p.uri,
            web: p.external_urls?.spotify ?? `https://open.spotify.com/playlist/${id}`,
          }),
        )
        .catch(() => setMeta({ name: "Playlist", total: 0, web: `https://open.spotify.com/playlist/${id}` }));
    }
    load(0);
  }, [sp.connected, id, liked, load]);

  const play = (index: number) => {
    if (meta?.uri) sp.playContext(meta.uri, tracks[index]?.uri);
    else sp.playUris(tracks.map((t) => t.uri), index);
  };

  const playing = sp.player?.item?.id;

  return (
    <main className="px-5 pt-5 pb-16 md:mx-auto md:max-w-[900px] md:px-10 md:pt-8">
      <div className="flex h-11 items-center">
        <Link href="/music" aria-label="Back to music" className="-ml-2 flex size-11 items-center justify-center">
          <BackIcon size={22} />
        </Link>
      </div>

      {!sp.connected ? (
        <p className="mt-6 text-[15px] text-muted">
          Log in to Spotify in <Link href="/music" className="underline">Music</Link> first.
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-end gap-4">
            <div className={`size-[132px] shrink-0 overflow-hidden shadow-[0_10px_24px_rgba(0,0,0,.18)] ${liked ? "bg-[#5B3F7A]" : "bg-music"}`}>
              {meta?.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={meta.image} alt="" className="size-full object-cover" />
              )}
              {liked && (
                <span className="flex size-full items-center justify-center text-white">
                  <HeartFilledIcon size={60} />
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="label text-[10px] text-muted">{liked ? "Your library" : "Playlist"}</span>
              <h1 className="display line-clamp-3 text-[40px] leading-[0.9] tracking-[-0.03em] uppercase">
                {meta?.name ?? "…"}
              </h1>
              <span className="label text-[10px] text-muted">
                {meta?.owner ? `${meta.owner} · ` : ""}
                {total} tracks
              </span>
            </div>
          </div>

          <div className="mt-5 flex gap-2.5">
            <button
              onClick={() => play(0)}
              disabled={tracks.length === 0}
              className="flex h-12 grow items-center justify-center gap-2 rounded-full bg-music text-[15px] font-semibold text-white disabled:opacity-40"
            >
              <PlayIcon size={16} /> Play
            </button>
            {meta && (
              <a
                href={meta.web}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 grow items-center justify-center gap-2 rounded-full border border-ink/15 text-[15px] font-semibold"
              >
                Open in Spotify <ExternalIcon size={14} />
              </a>
            )}
          </div>

          {sp.error && (
            <p role="alert" className="mt-3 rounded-xl bg-music-tint px-3.5 py-2.5 text-[13px] text-music-deep">
              {sp.error}
            </p>
          )}
          {sp.status && (
            <p role="status" className="mt-3 rounded-xl bg-news-tint px-3.5 py-2.5 text-[13px] text-news-deep">
              {sp.status}
            </p>
          )}
          {error && <p className="mt-4 text-[14px] leading-relaxed text-muted">{error}</p>}

          <ol className="mt-4">
            {tracks.map((t, i) => {
              const img = art(t.album.images);
              const now = t.id === playing;
              return (
                <li key={`${t.id}-${i}`}>
                  <button onClick={() => play(i)} className="flex h-14 w-full items-center gap-3 text-left">
                    <span className={`label w-6 text-[10px] ${now ? "text-music-text" : ""}`}>
                      {now ? "▶" : String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="size-10 shrink-0 overflow-hidden bg-rule">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {img && <img src={img} alt="" loading="lazy" className="size-full object-cover" />}
                    </span>
                    <span className="flex min-w-0 grow flex-col">
                      <span className={`song truncate text-[15px] ${now ? "text-music-text" : ""}`}>{t.name}</span>
                      <span className="label truncate text-[9px] text-muted">{artists(t)}</span>
                    </span>
                    <span className="label text-[10px]">{mmss(t.duration_ms)}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {tracks.length < total && !error && (
            <button
              onClick={() => load(tracks.length)}
              disabled={loading}
              className="label mt-3 h-11 w-full rounded-full border border-ink/15 text-[10px]"
            >
              {loading ? "Loading…" : `Load more (${total - tracks.length})`}
            </button>
          )}
          {loading && tracks.length === 0 && <p className="label mt-6 text-center text-[10px] text-muted">Loading tracks…</p>}
        </>
      )}
    </main>
  );
}
