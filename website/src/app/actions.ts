"use server";

import { headers } from "next/headers";
import { parseSignup, saveSignup, type FieldErrors } from "@/lib/waitlist";

export type JoinState = {
  status: "idle" | "done" | "error";
  message: string;
  errors?: FieldErrors;
  // What they typed, sent back so a failed submit doesn't clear the form.
  values?: { email: string; name: string };
};

// Every Server Action is a public POST endpoint, whether or not a page links
// to it. So this one trusts nothing from the browser: it validates the form
// itself, rate-limits by IP and only returns generic messages.
export async function joinWaitlist(_prev: JoinState, form: FormData): Promise<JoinState> {
  const values = { email: field(form, "email"), name: field(form, "name") };

  // Hidden "website" field: people never see it, simple bots fill it in.
  // Pretend it worked so the bot has nothing to learn from.
  if (field(form, "website")) return done();

  const parsed = parseSignup(form);
  if (!parsed.ok) {
    return { status: "error", message: "Please fix the highlighted fields.", errors: parsed.errors, values };
  }

  const h = await headers();
  // Vercel sets x-forwarded-for itself; the first entry is the visitor.
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";

  try {
    const result = await saveSignup(parsed.data, ip);
    if (result === "limited") {
      return { status: "error", message: "Too many tries from your network. Try again in an hour.", values };
    }
    if (result === "closed") {
      return { status: "error", message: "Sign-ups open very soon. Please check back in a day or two.", values };
    }
    return done();
  } catch (err) {
    // Log the failure, never the email or the IP.
    console.error("waitlist: save failed", err instanceof Error ? err.message : "unknown error");
    return { status: "error", message: "Something went wrong on our side. Please try again.", values };
  }
}

function done(): JoinState {
  return { status: "done", message: "You’re on the list. We’ll email you when your invite is ready." };
}

function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.slice(0, 300) : "";
}
