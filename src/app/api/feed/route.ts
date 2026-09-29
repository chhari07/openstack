import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { readFeed } from "@/lib/news";

// Reads a feed for the website's "My feeds". The address comes from the
// visitor, so only public http(s) hosts are fetched (no local or private
// addresses, checked again on every redirect), with a size and time limit.

const MAX_BYTES = 2_000_000;

function privateIp(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return privateIp(v.slice(7));
    return v === "::1" || v === "::" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  );
}

async function publicUrl(raw: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return null;
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) return null;
  return url;
}

async function getText(raw: string, fresh: boolean): Promise<string | null> {
  let next = raw;
  for (let hop = 0; hop < 4; hop++) {
    const url = await publicUrl(next);
    if (!url) return null;
    const res = await fetch(url, {
      redirect: "manual",
      ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 600 } }),
      headers: { "user-agent": "Mozilla/5.0 (compatible; Stack/0.1; feed reader)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8" },
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    if (!res) return null;
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      next = new URL(res.headers.get("location")!, url).href;
      continue;
    }
    if (!res.ok || !res.body) return null;
    // Stop reading past the size limit.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
  return null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const url = params.get("url") ?? "";
  const fresh = params.get("fresh") === "1";
  if (!url || url.length > 2000) return Response.json({ error: "bad url" }, { status: 400 });
  const found = await readFeed(url, (u) => getText(u, fresh));
  if (!found) return Response.json({ error: "no feed" }, { status: 404 });
  return Response.json(found, {
    headers: { "cache-control": fresh ? "no-store" : "public, s-maxage=600, stale-while-revalidate=1200" },
  });
}
