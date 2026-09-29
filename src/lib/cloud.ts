"use client";

// Stack accounts on Firebase: "Continue with Google" (sign-in and sign-up in
// one), or email + password. Data sync is in lib/sync.ts (Firestore and
// Storage). Configure with the NEXT_PUBLIC_FIREBASE_* values (see
// firebase/README.md); without them Stack works as before, on this device only.
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
} from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  getDocs,
  initializeFirestore,
  limit,
  query,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { connectStorageEmulator, deleteObject, getStorage, listAll, ref, type FirebaseStorage } from "firebase/storage";
import { registerPlugin } from "@capacitor/core";
import { isNative } from "./platform";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};
// Local testing only: talk to the Firebase emulators on this host.
const EMULATOR_HOST = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR ?? "";
// "Web client" OAuth ID: lets the Android app use the phone's account picker.
const GOOGLE_WEB_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

export const cloudConfigured = () => !!(config.apiKey && config.projectId && config.appId);
// PDF files need Cloud Storage (Firebase's Blaze plan); without a bucket only
// the PDF's details and cover sync.
export const filesConfigured = () => cloudConfigured() && !!config.storageBucket;

type Cloud = { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage | null };
let cloudRef: Cloud | null = null;

export function cloud(): Cloud | null {
  if (!cloudConfigured()) return null;
  if (cloudRef) return cloudRef;
  const app = getApps()[0] ?? initializeApp(config);
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    // Pop-ups are for the website; the app signs in with the native picker.
    popupRedirectResolver: isNative() ? undefined : browserPopupRedirectResolver,
  });
  const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    // The app sends requests through Android's HTTP stack (CapacitorHttp),
    // which can't stream; plain long-polling requests work through it.
    experimentalForceLongPolling: isNative(),
  });
  const storage = filesConfigured() ? getStorage(app) : null;
  if (EMULATOR_HOST) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
    if (storage) connectStorageEmulator(storage, EMULATOR_HOST, 9199);
  }
  cloudRef = { app, auth, db, storage };
  return cloudRef;
}

function need() {
  const c = cloud();
  if (!c) throw new Error("Accounts aren’t set up in this build of Stack.");
  return c;
}

// Thrown when the person closes the Google picker or pop-up: nothing to show.
export class SignInCancelled extends Error {}
// Google doesn't recognise this build of the app yet (its SHA-1 isn't
// registered in the Firebase project): the sign-in panel explains.
export class GoogleNotReady extends Error {}

const CODES: Record<string, string> = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/wrong-password": "Wrong email or password.",
  "auth/user-not-found": "Wrong email or password.",
  "auth/invalid-email": "That doesn’t look like an email address.",
  "auth/email-already-in-use": "That email already has an account. Sign in instead.",
  "auth/weak-password": "Use a password of at least 6 characters.",
  "auth/missing-password": "Enter your password.",
  "auth/too-many-requests": "Too many tries. Wait a minute and try again.",
  "auth/network-request-failed": "No connection. Check your internet and try again.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups and try again.",
  "auth/account-exists-with-different-credential": "This email signs in another way. Try Continue with Google.",
  "auth/operation-not-allowed": "This sign-in method isn’t switched on in Firebase yet.",
  "auth/unauthorized-domain": "This website isn’t on Firebase’s list of authorised domains.",
  "auth/requires-recent-login": "For safety, confirm it’s you again, then try once more.",
  "auth/user-mismatch": "That’s a different account. Pick the account you’re signed in with.",
};

export function explainAuth(e: unknown) {
  const code = (e as { code?: string })?.code ?? "";
  return CODES[code] ?? (e as Error)?.message ?? String(e);
}

const cancelled = (e: unknown) =>
  ["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled", "CANCELLED"].includes(
    (e as { code?: string })?.code ?? "",
  );

type GoogleSignInPlugin = {
  signIn(opts: { serverClientId: string }): Promise<{ idToken: string; email?: string; name?: string }>;
};
const GoogleSignIn = registerPlugin<GoogleSignInPlugin>("GoogleSignIn");

// "Continue with Google" is both sign-in and sign-up: a Google account that
// hasn't used Stack before gets a new Stack account.
export async function signInWithGoogle() {
  const { auth } = need();
  try {
    if (isNative()) {
      // Android: the phone's own account picker gives a Google ID token.
      if (!GOOGLE_WEB_CLIENT_ID) throw new Error("Google sign-in isn’t set up in this build of Stack.");
      const { idToken } = await GoogleSignIn.signIn({ serverClientId: GOOGLE_WEB_CLIENT_ID }).catch((e) => {
        if ((e as { code?: string }).code === "NOT_REGISTERED") throw new GoogleNotReady(e.message);
        throw e;
      });
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    } else {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    }
  } catch (e) {
    if (cancelled(e)) throw new SignInCancelled();
    throw e;
  }
}

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(need().auth, email.trim(), password);
}

export async function signUpWithEmail(email: string, password: string) {
  await createUserWithEmailAndPassword(need().auth, email.trim(), password);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(need().auth, email.trim());
}

export async function signOutCloud() {
  const c = cloud();
  if (c) await signOut(c.auth);
}

// How the signed-in person logs in: deleting an account asks them to confirm
// the same way first.
export function signInMethod(): "google" | "password" | null {
  const u = cloud()?.auth.currentUser;
  if (!u) return null;
  return u.providerData.some((p) => p.providerId === "google.com") ? "google" : "password";
}

// Firebase only deletes an account that signed in moments ago, so confirm
// with Google (the same account) or the password first.
async function confirmIdentity(password?: string) {
  const { auth } = need();
  const user = auth.currentUser;
  if (!user) throw new Error("You’re not signed in.");
  try {
    if (signInMethod() === "google") {
      if (isNative()) {
        if (!GOOGLE_WEB_CLIENT_ID) throw new Error("Google sign-in isn’t set up in this build of Stack.");
        const { idToken } = await GoogleSignIn.signIn({ serverClientId: GOOGLE_WEB_CLIENT_ID });
        await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
      } else {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      }
    } else {
      if (!password) throw new Error("Enter your password.");
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? "", password));
    }
  } catch (e) {
    if (cancelled(e)) throw new SignInCancelled();
    throw e;
  }
}

// Deletes the account for good: every synced item, the PDF files and the
// login itself. (Removing Stack's data from this device is the caller's job.)
export async function deleteAccount(password?: string) {
  await confirmIdentity(password);
  const { auth, db, storage } = need();
  const user = auth.currentUser!;
  if (storage) {
    const files = await listAll(ref(storage, `users/${user.uid}/pdfs`)).catch(() => null);
    for (const f of files?.items ?? []) await deleteObject(f).catch(() => {});
  }
  const items = collection(db, "users", user.uid, "items");
  for (;;) {
    const page = await getDocs(query(items, limit(400)));
    if (page.empty) break;
    const batch = writeBatch(db);
    page.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteUser(user);
}
