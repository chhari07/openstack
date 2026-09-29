import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Server-side Firestore with a service account. The admin SDK skips security
// rules, so it must never be imported by client code ("server-only" makes the
// build fail if it is). Returns null when the keys aren't set, so the form
// can say "not open yet" instead of crashing.
export function db(): Firestore | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Hosting dashboards store the key on one line with literal "\n"s.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;

  const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return getFirestore(app);
}
