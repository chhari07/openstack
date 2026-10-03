# Stack accounts, sync and AI (Supabase)

Stack works without this: everything stays on the device. With it, people sign
in with **Google** (the same button creates the account), or with email and a
password, and their notes, saved articles, PDFs (the files too), playlists,
focus history and profile sync across their devices. Stack AI runs here as well.

Everything below fits Supabase's free plan and needs no card. One thing to
know: a free project is **paused after about a week with no activity**; open
the dashboard and press **Restore** to bring it back.

## 1. Create the project

1. https://supabase.com/dashboard → **New project** → name it "Stack", pick a
   region near your users (e.g. Mumbai), set a database password and keep it safe.
2. **Project settings → API** (or **Connect**): copy the **Project URL** and the
   **publishable key** into `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   (An older project's `anon` key, `eyJ...`, works too, under this name or as
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.)

   These two are meant to be public (they ship inside the app). The security
   rules in step 2 are what keep each person's data private. **Never** put the
   `service_role` / secret key in the app or in a `NEXT_PUBLIC_` variable.

## 2. Database, PDF bucket and security rules

**SQL Editor → New query** → paste all of [`schema.sql`](schema.sql) → **Run**.

It creates the `items` table (one row per synced item), the `pdfs` bucket
(private, PDFs only, 50 MB each), the rules that let each person touch only
their own rows and files, the Stack AI daily counter and "delete my account".
It's safe to run again after an update.

## 3. Sign-in

### Google

Android's account picker gives Stack a Google ID token, and Supabase accepts
it if it knows the client ID it was made for.

1. **Google Cloud Console → APIs & Services → Credentials** (the same Google
   project as before, if you had one):
   - an **OAuth client ID → Web application**. Its client ID is
     `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env.local`.
   - an **OAuth client ID → Android**: package `com.chhari.stack`, **SHA-1**
     `A6:E5:F8:21:58:C9:50:71:92:5C:1F:FD:47:4A:15:2D:F4:F3:8E:65` (the key that
     signs the debug APKs `./build-apk.sh` makes on this laptop; a release key
     has its own SHA-1, add a client for it too when you have one).

   If these were created through Firebase, they still work: keep that Google
   project, and don't delete it.
2. **Supabase → Authentication → Sign In / Providers → Google** → enable →
   **Client IDs**: paste the **Web** client ID → Save. (The client secret is
   only needed for signing in from a browser with `npm run dev`; then also add
   `https://<project>.supabase.co/auth/v1/callback` to the Web client's
   redirect URIs in Google Cloud, and `http://127.0.0.1:3000/**` under
   Authentication → URL Configuration → Redirect URLs.)

### Email and password

1. **Authentication → Sign In / Providers → Email** → enabled. Turn **Confirm
   email off** so a new account is signed in straight away (with it on, people
   must open a link in an email first, and that link has no page to land on in
   an app-only setup).
2. **Authentication → Emails → Reset password**: the app asks for a **code**,
   not a link, so the email has to show it. Replace the body with something like:

   ```html
   <h2>Reset your Stack password</h2>
   <p>Enter this code in Stack:</p>
   <h1>{{ .Token }}</h1>
   <p>If you didn't ask for this, ignore this email.</p>
   ```

Supabase's built-in email sender is for testing only (a few emails an hour).
Before a public launch, add your own SMTP under **Authentication → Emails → SMTP settings**.

## 4. Build the app

`./build-apk.sh` for the app (`npm run dev` for the browser version while
developing). The values are built into the APK, so rebuild after changing
`.env.local`.

## 5. Stack AI (optional)

AI runs in an Edge Function, [`functions/ai`](functions/ai/index.ts), so no AI
key is ever inside the app.

1. Deploy it. Either:
   - **CLI** (no Docker needed):
     ```
     npx supabase login
     npx supabase link --project-ref abcdefgh      # the id in your project URL
     npx supabase functions deploy ai --no-verify-jwt   # add --use-api if it asks for Docker
     ```
   - or the **dashboard**: Edge Functions → Deploy a new function → name it
     `ai` → paste `functions/ai/index.ts` → deploy, then in the function's
     settings turn **Verify JWT** off.

   (JWT checking at the gateway is off because the function checks the sign-in
   itself, which also works with Supabase's newer signing keys.)
2. Give it its secrets: **Edge Functions → Secrets**, or
   ```
   npx supabase secrets set AI_PROVIDER=openai OPENAI_API_KEY=sk-... AI_DAILY_LIMIT=20
   ```
   `AI_PROVIDER` is `openai` or `anthropic` (then `ANTHROPIC_API_KEY`). Models
   and the per-feature overrides are listed in [`.env.example`](../.env.example).
3. Tell the app where it is, in `.env.local`, and rebuild:
   ```
   NEXT_PUBLIC_AI_URL=https://abcdefgh.supabase.co/functions/v1/ai
   NEXT_PUBLIC_AI_ENGINE=OpenAI
   ```
   Leave `NEXT_PUBLIC_AI_URL` empty to hide AI in the app.

Each person gets `AI_DAILY_LIMIT` requests a day (default 50). The count is
kept in the database (`ai_usage`), so it holds across restarts and however
many copies of the function are running.

## How sync works

- Each item is one row in `items`: `(user_id, collection, key)`, with the item
  in `data`. The server gives every write the next `seq` number.
- Every change on the device is marked and uploaded a few seconds later (and
  when the app comes back, when the connection returns, and every 5 minutes).
  Then the device downloads the rows with a higher `seq` than the last one it
  has. A local change that isn't uploaded yet wins over the downloaded copy.
- Deletions stay as `deleted = true` rows so other devices remove the item too.
- A PDF's file goes to the `pdfs` bucket as `<user id>/<pdf id>.pdf` and is
  downloaded on another device the first time it's opened. A PDF over 50 MB
  stays on the device that added it (its title and cover still sync); the
  Account screen says so.
- The first time a device signs in, everything already on it is added to the account.
- "Delete my account" removes the person's files, rows and login.
- Every request has a time limit, and signing out never waits for a sync for
  more than a few seconds, so a stalled connection can't leave it stuck.

## Coming from the Firebase version

Accounts and data don't move by themselves. People sign in again (a Google
account gets a new Stack account in Supabase), and what's on their device is
uploaded to the new account on that first sign-in, so nothing local is lost.
Data that only existed in the old Firestore stays there until you delete it.
