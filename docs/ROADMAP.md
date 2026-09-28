# Stack — status and roadmap

Status as of 28 Sep 2026 (v1.0). The diagram version is `docs/Stack_App.excalidraw`
(regenerate with `python3 scripts/make-excalidraw.py`).

## Web app vs Android app

| | Web app | Android app (APK) |
|---|---|---|
| How you get it | Open a URL (Next.js server must be running / hosted) | Install `Stack.apk` (sideloaded, debug-signed); needs no server of ours |
| News & reader mode | Fetched by our server (`/api/news`, `/api/article`), cached 5 min | Fetched directly by the phone (CapacitorHttp, no CORS limits) |
| Spotify | Can play inside the browser (Web Playback SDK, Premium) | Remote-controls the Spotify app, opening it when needed; in-app App Remote planned |
| Music on the device | — | Android media library + Media3 background player, media notification, headset keys |
| PDFs | Pick files manually | Pick files, or find every PDF on the phone (All files access / one folder) |
| Notifications | — | Daily digest (local notification) |
| Launch & branding | Favicon | Animated logo splash, app icon, notification icon |
| Layouts | Phone column; navigation-rail layout on wide screens | Phone portrait; tablets rotate with the rail layout |
| Updates | Instant on redeploy | Rebuild + reinstall (no auto-update yet) |
| Data | IndexedDB in that browser | IndexedDB in the app; not synced with the web |

## What ships today (v1.0)

- **Today:** top story, continue reading, last note, mini player; animated logo; daily-digest card.
- **News:** 11 topics (Top, India, World, Tech, AI, Dev, Business, Science, Sports, Entertainment, Health) from HN, dev.to, BBC, The Hindu, Times of India, Indian Express, Al Jazeera, Mint, The Guardian; flash cards or list; search, save, share; reader mode with highlight / note / share.
- **Music:** songs on the phone (search, sort, shuffle, repeat, seek, background play, media notification); Spotify login, playlists, Liked Songs, up next, remote control.
- **Library & PDF reader:** shelves with covers, saved articles, whole-phone PDF discovery, pdf.js reader with highlights, notes per page, time left, music pill.
- **Notes:** highlights, ideas and music notes linked to their source; search, filters, edit, masonry.
- **Settings:** Auto / Light / Dark theme; Access (all files, notifications, music, PDF folder); Spotify Client ID without rebuilding; digest time; test notification.
- **Tablets:** navigation rail and 2–3 column layouts; rotation.

## Plan

### Phase 1 — Finish & stabilise (week 1)
- [ ] Spotify inside Stack with the App Remote SDK: no more "no active device" (code parked in `native/wip/`; needs package + SHA1 in the Spotify dashboard)
- [ ] Release-signed APK with version numbers; in-app "update available" check
- [ ] Offline cache: today's cards and saved articles readable without network
- [ ] Deploy the web app (Vercel) for a shareable link

### Phase 2 — Stack's unique features (weeks 2–3)
- [ ] **Focus session:** pick a PDF/article → 25-min timer + music + notes → summary at the end
- [ ] **Share to Stack:** send links from Chrome, YouTube or WhatsApp into the Library (read later)
- [ ] **Listen mode:** articles and PDFs read aloud (Android TextToSpeech) with media-notification controls

### Phase 3 — Smarter reading (weeks 4–5)
- [ ] 60-word AI summaries on news cards and "explain this" on selected text (Gemini free tier)
- [ ] Personal feed: choose topics on first launch; Hindi news sources
- [ ] Breaking-news alerts per topic (WorkManager background fetch)

### Phase 4 — Your data & reach (week 6+)
- [ ] Export notes to Markdown; Google Drive backup / optional cloud sync
- [ ] Resurface an old highlight in the daily digest (spaced review)
- [ ] EPUB books; reading stats and streaks
- [ ] Play Store build: folder picker + music-only permission instead of All files access

## Research sources

**Similar apps**
- Inshorts (60-word news cards): https://play.google.com/store/apps/details?id=com.nis.app
- How Inshorts used AI (WAN-IFRA): https://wan-ifra.org/2020/03/how-inshorts-used-ai-to-become-one-of-indias-top-news-apps/
- Readwise Reader: https://readwise.io/read · docs: https://docs.readwise.io/reader
- Best read-it-later apps 2026 (Mente): https://www.getmente.com/blog/best-read-it-later-apps-2026
- Omnivore alternatives 2026 (Readless): https://www.readless.app/blog/omnivore-alternatives-2026
- FocusTune: https://play.google.com/store/apps/details?id=com.study.focustune.music
- Focus Study: https://play.google.com/store/apps/details?id=com.focusstudy
- ElevenReader: https://elevenreader.io/
- Best PDF readers for Android (Android Authority): https://www.androidauthority.com/best-pdf-readers-for-android-366394/
- Best news apps 2026 (Zapier): https://zapier.com/blog/best-news-apps/
- News aggregators compared (daily.dev): https://daily.dev/blog/best-news-aggregator-apps-tested-compared/

**Build docs**
- Capacitor: https://capacitorjs.com/docs · Local Notifications: https://capacitorjs.com/docs/apis/local-notifications
- Spotify Web API: https://developer.spotify.com/documentation/web-api · Android SDK: https://developer.spotify.com/documentation/android
- Android Media3: https://developer.android.com/media/media3
- All files access: https://developer.android.com/training/data-storage/manage-all-files
- Receiving shared content: https://developer.android.com/training/sharing/receive
- WorkManager: https://developer.android.com/topic/libraries/architecture/workmanager
- Splash screens: https://developer.android.com/develop/ui/views/launch/splash-screen
- Gemini API: https://ai.google.dev/gemini-api/docs
- pdf.js: https://mozilla.github.io/pdf.js/ · Readability: https://github.com/mozilla/readability
- Next.js static exports: https://nextjs.org/docs/app/guides/static-exports
