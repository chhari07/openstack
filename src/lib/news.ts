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
  | "health";

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

// A small RSS 2.0 reader, good enough for the known feeds above.
function parseRss(xml: string, source: string): Story[] {
  const out: Story[] = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const item = m[0];
    const title = tag(item, "title");
    const link = tag(item, "link");
    if (!title || !link || !isNewsHost(link)) continue;
    const url = link.replace(/[?#].*$/, (q) => (q.includes("at_medium=RSS") || q.includes("traffic_source") ? "" : q));
    const date = tag(item, "pubDate");
    const summary = stripTags(tag(item, "description") ?? "");
    out.push({
      id: webId(url),
      source,
      title: stripTags(title),
      url,
      domain: new URL(url).hostname.replace(/^www\./, ""),
      image: mediaUrl(item),
      summary: summary.length > 20 ? summary.slice(0, 280) : undefined,
      createdAt: date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : new Date().toISOString(),
    });
  }
  return out;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE },
      headers: { "user-agent": "Mozilla/5.0 (compatible; Stack/0.1; news reader)" },
      signal: AbortSignal.timeout(10000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function rss(feeds: Feed[]): Promise<Story[]> {
  const lists = await Promise.all(
    feeds.map(async (f) => {
      const xml = await fetchText(f.url);
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

async function fetchJson<T>(url: string): Promise<T | null> {
  const text = await fetchText(url);
  try {
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

async function hackerNews(topic: TechTopic): Promise<Story[]> {
  // Topic searches only look at the last 7 days so results stay "news".
  const since = Math.floor(Date.now() / 1000) - 7 * 86400;
  const recent = topic === "tech" ? "" : `&numericFilters=created_at_i>${since}`;
  const data = await fetchJson<{ hits: HnHit[] }>(
    `https://hn.algolia.com/api/v1/search?${HN_QUERY[topic]}${recent}`,
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

async function devto(topic: TechTopic): Promise<Story[]> {
  const data = await fetchJson<DevtoArticle[]>(`https://dev.to/api/articles?${DEVTO_QUERY[topic]}`);
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

async function tech(topic: TechTopic) {
  const [hn, dev] = await Promise.all([hackerNews(topic), devto(topic)]);
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

export async function getNews(topic: Topic): Promise<Story[]> {
  if (topic === "tech" || topic === "ai" || topic === "dev") return tech(topic);
  return rss(FEEDS[topic] ?? []);
}
