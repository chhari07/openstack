"use client";

// Stack AI on the device: sends a task to /api/ai (the website's server, which
// holds the Claude key) with your sign-in, and reads the answer as it streams.
// The Android app points at NEXT_PUBLIC_AI_URL (the deployed site, or the
// laptop's dev server at http://10.0.2.2:3000 in the emulator).
import { cloud, cloudConfigured } from "./cloud";
import { isNative } from "./platform";

export type Cite = { page?: number; source?: string; title?: string; cited: string };
export type AnswerBlock = { text: string; cites: Cite[] };
export type Answer = { blocks: AnswerBlock[]; cut?: boolean };
export type AiTask =
  | { task: "summary"; title: string; text: string }
  | { task: "tidy"; text: string }
  | { task: "ask"; question: string; sources: { id: string; title: string; text: string }[] }
  | { task: "pdf"; title: string; pdf: string; question: string; history: { q: string; a: string }[] };

export class AiError extends Error {
  constructor(
    public code: "signin" | "setup" | "limit" | "refusal" | "offline" | "bad" | "api",
    message: string,
  ) {
    super(message);
  }
}

const endpoint = () => `${isNative() ? (process.env.NEXT_PUBLIC_AI_URL ?? "") : ""}/api/ai`;

// AI needs an account (to keep the shared key safe) and, in the app, a server address.
export const aiAvailable = () => cloudConfigured() && (!isNative() || !!process.env.NEXT_PUBLIC_AI_URL);

export async function runAi(body: AiTask, onText?: (textSoFar: string) => void, signal?: AbortSignal): Promise<Answer> {
  const user = cloud()?.auth.currentUser;
  if (!user) throw new AiError("signin", "Sign in to use Stack AI.");
  const token = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch(endpoint(), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (signal?.aborted) throw new AiError("bad", "Stopped.");
    throw new AiError("offline", "Couldn’t reach Stack AI. Check your connection.");
  }

  let text = "";
  let answer: Answer | null = null;
  let error: AiError | null = null;
  const onLine = (line: string) => {
    if (!line.trim()) return;
    let m: { t: string; v?: string; code?: AiError["code"]; blocks?: AnswerBlock[]; cut?: boolean };
    try {
      m = JSON.parse(line);
    } catch {
      return;
    }
    if (m.t === "text") onText?.((text += m.v ?? ""));
    else if (m.t === "reset") onText?.((text = ""));
    else if (m.t === "done") answer = { blocks: m.blocks ?? [], cut: m.cut };
    else if (m.t === "error") error = new AiError(m.code ?? "api", m.v ?? "Something went wrong.");
  };

  // Stream line by line where the platform allows it (the website); otherwise
  // the whole answer arrives at once.
  if (res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      lines.forEach(onLine);
    }
    onLine(buf);
  } else {
    (await res.text()).split("\n").forEach(onLine);
  }
  if (error) throw error;
  if (!answer) throw new AiError("api", res.ok ? "The answer was cut off. Try again." : `Stack AI error ${res.status}.`);
  return answer;
}

// Who answers, for the "ask first" sheet (set with the server's AI_PROVIDER).
export const AI_ENGINE = process.env.NEXT_PUBLIC_AI_ENGINE || "an AI service";

export const answerText = (a: Answer) => a.blocks.map((b) => b.text).join("").trim();

// ---- Asking first ----
// Each kind of AI feature asks once before sending anything to Claude.
const CONSENT = "stack.ai.ok";
export function aiConsented(kind: string) {
  try {
    return (JSON.parse(localStorage.getItem(CONSENT) ?? "[]") as string[]).includes(kind);
  } catch {
    return false;
  }
}
export function setAiConsent(kind: string) {
  try {
    const all = JSON.parse(localStorage.getItem(CONSENT) ?? "[]") as string[];
    localStorage.setItem(CONSENT, JSON.stringify([...new Set([...all, kind])]));
  } catch {}
}

// Base64 of a PDF blob for the "pdf" task.
export const blobBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
