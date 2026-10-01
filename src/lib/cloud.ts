"use client";

// Stack accounts on Supabase: "Continue with Google" (sign-in and sign-up in
// one), or email + password. Data sync is in lib/sync.ts (the `items` table
// and the `pdfs` bucket). Configure with the NEXT_PUBLIC_SUPABASE_* values (see
// supabase/README.md); without them Stack works as before, on this device only.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { registerPlugin } from "@capacitor/core";
import { isNative } from "./platform";

const PROJECT_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
// The "publishable" (older projects: "anon") key: meant to be public (it ships
// inside the app). The security rules in supabase/schema.sql are what keep each
// person's data private.
const PROJECT_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
// "Web client" OAuth ID: lets the Android app use the phone's account picker.
const GOOGLE_WEB_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

export const cloudConfigured = () => !!(PROJECT_URL && PROJECT_KEY);
export const cloudKey = () => PROJECT_KEY;

// Thrown when the person closes the Google picker: nothing to show.
export class SignInCancelled extends Error {}
// Google doesn't recognise this build of the app yet (its SHA-1 isn't
// registered with Google): the sign-in panel explains.
export class GoogleNotReady extends Error {}
// The project asks new accounts to confirm their email first (Supabase's
// "Confirm email" setting): the sign-in panel says so.
export class ConfirmEmail extends Error {}
// No connection (or one that stalled): nothing came back from the server.
export class CloudOffline extends Error {}

// The app's native HTTP has no time limit of its own: on a stalled connection
// a request would never end, and neither would the sync or sign-out waiting
// for it. So every request gets one.
export function within<T>(ms: number, work: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new CloudOffline("timed out")), ms);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
const API_LIMIT = 30_000;
const SIGN_OUT_LIMIT = 6_000; // telling the server is a courtesy: don't keep the person waiting
const timedFetch: typeof fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return within(url.includes("/auth/v1/logout") ? SIGN_OUT_LIMIT : API_LIMIT, fetch(input, init));
};

const SESSION_KEY = "stack.auth"; // where the sign-in is saved on this device
let client: SupabaseClient | null = null;
let current: User | null = null; // the signed-in person, once the saved session is restored

export function cloud(): SupabaseClient | null {
  if (!cloudConfigured()) return null;
  if (client) return client;
  client = createClient(PROJECT_URL, PROJECT_KEY, {
    // The website comes back from Google with the session in the address; the
    // app signs in with the native picker and never does.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !isNative(), storageKey: SESSION_KEY },
    global: { fetch: timedFetch },
  });
  client.auth.onAuthStateChange((_event, session) => {
    current = session?.user ?? null;
  });
  return client;
}

function need() {
  const c = cloud();
  if (!c) throw new Error("Accounts aren’t set up in this build of Stack.");
  return c;
}

// Who is signed in. Waits until the saved sign-in has been restored, and
// renews it when it's about to run out.
async function session() {
  const c = cloud();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session;
}
export const sessionUser = async () => (await session())?.user ?? null;
export const accessToken = async () => (await session())?.access_token ?? null;

const CODES: Record<string, string> = {
  invalid_credentials: "Wrong email or password.",
  email_not_confirmed: "Confirm your email first: open the link we sent you, then sign in.",
  user_already_exists: "That email already has an account. Sign in instead.",
  email_exists: "That email already has an account. Sign in instead.",
  email_address_invalid: "That doesn’t look like an email address.",
  weak_password: "Use a password of at least 6 characters.",
  same_password: "That’s your current password. Choose a different one.",
  otp_expired: "That code is wrong or has expired. Ask for a new one.",
  over_request_rate_limit: "Too many tries. Wait a minute and try again.",
  over_email_send_rate_limit: "Too many emails for now. Wait a few minutes and try again.",
  provider_disabled: "This sign-in method isn’t switched on in Supabase yet.",
  email_provider_disabled: "This sign-in method isn’t switched on in Supabase yet.",
  signup_disabled: "New accounts are switched off in Supabase.",
  user_mismatch: "That’s a different account. Pick the account you’re signed in with.",
};

export function explainAuth(e: unknown) {
  const err = e as { code?: string; name?: string; message?: string } | null;
  if (err?.name === "AuthRetryableFetchError") return "No connection. Check your internet and try again.";
  // Google's token was made for another client ID than the ones Supabase knows.
  if (/audience/i.test(err?.message ?? ""))
    return "Google sign-in isn’t set up in Supabase yet (add the Web client ID under Authentication → Providers → Google).";
  return CODES[err?.code ?? ""] ?? err?.message ?? String(e);
}

// Supabase answers { data, error } instead of throwing.
function check<R extends { data: unknown; error: unknown }>(res: R): R["data"] {
  if (res.error) throw res.error;
  return res.data;
}

type GoogleSignInPlugin = {
  signIn(opts: { serverClientId: string }): Promise<{ idToken: string; email?: string; name?: string }>;
};
const GoogleSignIn = registerPlugin<GoogleSignInPlugin>("GoogleSignIn");

// Android: the phone's own account picker gives a Google ID token.
async function pickGoogleAccount() {
  if (!GOOGLE_WEB_CLIENT_ID) throw new Error("Google sign-in isn’t set up in this build of Stack.");
  try {
    return await GoogleSignIn.signIn({ serverClientId: GOOGLE_WEB_CLIENT_ID });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "CANCELLED") throw new SignInCancelled();
    if (code === "NOT_REGISTERED") throw new GoogleNotReady((e as Error).message);
    throw e;
  }
}

// "Continue with Google" is both sign-in and sign-up: a Google account that
// hasn't used Stack before gets a new Stack account.
export async function signInWithGoogle() {
  const { auth } = need();
  if (isNative()) {
    const { idToken } = await pickGoogleAccount();
    check(await auth.signInWithIdToken({ provider: "google", token: idToken }));
    return;
  }
  // The website goes to Google and comes back to this page, signed in.
  check(
    await auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href, queryParams: { prompt: "select_account" } },
    }),
  );
  await new Promise(() => {}); // the page is leaving
}

export async function signInWithEmail(email: string, password: string) {
  check(await need().auth.signInWithPassword({ email: email.trim(), password }));
}

export async function signUpWithEmail(email: string, password: string) {
  const { session } = check(await need().auth.signUp({ email: email.trim(), password }));
  if (!session) throw new ConfirmEmail();
}

// "Forgot password": emails a 6-digit code (the "Reset password" email
// template has to include {{ .Token }}; see supabase/README.md).
export async function resetPassword(email: string) {
  check(await need().auth.resetPasswordForEmail(email.trim()));
}

// The code from that email signs the person in; then the new password is saved.
export async function setNewPassword(email: string, code: string, password: string) {
  const { auth } = need();
  check(await auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "recovery" }));
  check(await auth.updateUser({ password }));
}

// Signs out this device only; the person's other devices stay signed in.
// Always finishes: the saved sign-in is removed here even when the server
// can't be told, or the client is stuck behind another request.
export async function signOutCloud() {
  const c = cloud();
  if (!c) return;
  await within(SIGN_OUT_LIMIT + 4_000, c.auth.signOut({ scope: "local" })).catch(() => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage blocked: nothing saved to remove */
    }
  });
  current = null;
}

// How the signed-in person logs in: deleting an account asks them to confirm
// the same way first.
export function signInMethod(): "google" | "password" | null {
  if (!current) return null;
  const meta = current.app_metadata;
  const providers: unknown[] = meta.providers ?? [meta.provider];
  return providers.includes("google") ? "google" : "password";
}

// Deleting an account can't be undone, so confirm it's really them: the same
// Google account from the phone's picker, or the password.
async function confirmIdentity(user: User, password?: string) {
  if (signInMethod() === "google") {
    if (!isNative()) return; // the website signs in on Google's own page
    const picked = await pickGoogleAccount();
    if (!picked.email || picked.email.toLowerCase() !== user.email?.toLowerCase())
      throw Object.assign(new Error("user mismatch"), { code: "user_mismatch" });
    return;
  }
  if (!password) throw new Error("Enter your password.");
  check(await need().auth.signInWithPassword({ email: user.email ?? "", password }));
}

// ---- PDF files (Storage) ----
// pdfs/<user id>/<pdf id>.pdf. Uploads and deletes are plain requests with a
// File as the body: the app's native HTTP (CapacitorHttp) sends a File as it
// is, but not the form the Supabase client would wrap it in.
const BUCKET = "pdfs";
export const MAX_PDF_BYTES = 50 * 1024 * 1024; // the bucket's limit (supabase/schema.sql)
const pdfPath = (uid: string, id: string) => `${uid}/${id}.pdf`;

async function storageRequest(method: "POST" | "DELETE", path: string, body?: File) {
  const token = await accessToken();
  if (!token) throw new Error("You’re not signed in.");
  const headers: Record<string, string> = { authorization: `Bearer ${token}`, apikey: PROJECT_KEY };
  if (body) Object.assign(headers, { "content-type": "application/pdf", "x-upsert": "true" });
  // A file gets longer: a minute, plus a second for every 50 KB.
  const limit = body ? 60_000 + body.size / 50 : API_LIMIT;
  let res: Response;
  try {
    res = await within(limit, fetch(`${PROJECT_URL}/storage/v1/object/${BUCKET}/${path}`, { method, headers, body }));
  } catch {
    throw new CloudOffline();
  }
  if (res.ok) return { ok: true, status: res.status, message: "" };
  // Storage puts its own status in the answer ({ statusCode: "404", message }).
  const said = (await res.json().catch(() => null)) as { statusCode?: string; message?: string } | null;
  return { ok: false, status: Number(said?.statusCode) || res.status, message: said?.message ?? `error ${res.status}` };
}

export async function uploadPdf(uid: string, id: string, blob: Blob) {
  const file = new File([blob], `${id}.pdf`, { type: "application/pdf" });
  const res = await storageRequest("POST", pdfPath(uid, id), file);
  if (!res.ok) throw new Error(res.message);
}

// A file that's already gone counts as removed.
async function removeFile(path: string) {
  const res = await storageRequest("DELETE", path);
  if (!res.ok && res.status !== 404) throw new Error(res.message);
}
export const removePdf = (uid: string, id: string) => removeFile(pdfPath(uid, id));

// A short-lived download link, then a normal fetch.
export async function fetchPdf(uid: string, id: string): Promise<Blob | null> {
  const c = cloud();
  if (!c) return null;
  const { data } = await c.storage.from(BUCKET).createSignedUrl(pdfPath(uid, id), 60);
  if (!data?.signedUrl) return null;
  const signedUrl = data.signedUrl;
  return within(10 * 60_000, (async () => {
    const res = await fetch(signedUrl);
    return res.ok ? await res.blob() : null;
  })());
}

// Deletes the account for good: the PDF files, every synced item and the
// login itself. (Removing Stack's data from this device is the caller's job.)
export async function deleteAccount(password?: string) {
  const c = need();
  const user = await sessionUser();
  if (!user) throw new Error("You’re not signed in.");
  await confirmIdentity(user, password);
  // 100 at a time until the folder is empty (the cap only guards against a loop).
  for (let page = 0; page < 500; page++) {
    const { data, error } = await c.storage.from(BUCKET).list(user.id, { limit: 100 });
    if (error && !/not found/i.test(error.message)) throw error;
    if (!data?.length) break;
    for (const f of data) await removeFile(`${user.id}/${f.name}`);
  }
  // The items go with the login (supabase/schema.sql: delete_account).
  const { error } = await c.rpc("delete_account");
  if (error) throw error;
  await signOutCloud();
}
