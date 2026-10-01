# Stack website (soft launch)

The landing page for Stack's soft launch: what Stack is, real app screenshots, and a sign-up
list for the Google Play closed test (12+ testers × 14 days, see `docs/Stack_Launch_Guide.pdf`).
Same palette, fonts and logo as the app.

```bash
npm install
cp .env.example .env.local   # fill in the Firebase service account + WAITLIST_SALT
npm run dev                  # http://127.0.0.1:3000
```

Without the Firebase keys the site still runs; the form just says sign-ups open soon.

## Where sign-ups go

Firestore collection `waitlist` (one document per email, id = salted SHA-256 of the email), in
the Firebase project the app used before it moved to Supabase. Read them in the Firebase
console → Firestore. The rules published there ([`firestore.rules`](firestore.rules)) deny
everything outside `users/<uid>/items`, so browsers can't read or write the list; only this
server (admin SDK) can.

Use a **separate service account** with only the *Cloud Datastore User* role, not the default
admin one.

## Security (mapped to Security_Testing_Checklist.pdf)

| Check | How it's handled |
|---|---|
| A1–A4 secrets | `.env*` ignored; service account only in server env vars; `server-only` on files that use it; build checked for keys |
| A5 debug | No source maps in production; generic error messages; errors logged without emails or IPs |
| B1 dependencies | `npm run audit:prod`: 0 high/critical |
| E2–E4 input | Server-side validation of every field (length, format, no markup in names); React escapes all output; no `dangerouslySetInnerHTML` |
| E6 SSRF | The server never fetches a URL from a visitor |
| I1–I2 rate limit | 5 sign-ups per IP per hour, counter in Firestore (works on serverless); IPs stored only as salted hashes |
| I3 enumeration | "Already signed up" looks exactly like success |
| K1–K5 headers | Strict nonce CSP (`src/proxy.ts`), HSTS, nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy; Server Actions check `Origin` (CSRF) and are capped at 16 KB |
| Bots | Hidden honeypot field + rate limit |

## Deploy (Vercel)

A separate Vercel project from the app, with **Root Directory = `website`**. Add the
variables from `.env.example` (Production), then connect the domain. Pages render per request because the CSP nonce is new
every time.
