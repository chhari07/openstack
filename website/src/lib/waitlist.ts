import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firestore";

export type Signup = {
  email: string;
  name: string;
  tester: boolean;
};

export type FieldErrors = Partial<Record<"email" | "name" | "consent", string>>;

// Deliberately simple: one @, a dot in the domain, no spaces. The real check
// is that we email them; this only catches typos and junk.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Letters (any language), spaces and a few name characters. No < > or quotes,
// so a name can never carry markup into an email or an admin screen.
const NAME = /^[\p{L}\p{M} .'-]*$/u;

// Checks the raw form on the server. The browser's `required` and
// `type="email"` are only for convenience; anyone can post anything here.
export function parseSignup(form: FormData): { ok: true; data: Signup } | { ok: false; errors: FieldErrors } {
  const email = text(form.get("email")).toLowerCase();
  const name = text(form.get("name")).replace(/\s+/g, " ");
  const errors: FieldErrors = {};

  if (!email) errors.email = "Enter your email address.";
  else if (email.length > 254 || !EMAIL.test(email)) errors.email = "That email address doesn’t look right.";

  if (name.length > 60) errors.name = "Keep your name under 60 characters.";
  else if (!NAME.test(name)) errors.name = "Use letters and spaces only.";

  if (form.get("consent") !== "yes") errors.consent = "Tick the box so we can email you.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, data: { email, name, tester: form.get("tester") === "yes" } };
}

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim().slice(0, 300) : "";
}

// One-way hash with a server-side salt. Used for document ids and the rate
// limiter, so we never store a raw IP address and ids don't reveal emails.
function hash(value: string): string {
  const salt = process.env.WAITLIST_SALT;
  if (!salt) throw new Error("WAITLIST_SALT is not set");
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

const LIMIT = 5; // sign-ups per IP address...
const WINDOW_MS = 60 * 60 * 1000; // ...per hour

export type SaveResult = "saved" | "limited" | "closed";

// Saves a sign-up. Signing up twice is not an error and looks exactly the same
// to the visitor, so the form can't be used to find out who is on the list.
export async function saveSignup(data: Signup, ip: string): Promise<SaveResult> {
  const firestore = db();
  if (!firestore || !process.env.WAITLIST_SALT) return "closed";

  // The counter lives in Firestore, not in memory: serverless instances come
  // and go, so an in-memory limit would reset on every cold start.
  const limitRef = firestore.collection("waitlist_limits").doc(hash(`ip:${ip}`));
  const allowed = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(limitRef);
    const now = Date.now();
    const start = snap.get("windowStart") as number | undefined;
    const count = snap.get("count") as number | undefined;
    if (start && now - start < WINDOW_MS) {
      if ((count ?? 0) >= LIMIT) return false;
      tx.update(limitRef, { count: FieldValue.increment(1) });
    } else {
      tx.set(limitRef, { windowStart: now, count: 1 });
    }
    return true;
  });
  if (!allowed) return "limited";

  try {
    await firestore
      .collection("waitlist")
      .doc(hash(`email:${data.email}`))
      .create({ ...data, source: "website", createdAt: FieldValue.serverTimestamp() });
  } catch (err) {
    // 6 = ALREADY_EXISTS: they're already on the list, which is fine.
    if ((err as { code?: number }).code !== 6) throw err;
  }
  return "saved";
}
