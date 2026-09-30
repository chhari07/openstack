"use client";

// Import PDFs from Telegram through your own bot (made with @BotFather):
// forward PDFs to the bot, then pick which ones to add to the Library.
// Stack talks to Telegram's Bot API straight from the device; the bot token
// stays on this device (never synced or put in backups).
import { get, set, del } from "idb-keyval";

const KEY = "stack.telegram";
const DOCS = "telegram:docs";
const API = "https://api.telegram.org";
export const MAX_BYTES = 20 * 1024 * 1024; // the Bot API's download limit

export type TelegramBot = { token: string; username: string; name: string };
export type TelegramPdf = {
  id: string; // file_unique_id
  fileId: string;
  name: string;
  size: number;
  date: number; // ms
  from: string; // where it came from: the chat or channel it was forwarded from
  imported?: boolean;
};

export class TelegramError extends Error {
  constructor(
    public code: "token" | "network" | "webhook" | "big" | "api",
    message: string,
  ) {
    super(message);
  }
}

export function getBot(): TelegramBot | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

export const looksLikeToken = (t: string) => /^\d{5,}:[\w-]{30,}$/.test(t.trim());

async function call<T>(token: string, method: string, params?: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params ?? {}),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new TelegramError("network", "Couldn’t reach Telegram. Check your connection.");
  }
  const data = (await res.json().catch(() => null)) as { ok: boolean; result: T; description?: string; error_code?: number } | null;
  if (data?.ok) return data.result;
  if (data?.error_code === 401 || data?.error_code === 404) throw new TelegramError("token", "Telegram didn’t accept that token. Copy it again from @BotFather.");
  if (data?.error_code === 409) throw new TelegramError("webhook", "This bot is already used by another service (it has a webhook). Make a new bot for Stack.");
  throw new TelegramError("api", data?.description ?? `Telegram error ${res.status}`);
}

/** Checks the token and remembers the bot. */
export async function connect(token: string): Promise<TelegramBot> {
  const t = token.trim();
  if (!looksLikeToken(t)) throw new TelegramError("token", "That doesn’t look like a bot token (it’s like 123456789:AA…).");
  const me = await call<{ username: string; first_name: string }>(t, "getMe");
  const bot = { token: t, username: me.username, name: me.first_name };
  try {
    localStorage.setItem(KEY, JSON.stringify(bot));
  } catch {}
  return bot;
}

export async function disconnect() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  await del(DOCS);
}

export const getPdfList = async () => (await get<TelegramPdf[]>(DOCS)) ?? [];

type Message = {
  message_id: number;
  date: number;
  chat: { id: number; title?: string; first_name?: string };
  text?: string;
  document?: { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; file_size?: number };
  forward_origin?: { type: string; chat?: { title?: string }; sender_user?: { first_name?: string }; sender_user_name?: string };
  forward_from_chat?: { title?: string };
};
type Update = { update_id: number; message?: Message; channel_post?: Message };

const origin = (m: Message) =>
  m.forward_origin?.chat?.title ??
  m.forward_from_chat?.title ??
  m.forward_origin?.sender_user?.first_name ??
  m.forward_origin?.sender_user_name ??
  m.chat.title ??
  "Sent to the bot";

/**
 * Collects PDFs sent to the bot since the last check. Telegram only keeps
 * them for a day, so they're remembered on this device; the list is newest first.
 */
export async function checkForPdfs(bot: TelegramBot): Promise<TelegramPdf[]> {
  const list = await getPdfList();
  const known = new Set(list.map((d) => d.id));
  let offset = 0;
  let replied = false;
  for (let round = 0; round < 10; round++) {
    const updates = await call<Update[]>(bot.token, "getUpdates", {
      offset,
      timeout: 0,
      allowed_updates: ["message", "channel_post"],
    });
    if (!updates.length) break;
    for (const u of updates) {
      const m = u.message ?? u.channel_post;
      if (!m) continue;
      const d = m.document;
      const isPdf = d && (d.mime_type === "application/pdf" || /\.pdf$/i.test(d.file_name ?? ""));
      if (d && isPdf && !known.has(d.file_unique_id)) {
        known.add(d.file_unique_id);
        list.push({
          id: d.file_unique_id,
          fileId: d.file_id,
          name: d.file_name ?? "Telegram PDF.pdf",
          size: d.file_size ?? 0,
          date: m.date * 1000,
          from: origin(m),
        });
      }
      // A short "how to" when someone opens the bot, once per check.
      if (m.text?.startsWith("/start") && !replied) {
        replied = true;
        call(bot.token, "sendMessage", {
          chat_id: m.chat.id,
          text: "Hi! Forward PDFs to this chat, then open Stack → Library → Import from Telegram and pick the ones you want.",
        }).catch(() => {});
      }
    }
    // Confirms these updates so the next check only gets new ones.
    offset = updates[updates.length - 1].update_id + 1;
  }
  if (offset) await call(bot.token, "getUpdates", { offset, timeout: 0 }).catch(() => {});
  list.sort((a, b) => b.date - a.date);
  await set(DOCS, list);
  return list;
}

/** Downloads one PDF (up to 20 MB, the Bot API's limit). */
export async function downloadPdf(bot: TelegramBot, doc: TelegramPdf, onProgress?: (fraction: number) => void): Promise<File> {
  if (doc.size > MAX_BYTES) throw new TelegramError("big", "Over 20 MB: Telegram bots can’t download files this big.");
  const f = await call<{ file_path?: string }>(bot.token, "getFile", { file_id: doc.fileId });
  if (!f.file_path) throw new TelegramError("api", "Telegram didn’t return the file.");
  const res = await fetch(`${API}/file/bot${bot.token}/${f.file_path}`).catch(() => null);
  if (!res?.ok) throw new TelegramError("network", "The download didn’t finish. Try again.");
  let blob: Blob;
  const total = Number(res.headers.get("content-length")) || doc.size;
  if (res.body && onProgress && total) {
    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      got += value.length;
      onProgress(Math.min(1, got / total));
    }
    blob = new Blob(parts as BlobPart[], { type: "application/pdf" });
  } else {
    blob = await res.blob();
  }
  return new File([blob], doc.name.endsWith(".pdf") ? doc.name : `${doc.name}.pdf`, { type: "application/pdf" });
}

export async function markImported(ids: string[]) {
  const list = await getPdfList();
  await set(
    DOCS,
    list.map((d) => (ids.includes(d.id) ? { ...d, imported: true } : d)),
  );
}
