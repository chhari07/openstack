"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User as CloudUser } from "@supabase/supabase-js";
import { cloud, cloudConfigured, deleteAccount as deleteCloudAccount } from "@/lib/cloud";
import { getProfile, saveProfile } from "@/lib/profile";
import { squareJpeg } from "@/lib/image";
import { onChange } from "@/lib/sync-state";
import {
  signOutAndStop,
  syncNow,
  syncStatus,
  uploadEverything,
  watchSync,
  type SyncStatus,
} from "@/lib/sync";

type User = { id: string; email?: string; name?: string; picture?: string };

// Google puts the name and photo in the account's metadata.
const toUser = (u: CloudUser): User => {
  const meta = u.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
  return {
    id: u.id,
    email: u.email ?? undefined,
    name: meta.full_name ?? meta.name,
    picture: meta.avatar_url ?? meta.picture,
  };
};

// A new Google sign-in: use the Google name and photo, unless the person
// already set their own (here or on another device).
async function fillProfileFrom(user: User) {
  const profile = await getProfile();
  const patch: { name?: string; avatar?: string } = {};
  if (!profile.name && user.name) patch.name = user.name;
  if (!profile.avatar && user.picture) {
    try {
      const res = await fetch(user.picture);
      if (res.ok) patch.avatar = await squareJpeg(await res.blob(), 384);
    } catch {
      /* no photo: initials instead */
    }
  }
  if (patch.name || patch.avatar) await saveProfile(patch);
}

type Ctx = {
  configured: boolean;
  ready: boolean; // the saved session has been checked
  user: User | null;
  sync: SyncStatus;
  syncNow: () => Promise<void>;
  // Resolves to the number of changes that couldn't be uploaded; with
  // removeFromDevice (and not force) nothing is signed out if that isn't 0.
  signOut: (removeFromDevice: boolean, force?: boolean) => Promise<{ unsynced: number }>;
  // Deletes the account and everything in it, then Stack's data on this device.
  deleteAccount: (password?: string) => Promise<void>;
};

const AccountCtx = createContext<Ctx | null>(null);

export function useAccount() {
  const ctx = useContext(AccountCtx);
  if (!ctx) throw new Error("useAccount outside AccountProvider");
  return ctx;
}

// Which account this device last synced with; a different one uploads
// everything on the device again.
const OWNER_KEY = "stack.sync.owner";

export function AccountProvider({ children }: { children: ReactNode }) {
  const configured = cloudConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!configured);
  const [sync, setSync] = useState<SyncStatus>(syncStatus());

  // Supabase restores the saved session, then reports every sign-in / sign-out.
  useEffect(() => {
    const c = cloud();
    if (!c) return;
    const { data } = c.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser((prev) => (u ? (prev?.id === u.id ? prev : toUser(u)) : null));
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => watchSync(setSync), []);

  // Signed in: sync now, soon after every change, and when Stack comes back.
  const uid = user?.id;
  useEffect(() => {
    if (!uid) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => syncNow(), 2500);
    };
    (async () => {
      try {
        if (localStorage.getItem(OWNER_KEY) !== uid) {
          await uploadEverything();
          localStorage.setItem(OWNER_KEY, uid);
        }
      } catch {
        /* storage blocked: sync what's marked */
      }
      // Download the account's profile first, then fill any gaps from Google.
      await syncNow();
      if (user) await fillProfileFrom(user).catch(() => {});
    })();
    onChange(soon);
    const onVisible = () => document.visibilityState === "visible" && syncNow();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", soon);
    const every = setInterval(() => syncNow(), 5 * 60_000);
    return () => {
      clearTimeout(timer);
      clearInterval(every);
      onChange(null);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", soon);
    };
    // Runs per account; the name/photo come from that same sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const signOut = useCallback(async (removeFromDevice: boolean, force = false) => {
    const { unsynced, signedOut } = await signOutAndStop(removeFromDevice, force);
    if (!signedOut) return { unsynced };
    setUser(null);
    if (removeFromDevice) {
      try {
        localStorage.removeItem(OWNER_KEY);
      } catch {
        /* ignore */
      }
    }
    return { unsynced };
  }, []);

  const deleteAccount = useCallback(async (password?: string) => {
    await deleteCloudAccount(password);
    await signOutAndStop(true, true); // stops any sync, then clears this device
    setUser(null);
    try {
      localStorage.removeItem(OWNER_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <AccountCtx.Provider value={{ configured, ready, user, sync, syncNow, signOut, deleteAccount }}>
      {children}
    </AccountCtx.Provider>
  );
}
