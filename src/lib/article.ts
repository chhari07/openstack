// Turns one story into a clean, readable article. Only story ids are accepted:
// HN/dev.to ids are looked up at the source, and "web-" ids must point at one
// of the known news sites (NEWS_HOSTS), so this can't fetch arbitrary addresses. The HTML parsing is passed in because it differs:
// linkedom + sanitize-html on the server, the browser's DOMParser + DOMPurify
// inside the Android app.

import { isNewsHost, linkUrl, webUrl } from "./news";

export type Article = {
  id: string;
  title: string;
  source: string;
  url: string;
  author?: string;
  image?: string;
  createdAt?: string;
  readMinutes: number;
  html: string | null; // null = page couldn't be turned into a readable article
};

export type HtmlTools = {
  // Readability over a full page; null when there's no real article in it.
  readable: (
    page: string,
    url: string,
  ) => { html: string; byline?: string; title?: string; published?: string } | null;
  // Meta og:image of a full page.
  ogImage: (page: string) => string | undefined;
  // og:title (or <title>), for pages Readability can't read, like videos.
  ogTitle?: (page: string) => string | undefined;
  // Sanitise a fragment and make its links/images absolute against `base`.
  clean: (html: string, base: string) => string;
};

const MAX_BYTES = 3_000_000;
const UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0 Mobile Safari/537.36";

export const readMinutes = (html: string) =>
  Math.max(1, Math.round(html.replace(/<[^>]+>/g, " ").split(/\s+/).length / 230));

export const isStoryId = (id: string) => /^(hn|devto)-\d{1,12}$/.test(id) || webUrl(id) !== null;

async function fromDevto(num: string, tools: HtmlTools): Promise<Article | null> {
  const res = await fetch(`https://dev.to/api/articles/${num}`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const a = await res.json();
  const html = tools.clean(a.body_html ?? "", a.url);
  return {
    id: `devto-${num}`,
    title: a.title,
    source: "dev.to",
    url: a.url,
    author: a.user?.name,
    image: a.cover_image ?? undefined,
    createdAt: a.published_at,
    readMinutes: a.reading_time_minutes ?? readMinutes(html),
    html,
  };
}

async function readPage(url: string, tools: HtmlTools, newsOnly = false) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 3600 },
  });
  // A news-site link must not redirect somewhere else. In the Android app,
  // Capacitor's native HTTP reports its local proxy URL; the real one is in `u`.
  const finalUrl = res.url.includes("_capacitor_http_interceptor_")
    ? (new URL(res.url).searchParams.get("u") ?? url)
    : res.url;
  if (newsOnly && finalUrl && !isNewsHost(finalUrl)) return null;
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return null;
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
  const text = await res.text();
  if (text.length > MAX_BYTES) return null;

  const image = tools.ogImage(text);
  const parsed = tools.readable(text, url);
  return {
    html: parsed ? tools.clean(parsed.html, url) : null,
    byline: parsed?.byline,
    image,
    title: parsed?.title ?? tools.ogTitle?.(text),
    published: parsed?.published,
  };
}

async function fromHn(num: string, tools: HtmlTools): Promise<Article | null> {
  const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${num}.json`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const item = await res.json();
  if (!item || item.type !== "story") return null;

  const base = {
    id: `hn-${num}`,
    title: item.title as string,
    source: "Hacker News" as const,
    author: item.by as string,
    createdAt: new Date(item.time * 1000).toISOString(),
  };

  // Ask HN / text posts have their body on HN itself.
  if (!item.url) {
    const url = `https://news.ycombinator.com/item?id=${num}`;
    const html = tools.clean(`<p>${item.text ?? ""}</p>`, url);
    return { ...base, url, html, readMinutes: readMinutes(html) };
  }

  const page = await readPage(item.url, tools).catch(() => null);
  return {
    ...base,
    url: item.url,
    author: page?.byline ?? base.author,
    image: page?.image,
    html: page?.html ?? null,
    readMinutes: page?.html ? readMinutes(page.html) : 0,
  };
}

const SITE_NAMES: [string, string][] = [
  ["bbc.", "BBC"],
  ["thehindu.com", "The Hindu"],
  ["timesofindia", "Times of India"],
  ["indianexpress.com", "Indian Express"],
  ["aljazeera.com", "Al Jazeera"],
  ["livemint.com", "Mint"],
  ["theguardian.com", "The Guardian"],
];

async function fromWeb(id: string, url: string, tools: HtmlTools, newsOnly = true): Promise<Article | null> {
  const page = await readPage(url, tools, newsOnly).catch(() => null);
  const host = new URL(url).hostname;
  return {
    id,
    title: page?.title ?? host,
    source: SITE_NAMES.find(([k]) => host.includes(k))?.[1] ?? host,
    url,
    author: page?.byline,
    image: page?.image,
    createdAt: page?.published,
    html: page?.html ?? null,
    readMinutes: page?.html ? readMinutes(page.html) : 0,
  };
}

// `anyLink`: also read shared "link-" pages (only the Android app passes it).
export async function getArticle(id: string, tools: HtmlTools, anyLink = false): Promise<Article | null> {
  const web = webUrl(id);
  if (web) return fromWeb(id, web, tools).catch(() => null);
  const link = anyLink ? linkUrl(id) : null;
  if (link) return fromWeb(id, link, tools, false).catch(() => null);
  const m = id.match(/^(hn|devto)-(\d{1,12})$/);
  if (!m) return null;
  return (m[1] === "hn" ? fromHn(m[2], tools) : fromDevto(m[2], tools)).catch(() => null);
}

// Rules shared by both sanitisers.
export const ALLOWED_TAGS = [
  "p", "h2", "h3", "h4", "blockquote", "ul", "ol", "li", "pre", "code",
  "em", "strong", "b", "i", "a", "img", "figure", "figcaption", "br", "hr",
  "table", "thead", "tbody", "tr", "th", "td", "sup", "sub",
];

export function absolute(u: string | undefined | null, base: string) {
  if (!u) return undefined;
  try {
    const url = new URL(u, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
