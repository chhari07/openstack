<p align="center">
  <img src="docs/assets/banner.png" alt="Stack: read it, keep it, build on it. News, PDF, music and notes." width="100%">
</p>

<h1 align="center">StackForge · Stack</h1>

<p align="center">
  <b>Read it. Keep it. Build on it.</b><br>
  Tech news, your PDFs, music and notes in one learning app for Android and the web.
</p>

<p align="center">
  <img src="docs/screens/notes.jpg" width="200" alt="Notes">
  <img src="docs/screens/focus.jpg" width="200" alt="Focus session">
  <img src="docs/screens/review.jpg" width="200" alt="Daily review">
  <img src="docs/screens/playlist.jpg" width="200" alt="Playlist">
</p>

**StackForge** is the open-source home of **Stack**, built by StackForge Labs. Select a line in any
article or PDF and it becomes a note that remembers where it came from. Stack
brings those highlights back later, so what you read stays with you.

## Features

| | |
|---|---|
| **Today** | Top story, swipeable rows of more stories, PDFs you're reading and recent notes, a focus card and the daily review |
| **News** | **My feeds** (any RSS/Atom feed, or just a site like `css-tricks.com`) plus 11 topics (Top, India, World, Tech, AI, Dev, Business, Science, Sports, Entertainment, Health) from BBC, The Hindu, Times of India, Indian Express, Al Jazeera, Mint, The Guardian, Hacker News and dev.to. Flash cards or a list, pull to refresh (the Stack logo stacks itself while it loads), and a clean reader mode |
| **Highlights & notes** | Select text: Highlight, + Note or Share. A Keep-style editor with titles, checklists, colours, pin, autosave, share, and delete with Undo |
| **Library & PDF reader** | Coloured shelves, pdf.js reader with highlights and page notes, reading time left, every PDF on the phone (Android) |
| **Focus session** | Pick a PDF or article, 15–60 min timer or **Pomodoro** (4 × 25 min with 5-minute breaks and a 15-minute long break), music, quick notes, then a summary (pages, highlights, notes) with a streak |
| **Daily review** | 3 old highlights a day on a spaced schedule (Got it / Show again soon / Stop), also in the morning notification |
| **Share to Stack** | Share from Chrome, WhatsApp, YouTube or Files: a small "Saved to Stack" card pops up over the app you're in. Links go to the Library, PDFs to a shelf, text to notes |
| **Music** | Songs on the phone (background play, lock-screen controls, shuffle, repeat), your own playlists with cover images, or Spotify |
| **Search** | One search across notes, checklists, highlights, saved articles, PDFs and playlists, with filters and recent searches |
| **Profile** | Photo, bio, status, profile colour, interests (News shows them first) and a daily focus goal. Reader type, streaks, an activity heatmap and 12 badges |
| **Stack AI** (optional) | Summarize an article, ask questions about a PDF (answers link to pages), "Ask your Stack" across your own notes, and tidy a note. Runs on OpenAI or Claude through Stack's server; asks before sending anything |
| **Account & sync** | Continue with Google (or email). Notes, saved articles, PDFs, playlists, focus history and profile sync across devices (Firebase). Works fully offline without an account |
| **Backup & restore** | Everything in one file (with or without the PDF files), no account needed |
| **Everything else** | Light/dark theme, tablet layout, animated splash, daily digest notification, 148-icon set (`src/components/icons.tsx` + `stack-icons.tsx`) |

## Run it

```bash
git clone https://github.com/chhari07/stackforge.git
cd stackforge
npm install
npm run dev        # http://127.0.0.1:3000
```

News, articles, PDFs, notes, focus and review work with no setup and no keys.
Accounts, Spotify and Stack AI are optional (below).

## Android app (APK)

```bash
./build-apk.sh     # → ~/Desktop/Stack.apk
```

It uses a JDK 21 + Android SDK in `~/.local/share/tipsy-toolchain`. The script:

1. builds a static bundle (`STACK_TARGET=apk next build` → `out/`). There's no
   server in the app: it fetches news and pages itself with Capacitor's native
   HTTP, and uses Readability + DOMPurify for reader mode;
2. creates/updates `android/` with Capacitor and applies
   `scripts/android-setup.mjs` (icon, splash, native plugins from
   `native/android/`, share card, permissions);
3. runs Gradle and copies the debug-signed APK to the Desktop.

Install by opening the APK on the phone (allow "Install unknown apps" once), or `adb install -r ~/Desktop/Stack.apk`.

## Accounts and sync (optional, Firebase)

Copy `.env.example` to `.env.local` and follow **[firebase/README.md](firebase/README.md)**:
create a Firebase project, turn on Google and Email/Password sign-in, add the
Android app with your SHA-1, create Firestore and publish
[`firebase/firestore.rules`](firebase/firestore.rules). PDF files sync with
Cloud Storage (Blaze plan); without it everything else still syncs.

## Stack AI (optional)

AI runs only on the server (`src/app/api/ai/route.ts`), so no key ever goes into
the app. It needs a signed-in account (Firebase, above). In `.env.local`:

```bash
AI_PROVIDER=openai            # or anthropic (Claude)
NEXT_PUBLIC_AI_ENGINE=OpenAI  # the name shown before anything is sent
OPENAI_API_KEY=sk-...         # or ANTHROPIC_API_KEY=... for Claude
NEXT_PUBLIC_AI_URL=http://10.0.2.2:3000   # APK only: where /api/ai lives
```

Models are set per feature (`OPENAI_MODEL`, `AI_MODEL`, …) and each person gets
`AI_DAILY_LIMIT` requests a day (default 50). See [`.env.example`](.env.example)
and the diagram in [`docs/Stack_AI_Engines.excalidraw`](docs/Stack_AI_Engines.excalidraw).
Never put a key in `.env.example`: it's in git.

## Spotify (optional)

1. Create an app at https://developer.spotify.com/dashboard (Web API + Web Playback SDK).
2. Redirect URIs: `http://127.0.0.1:3000/music/callback` and `com.chhari.stack://callback`.
3. Put the Client ID in `.env.local` (or paste it in the app under Settings), then open **http://127.0.0.1:3000**.

Play/pause/skip needs Spotify Premium; free accounts can browse and "Open in
Spotify". The unfinished in-app Spotify player (`native/wip/`) needs Spotify's
App Remote SDK `.aar` in `native/android-libs/`, which isn't included here:
download it from Spotify's Android SDK releases.

## How it works

- **Next.js 16** (App Router) + Tailwind v4, **Capacitor 8** for Android. Fonts: Archivo, Bodoni Moda, IBM Plex Mono.
- **Local-first:** notes, PDFs, playlists and everything else live in IndexedDB (`idb-keyval`); every write is tracked (`src/lib/sync-state.ts`) so sync can upload it later.
- **Sync** (`src/lib/sync.ts`): one Firestore document per item under `users/<uid>/items`, stamped by the server; upload changes, then download what changed since last time. Local edits not yet uploaded win.
- **Your own feeds** are read by the phone; the website reads them through `/api/feed`, which only fetches public addresses (no local or private networks, checked on every redirect).
- **Stack AI** (`/api/ai`): checks the Firebase sign-in, applies the daily limit, streams the answer, and turns the engine's citations into page and note links.
- **Reader mode:** only story ids are accepted by the website's `/api/article` (no arbitrary URLs); links shared into the Android app are fetched by the phone itself.
- **Highlights** use the CSS Custom Highlight API, so saved quotes are painted back without changing the page.
- **Native Android** (`native/android/`): local music (Media3), PDF discovery, share card (`ShareActivity`), Google account picker (Credential Manager), backup file saving, splash.

## Project layout

```
src/app/          screens (Today, News, Music, Library, Notes, Focus, Review, Share, Account…)
src/components/   UI pieces (cards, players, editor, sign-in…)
src/lib/          storage, sync, news, feeds, search, backup, AI client, music…
native/android/   Java plugins copied into the Android project
firebase/         Firestore/Storage rules and setup guide
docs/             roadmap, diagrams, banner, screenshots
```

See [docs/ROADMAP.md](docs/ROADMAP.md) for what's next.
