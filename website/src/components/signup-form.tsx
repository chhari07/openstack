"use client";

import { useActionState } from "react";
import Link from "next/link";
import { joinWaitlist, type JoinState } from "@/app/actions";

const initial: JoinState = { status: "idle", message: "" };

// Works without JavaScript too: the form posts to the Server Action and the
// page re-renders with the result.
export function SignupForm() {
  const [state, action, pending] = useActionState(joinWaitlist, initial);

  if (state.status === "done") {
    return (
      <div role="status" className="rounded-3xl bg-news-tint p-6 text-ink sm:p-8">
        <p className="label text-xs text-news-text">You’re in</p>
        <p className="mt-2 text-2xl font-bold tracking-tight">{state.message}</p>
        <p className="mt-3 text-muted">Invites go out in small groups, so it may take a few days.</p>
      </div>
    );
  }

  const err = state.errors ?? {};

  return (
    <form action={action} noValidate className="grid gap-5">
      <Field id="email" label="Email" error={err.email}>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          placeholder="you@gmail.com"
          defaultValue={state.values?.email}
          aria-invalid={!!err.email}
          aria-describedby={err.email ? "email-error" : "email-hint"}
          className={inputClass(!!err.email)}
        />
        {!err.email && (
          <p id="email-hint" className="mt-1.5 text-sm text-muted">
            For the Android test, use the Gmail address on your phone.
          </p>
        )}
      </Field>

      <Field id="name" label="First name (optional)" error={err.name}>
        <input
          id="name"
          name="name"
          type="text"
          maxLength={60}
          autoComplete="given-name"
          defaultValue={state.values?.name}
          aria-invalid={!!err.name}
          aria-describedby={err.name ? "name-error" : undefined}
          className={inputClass(!!err.name)}
        />
      </Field>

      {/* Hidden from people and screen readers; bots that fill it are ignored. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name="tester" value="yes" defaultChecked className="mt-1 size-5 accent-news" />
        <span>
          <span className="font-semibold">I have an Android phone and want to test the app</span>
          <span className="block text-sm text-muted">14 days, a few minutes a day. Leave it unticked for launch news only.</span>
        </span>
      </label>

      <div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="consent"
            value="yes"
            required
            aria-invalid={!!err.consent}
            aria-describedby={err.consent ? "consent-error" : undefined}
            className="mt-1 size-5 accent-news"
          />
          <span className="text-sm text-muted">
            Email me about Stack. You can ask us to delete your address at any time. See the{" "}
            <Link href="/privacy" className="text-ink underline underline-offset-2">
              privacy note
            </Link>
            .
          </span>
        </label>
        {err.consent && <FieldError id="consent-error">{err.consent}</FieldError>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="label h-14 rounded-full bg-ink px-8 text-sm font-medium text-on-ink transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join the soft launch"}
      </button>

      <p aria-live="polite" className="min-h-6 text-sm font-medium text-music-text">
        {state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label mb-2 block text-xs text-muted">
        {label}
      </label>
      {children}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-music-text">
      {children}
    </p>
  );
}

function inputClass(invalid: boolean) {
  return `h-14 w-full rounded-2xl border bg-card px-4 text-lg text-ink outline-none transition placeholder:text-muted/60 focus:border-ink ${
    invalid ? "border-music" : "border-rule"
  }`;
}
