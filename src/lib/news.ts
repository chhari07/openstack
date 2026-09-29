// News fetching, all free and without API keys:
// - Tech topics: Hacker News (Algolia search API) and dev.to
// - Everything else: RSS feeds from BBC, The Hindu, Times of India, Indian
//   Express, Al Jazeera, Mint and The Guardian.
// The website runs this on the server (/api/news); the Android app runs it
// directly, since it has no server.

export type Topic =
  | "top"
  | "india"
  | "world"
  | "tech"
  | "ai"
  | "dev"
  | "business"
  | "science"
  | "sports"
  | "entertainment"
  | "health"
  | "mine"; // your own feeds (lib/feeds.ts)

export const TOPICS: { value: Topic; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "india", label: "India" },
  { value: "world", label: "World" },
  { value: "tech", label: "Tech" },
  { value: "ai", label: "AI" },
  { value: "dev", label: "Dev" },
  { value: "business", label: "Business" },
  { value: "science", label: "Science" },
  { value: "sports", label: "Sports" },
  { value: "entertainment", label: "Entertainment" },
  { value: "health", label: "Health" },
  { value: "mine", label: "My feeds" },
];
export const isTopic = (t: string): t is Topic => TOPICS.some((x) => x.value === t);

export type Story = {
  id: string; // "hn-123", "devto-456" or "web-<base64url of the article URL>"
  source: string; // "Hacker News", "BBC", "The Hindu"…
  title: string;
  url: string; // the original page
  domain?: string;
  image?: string;
  summary?: string;
  author?: string;
  createdAt: string;
  readMinutes?: number;
  points?: number;
  comments?: number;
};

const REVALIDATE = 300; // seconds

// ---- RSS feeds ----

type Feed = { source: string; url: string };
const BBC = (path: string): Feed => ({ source: "BBC", url: `https://feeds.bbci.co.uk/${path}/rss.xml` });

const FEEDS: Partial<Record<Topic, Feed[]>> = {
  top: [
    BBC("news"),
    { source: "Times of India", url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms" },
    { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  ],
  india: [
    { source: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss" },
    { source: "Indian Express", url: "https://indianexpress.com/section/india/feed/" },
    BBC("news/world/asia/india"),
  ],
  world: [
    BBC("news/world"),
    { source: "The Guardian", url: "https://www.theguardian.com/world/rss" },
    { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  ],
  business: [BBC("news/business"), { source: "Mint", url: "https://www.livemint.com/rss/news" }],
  science: [BBC("news/science_and_environment"), { source: "The Guardian", url: "https://www.theguardian.com/science/rss" }],
  sports: [BBC("sport")],
  entertainment: [BBC("news/entertainment_and_arts")],
  health: [BBC("news/health")],
};

// Reader mode may only fetch pages from these sites (plus HN-linked pages,
// which are looked up by HN id, never passed in).
export const NEWS_HOSTS = [
  "bbc.co.uk",
  "bbc.com",
  "thehindu.com",
  "timesofindia.indiatimes.com",
  "indianexpress.com",
  "aljazeera.com",
  "livemint.com",
  "theguardian.com",
];

export function isNewsHost(url: string) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && NEWS_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

const b64url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const webId = (url: string) => `web-${b64url(url)}`;

function fromB64url(s: string): string | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

export function webUrl(id: string): string | null {
  const m = id.match(/^web-([A-Za-z0-9_-]{8,1400})$/);
  const url = m && fromB64url(m[1]);
  return url && isNewsHost(url) ? url : null;
}

// Links shared into the Android app from other apps ("Share to Stack"). Any
// http(s) page is allowed, because the phone fetches it itself; the website's
// /api/article never accepts these ids.
export const linkId = (url: string) => `link-${b64url(url)}`;

export function linkUrl(id: string): string | null {
  const m = id.match(/^link-([A-Za-z0-9_-]{8,2800})$/);
  const url = m && fromB64url(m[1]);
  if (!url) return null;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .trim();
const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function tag(item: string, name: string) {
  const m = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : undefined;
}

function mediaUrl(item: string) {
  const m =
    item.match(/<media:(?:thumbnail|content)[^>]*\burl="([^"]+)"/i) ??
    item.match(/<enclosure[^>]*\burl="([^"]+)"[^>]*type="image/i);
  return m ? decode(m[1]) : undefined;
}

// A small RSS 2.0 / Atom reader. Built-in feeds only keep links to the sites
// reader mode may fetch (NEWS_HOSTS); your own feeds keep any http(s) link.
function atomLink(entry: string) {
  const links = [...entry.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const pick = links.find((l) => /rel="alternate"/i.test(l)) ?? links.find((l) => !/rel=/i.test(l)) ?? links[0];
  const href = pick?.match(/\bhref="([^"]+)"/i)?.[1];
  return href ? decode(href) : undefined;
}

function firstImage(html?: string) {
  const m = html?.match(/<img[^>]+src="(https?:[^"]+)"/i) ?? html?.match(/&lt;img[^&]+src=&quot;(https?:[^&]+)&quot;/i);
  return m ? decode(m[1]) : undefined;
}

function parseFeed(xml: string, source: string, own = false): Story[] {
  const out: Story[] = [];
  const atom = !/<item[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  for (const m of xml.matchAll(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi)) {
    const item = m[0];
    const title = tag(item, "title");
    const link = atom ? atomLink(item) : (tag(item, "link") ?? tag(item, "guid"));
    if (!title || !link) continue;
    let url: string;
    try {
      const u = new URL(link);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
      url = u.href;
    } catch {
      continue;
    }
    const known = isNewsHost(url);
    if (!own && !known) continue;
    url = url.replace(/[?#].*$/, (q) => (q.includes("at_medium=RSS") || q.includes("traffic_source") ? "" : q));
    const date = tag(item, "pubDate") ?? tag(item, "published") ?? tag(item, "updated") ?? tag(item, "dc:date");
    const raw = tag(item, "description") ?? tag(item, "summary") ?? tag(item, "content:encoded") ?? tag(item, "content");
    const summary = stripTags(decode(raw ?? ""));
    out.push({
      // Known news sites open in reader mode everywhere; other links in the app.
      id: known ? webId(url) : linkId(url),
      source,
      title: stripTags(decode(title)),
      url,
      domain: new URL(url).hostname.replace(/^www\./, ""),
      image: mediaUrl(item) ?? firstImage(raw),
      summary: summary.length > 20 ? summary.slice(0, 280) : undefined,
      createdAt: date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : new Date().toISOString(),
    });
  }
  return out;
}
const parseRss = (xml: string, source: string) => parseFeed(xml, source);

// ---- Your own feeds ----
export type FeedInfo = { url: string; title: string; site?: string };
type GetText = (url: string) => Promise<string | null>;

const looksLikeFeed = (text: string) => /<(rss|feed|rdf:RDF)[\s>]/i.test(text.slice(0, 3000));

// Reads a feed, or finds the feed of a web page (<link rel="alternate">).
export async function readFeed(
  input: string,
  getText: GetText,
): Promise<{ info: FeedInfo; stories: Story[] } | null> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  let text = await getText(url.href);
  if (!text) return null;
  if (!looksLikeFeed(text)) {
    const alt = [...text.matchAll(/<link\b[^>]*>/gi)]
      .map((m) => m[0])
      .find((l) => /rel="?alternate/i.test(l) && /type="application\/(rss|atom)\+xml"/i.test(l));
    const href = alt?.match(/\bhref="([^"]+)"/i)?.[1];
    if (!href) return null;
    url = new URL(decode(href), url);
    text = await getText(url.href);
    if (!text || !looksLikeFeed(text)) return null;
  }
  const channel = text.match(/<(channel|feed)[\s>][\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i)?.[2];
  let title = stripTags(decode(channel ?? "")) || url.hostname.replace(/^www\./, "");
  // "Articles on Smashing Magazine — For Web Designers…" → "Articles on Smashing Magazine"
  if (title.length > 28) title = title.split(/\s+[—–|:]\s+/)[0];
  const siteMatch = text.match(/<channel[\s>][\s\S]*?<link>([^<]+)<\/link>/i)?.[1];
  const info: FeedInfo = { url: url.href, title: title.slice(0, 80), site: siteMatch ? decode(siteMatch) : url.origin };
  return { info, stories: parseFeed(text, info.title, true).slice(0, 30) };
}

// `fresh` (pull to refresh) skips the 5-minute cache.
async function fetchText(url: string, fresh = false): Promise<string | null> {
  try {
    const res = await fetch(url, {
      ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: REVALIDATE } }),
      headers: { "user-agent": "Mozilla/5.0 (compatible; Stack/0.1; news reader)" },
      signal: AbortSignal.timeout(10000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function rss(feeds: Feed[], fresh = false): Promise<Story[]> {
  const lists = await Promise.all(
    feeds.map(async (f) => {
      const xml = await fetchText(f.url, fresh);
      return xml ? parseRss(xml, f.source).slice(0, 20) : [];
    }),
  );
  // Newest first, one copy of each link.
  const seen = new Set<string>();
  return lists
    .flat()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .filter((s) => !seen.has(s.url) && seen.add(s.url))
    .slice(0, 40);
}

// ---- Tech: Hacker News + dev.to ----

type HnHit = {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string;
  created_at: string;
  points: number | null;
  num_comments: number | null;
};

type DevtoArticle = {
  id: number;
  title: string;
  url: string;
  cover_image: string | null;
  social_image: string | null;
  description?: string;
  published_at: string;
  reading_time_minutes: number;
  positive_reactions_count: number;
  comments_count: number;
  user: { name: string };
};

type TechTopic = "tech" | "ai" | "dev";
const HN_QUERY: Record<TechTopic, string> = {
  tech: "tags=front_page&hitsPerPage=24",
  ai: "query=AI&tags=story&hitsPerPage=20",
  dev: "tags=show_hn&hitsPerPage=20",
};
const DEVTO_QUERY: Record<TechTopic, string> = {
  tech: "top=1&per_page=12",
  ai: "tag=ai&top=3&per_page=12",
  dev: "tag=webdev&top=3&per_page=12",
};

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

async function fetchJson<T>(url: string, fresh = false): Promise<T | null> {
  const text = await fetchText(url, fresh);
  try {
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

async function hackerNews(topic: TechTopic, fresh: boolean): Promise<Story[]> {
  // Topic searches only look at the last 7 days so results stay "news".
  const since = Math.floor(Date.now() / 1000) - 7 * 86400;
  const recent = topic === "tech" ? "" : `&numericFilters=created_at_i>${since}`;
  const data = await fetchJson<{ hits: HnHit[] }>(
    `https://hn.algolia.com/api/v1/search?${HN_QUERY[topic]}${recent}`,
    fresh,
  );
  return (data?.hits ?? [])
    .filter((h) => h.title)
    .map((h) => ({
      id: `hn-${h.objectID}`,
      source: "Hacker News",
      title: h.title!,
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      domain: h.url ? domainOf(h.url) : "news.ycombinator.com",
      author: h.author,
      createdAt: h.created_at,
      points: h.points ?? 0,
      comments: h.num_comments ?? 0,
    }))
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
}

async function devto(topic: TechTopic, fresh: boolean): Promise<Story[]> {
  const data = await fetchJson<DevtoArticle[]>(
    `https://dev.to/api/articles?${DEVTO_QUERY[topic]}`,
    fresh,
  );
  return (data ?? []).map((a) => ({
    id: `devto-${a.id}`,
    source: "dev.to",
    title: a.title,
    url: a.url,
    domain: "dev.to",
    image: a.cover_image ?? a.social_image ?? undefined,
    summary: a.description || undefined,
    author: a.user?.name,
    createdAt: a.published_at,
    readMinutes: a.reading_time_minutes,
    points: a.positive_reactions_count,
    comments: a.comments_count,
  }));
}

async function tech(topic: TechTopic, fresh: boolean) {
  const [hn, dev] = await Promise.all([hackerNews(topic, fresh), devto(topic, fresh)]);
  // Interleave two HN stories per dev.to post so both sources show up.
  const out: Story[] = [];
  let i = 0;
  let j = 0;
  while (i < hn.length || j < dev.length) {
    if (i < hn.length) out.push(hn[i++]);
    if (i < hn.length) out.push(hn[i++]);
    if (j < dev.length) out.push(dev[j++]);
  }
  return out;
}

export async function getNews(topic: Topic, fresh = false): Promise<Story[]> {
  if (topic === "mine") return []; // your own feeds are read on the device (lib/feeds.ts)
  if (topic === "tech" || topic === "ai" || topic === "dev") return tech(topic, fresh);
  return rss(FEEDS[topic] ?? [], fresh);
}
