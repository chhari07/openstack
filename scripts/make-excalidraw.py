"""Generates docs/Stack_App.excalidraw: architecture, web vs app, features,
roadmap and research sources for the Stack app. Run: python3 scripts/make-excalidraw.py"""
import json
import math
import random
import textwrap

random.seed(7)
els = []
n = 0


def nid(prefix):
    global n
    n += 1
    return f"{prefix}{n}"


def base(kind, x, y, w, h, stroke="#1e1e1e", bg="transparent", **kw):
    e = {
        "id": nid(kind[0]), "type": kind, "x": x, "y": y, "width": w, "height": h, "angle": kw.pop("angle", 0),
        "strokeColor": stroke, "backgroundColor": bg, "fillStyle": "solid", "strokeWidth": kw.pop("strokeWidth", 2),
        "strokeStyle": kw.pop("strokeStyle", "solid"), "roughness": 0, "opacity": 100, "groupIds": [], "frameId": None,
        "roundness": kw.pop("roundness", {"type": 3}), "seed": random.randint(1, 2**31), "version": 1,
        "versionNonce": random.randint(1, 2**31), "isDeleted": False, "boundElements": [], "updated": 1,
        "link": kw.pop("link", None), "locked": False,
    }
    e.update(kw)
    els.append(e)
    return e


def text(x, y, s, size=18, color="#1e1e1e", family=2, width=None, align="left", link=None):
    lines = s.split("\n")
    w = width or max(len(l) for l in lines) * size * (0.56 if size >= 30 else 0.47) + 10
    h = len(lines) * size * 1.25
    return base("text", x, y, w, h, stroke=color, roundness=None, link=link, text=s, originalText=s, fontSize=size,
                fontFamily=family, textAlign=align, verticalAlign="top", containerId=None, lineHeight=1.25,
                autoResize=width is None)


def box(x, y, w, h, s, stroke="#1e1e1e", bg="#ffffff", size=18, align="center", valign="middle", dashed=False):
    r = base("rectangle", x, y, w, h, stroke=stroke, bg=bg, strokeStyle="dashed" if dashed else "solid")
    lines = s.split("\n")
    th = len(lines) * size * 1.25
    t = base("text", x + 10, y + (h - th) / 2 if valign == "middle" else y + 14, w - 20, th, stroke="#1e1e1e",
             roundness=None, text=s, originalText=s, fontSize=size, fontFamily=2, textAlign=align,
             verticalAlign=valign, containerId=r["id"], lineHeight=1.25, autoResize=True)
    r["boundElements"].append({"type": "text", "id": t["id"]})
    return r


def arrow(a, b, color="#1e1e1e", label=None, dashed=False):
    """Straight arrow from the bottom/side of box a to box b."""
    ax, ay = a["x"] + a["width"] / 2, a["y"] + a["height"]
    bx, by = b["x"] + b["width"] / 2, b["y"]
    if b["y"] < a["y"] + a["height"]:  # side by side: go from a's right to b's left
        ax, ay = a["x"] + a["width"], a["y"] + a["height"] / 2
        bx, by = b["x"], b["y"] + b["height"] / 2
    ar = base("arrow", ax, ay, bx - ax, by - ay, stroke=color, roundness={"type": 2},
              strokeStyle="dashed" if dashed else "solid", points=[[0, 0], [bx - ax, by - ay]],
              lastCommittedPoint=None, startBinding={"elementId": a["id"], "focus": 0, "gap": 4},
              endBinding={"elementId": b["id"], "focus": 0, "gap": 4}, startArrowhead=None, endArrowhead="arrow",
              elbowed=False)
    a["boundElements"].append({"type": "arrow", "id": ar["id"]})
    b["boundElements"].append({"type": "arrow", "id": ar["id"]})
    if label:
        text((ax + bx) / 2 + 8, (ay + by) / 2 - 12, label, size=14, color="#6b6862")
    return ar


def bullets(items, width_chars):
    out = []
    for it in items:
        wrapped = textwrap.wrap(it, width_chars)
        out.append("• " + wrapped[0])
        out += ["   " + w for w in wrapped[1:]]
    return "\n".join(out)


def section(x, y, title, color):
    text(x, y, title, size=34, color=color, family=2)


# ---------------- Title + logo ----------------
BLOCKS = [(304.7, 245, 65, 18, 0), (303.9, 203.8, 60, 18, -26.6), (293.7, 176.9, 38, 18, -32), (281.5, 145, 18, 29, 0)]
S = 0.9
for cx, cy, w, h, r in BLOCKS:  # the Stack logo, drawn with rotated rectangles
    base("rectangle", (cx - 242.5) * S - w * S / 2, (cy - 130) * S - 160 - h * S / 2, w * S, h * S, stroke="#111111",
         bg="#111111", angle=math.radians(r), roundness={"type": 3})
text(150, -150, "STACK — news · music · PDFs · notes in one app", size=44)
text(150, -90, "Web app + Android app (Capacitor) from one Next.js codebase · status as of 28 Sep 2026 · v1.0",
     size=20, color="#6b6862")

# ---------------- 1. Architecture ----------------
section(0, 0, "1 · How Stack is built", "#1971c2")
code = box(420, 70, 620, 110,
           "Shared code: Next.js 16 + React 19 + Tailwind v4\nsrc/app (screens) · src/lib (news, reader, Spotify, db)\nsrc/components (cards, players, sheets)",
           stroke="#1971c2", bg="#d0ebff", size=18)
web = box(40, 290, 600, 190,
          "WEB APP  (next build → server)\n• /api/news: HN, dev.to, RSS, cached 5 min\n• /api/article: reader mode on the server\n  (linkedom + Readability + sanitize-html)\n• Spotify Web Playback SDK (plays in browser)",
          stroke="#2f9e44", bg="#d3f9d8", size=17, align="left")
apk = box(820, 290, 640, 190,
          "ANDROID APP  (STACK_TARGET=apk → static out/ → Capacitor 8)\n• No server: fetches news + pages on the phone\n  (CapacitorHttp, DOMParser + DOMPurify)\n• Native Java plugins (see right) + animated splash\n• Phone portrait · tablet rail + rotation",
          stroke="#e8590c", bg="#ffe8cc", size=17, align="left")
arrow(code, web, "#2f9e44", "npm run build")
arrow(code, apk, "#e8590c", "./build-apk.sh")
native = box(1500, 250, 330, 270,
             "Native (Java)\n• LocalMusicPlugin +\n  PlaybackService (Media3)\n• PhoneFilesPlugin\n  (all files / folder)\n• LocalNotifications\n• AppSettings · Splash\n• [parked] SpotifyRemote",
             stroke="#e8590c", bg="#fff4e6", size=16, align="left")
arrow(apk, native, "#e8590c")
store = box(40, 560, 600, 90, "Both: data stays on the device\nIndexedDB: notes · PDFs (blobs) · covers · saved articles",
            stroke="#6741d9", bg="#e5dbff", size=17)
ext = box(820, 560, 1010, 90,
          "Outside services: Hacker News (Algolia) · dev.to · RSS (BBC, The Hindu, TOI, Indian Express, Al Jazeera, Mint, Guardian)\nSpotify Web API (login PKCE) · pdf.js (PDF rendering) · Mozilla Readability (reader mode)",
          stroke="#495057", bg="#f1f3f5", size=16)
arrow(web, store, "#6741d9")
arrow(apk, ext, "#495057", dashed=True)

# ---------------- 2. Web vs App ----------------
X2 = 2000
section(X2, 0, "2 · Web app vs Android app: major differences", "#c2255c")
rows = [
    ("", "WEB APP", "ANDROID APP (APK)"),
    ("How you get it", "Open a URL (needs the Next.js server running / hosted)", "Install Stack.apk (sideload, debug-signed), works without our server"),
    ("News & reader", "Fetched by our server (/api), cached 5 min", "Fetched directly by the phone (CapacitorHttp, no CORS)"),
    ("Spotify", "Can play inside the browser (Web Playback SDK, Premium)", "Remote-controls the Spotify app; opens it if needed. In-app App Remote planned"),
    ("Music on the device", "Not available", "MediaStore songs + Media3 background player, media notification, headset keys"),
    ("PDFs", "Pick files manually", "Pick files, OR auto-find every PDF (All files access / one folder)"),
    ("Notifications", "None", "Daily digest (local), permission flow in Settings → Access"),
    ("Launch & branding", "Favicon only", "Animated logo splash, app icon, notification icon"),
    ("Layouts", "Phone column; rail layout on wide screens", "Phone portrait; tablets rotate with the rail layout"),
    ("Updates", "Instant on redeploy", "Rebuild + reinstall the APK (no auto-update yet)"),
    ("Data", "IndexedDB in that browser", "IndexedDB in the app (not synced with the web)"),
]
cw = [260, 560, 620]
y = 70
for i, row in enumerate(rows):
    h = 56 if i else 50
    x = X2
    for j, cell in enumerate(row):
        bg = "#fcc2d7" if i == 0 else ("#fff0f6" if j == 0 else "#ffffff")
        box(x, y, cw[j], h, "\n".join(textwrap.wrap(cell, 50 if j else 24)) or " ",
            stroke="#c2255c", bg=bg, size=15 if i else 17, align="left" if j or i else "center")
        x += cw[j]
    y += h

# ---------------- 3. Current features ----------------
Y3 = 820
section(0, Y3, "3 · What Stack does today (v1.0)", "#2f9e44")
current = [
    ("TODAY", "#d3f9d8", ["Top story, continue reading, last note, mini player", "Animated logo header, daily digest card"]),
    ("NEWS", "#d3f9d8", ["11 topics: Top, India, World, Tech, AI, Dev, Business, Science, Sports, Entertainment, Health", "Flash cards (swipe) or list · search · save · share", "Reader mode + highlight / + Note / share"]),
    ("MUSIC", "#d3f9d8", ["On phone: all songs, search/sort, shuffle/repeat, seek", "Background play + media notification", "Spotify: login, playlists, Liked Songs, up next, remote control"]),
    ("LIBRARY + PDF", "#d3f9d8", ["Shelves, covers, saved articles", "Finds every PDF on the phone (All files access)", "pdf.js reader: highlights, notes per page, time left, music pill"]),
    ("NOTES", "#d3f9d8", ["Highlights + ideas + music notes with links back to the source", "Search, filters, edit, masonry columns"]),
    ("SETTINGS", "#d3f9d8", ["Appearance: Auto / Light / Dark", "Access: all files, notifications, music, PDF folder", "Spotify Client ID (no rebuild) · digest time · test notification"]),
]
for i, (name, bg, items) in enumerate(current):
    cx = (i % 3) * 620
    cy = Y3 + 70 + (i // 3) * 200
    box(cx, cy, 590, 175, name + "\n\n" + bullets(items, 58), stroke="#2f9e44", bg=bg, size=16, align="left", valign="top")
text(0, Y3 + 500, "Tested on Android 16 emulators (Pixel phone + Pixel Tablet), light and dark. Web build + lint + type checks pass.",
     size=16, color="#6b6862")

# ---------------- 4. Roadmap ----------------
X4 = 2000
section(X4, Y3, "4 · Plan: upcoming updates", "#e8590c")
phases = [
    ("PHASE 1 · Finish & stabilise  (week 1)", "#fff3bf", "#f08c00", [
        "Spotify inside Stack (App Remote SDK): no more 'no active device'  [code parked in native/wip]",
        "Release-signed APK + version numbers; simple in-app 'update available' check",
        "Offline cache: today's cards + saved articles readable with no network",
        "Deploy the web app (Vercel) so there is a shareable link",
    ]),
    ("PHASE 2 · Stack's unique features  (weeks 2–3)", "#ffe8cc", "#e8590c", [
        "Focus session: pick a PDF/article → 25-min timer + music + notes, summary at the end",
        "Share to Stack: send any link from Chrome/YouTube/WhatsApp to your Library (read later)",
        "Listen mode: articles & PDFs read aloud (Android TextToSpeech) in the media notification",
    ]),
    ("PHASE 3 · Smarter reading  (weeks 4–5)", "#d0ebff", "#1971c2", [
        "60-word AI summaries on news cards + 'explain this' on selected text (Gemini free tier)",
        "Personal feed: pick topics on first launch; Hindi news sources",
        "Breaking-news alerts per topic (WorkManager background fetch)",
    ]),
    ("PHASE 4 · Your data & reach  (week 6+)", "#e5dbff", "#6741d9", [
        "Export notes to Markdown; Google Drive backup / optional cloud sync",
        "Resurface an old highlight in the daily digest (spaced review)",
        "EPUB books · reading stats & streaks",
        "Play Store version: folder picker + music-only permission instead of All files access",
    ]),
]
py = Y3 + 70
prev = None
for title, bg, stroke, items in phases:
    h = 60 + sum(len(textwrap.wrap(it, 86)) for it in items) * 22 + 20
    b = box(X4, py, 1440, h, title + "\n" + bullets(items, 86), stroke=stroke, bg=bg, size=17, align="left", valign="top")
    if prev:
        arrow(prev, b, stroke)
    prev = b
    py += h + 40

# ---------------- 5. Research sources ----------------
Y5 = max(py, Y3 + 680) + 80
section(0, Y5, "5 · Sources for further research", "#495057")
sources = {
    "Similar apps (competitors)": [
        ("Inshorts: 60-word news cards (Google Play)", "https://play.google.com/store/apps/details?id=com.nis.app"),
        ("How Inshorts used AI (WAN-IFRA)", "https://wan-ifra.org/2020/03/how-inshorts-used-ai-to-become-one-of-indias-top-news-apps/"),
        ("Readwise Reader: read-later, highlights, PDFs, TTS, AI", "https://readwise.io/read"),
        ("Readwise Reader docs", "https://docs.readwise.io/reader"),
        ("Best read-it-later apps 2026 (Mente)", "https://www.getmente.com/blog/best-read-it-later-apps-2026"),
        ("Omnivore alternatives 2026 (Readless)", "https://www.readless.app/blog/omnivore-alternatives-2026"),
        ("FocusTune: Pomodoro + lofi music (Google Play)", "https://play.google.com/store/apps/details?id=com.study.focustune.music"),
        ("Focus Study: timer + notes (Google Play)", "https://play.google.com/store/apps/details?id=com.focusstudy"),
        ("ElevenReader: read-aloud reader", "https://elevenreader.io/"),
        ("Best PDF readers for Android (Android Authority)", "https://www.androidauthority.com/best-pdf-readers-for-android-366394/"),
        ("Best news apps 2026 (Zapier)", "https://zapier.com/blog/best-news-apps/"),
        ("News aggregator apps compared (daily.dev)", "https://daily.dev/blog/best-news-aggregator-apps-tested-compared/"),
    ],
    "Build docs (for the next phases)": [
        ("Capacitor docs", "https://capacitorjs.com/docs"),
        ("Capacitor Local Notifications", "https://capacitorjs.com/docs/apis/local-notifications"),
        ("Spotify Web API", "https://developer.spotify.com/documentation/web-api"),
        ("Spotify Android SDK (App Remote)", "https://developer.spotify.com/documentation/android"),
        ("Android Media3 (background playback)", "https://developer.android.com/media/media3"),
        ("Android: manage all files access", "https://developer.android.com/training/data-storage/manage-all-files"),
        ("Android: receive shared content (Share to Stack)", "https://developer.android.com/training/sharing/receive"),
        ("Android WorkManager (background news alerts)", "https://developer.android.com/topic/libraries/architecture/workmanager"),
        ("Android splash screens", "https://developer.android.com/develop/ui/views/launch/splash-screen"),
        ("Gemini API (AI summaries)", "https://ai.google.dev/gemini-api/docs"),
        ("pdf.js", "https://mozilla.github.io/pdf.js/"),
        ("Mozilla Readability", "https://github.com/mozilla/readability"),
        ("Next.js static exports", "https://nextjs.org/docs/app/guides/static-exports"),
    ],
}
sx = 0
for group, links in sources.items():
    text(sx, Y5 + 60, group, size=22, color="#1e1e1e")
    for i, (label, url) in enumerate(links):
        text(sx, Y5 + 100 + i * 30, f"↗ {label} — {url}", size=15, color="#1971c2", link=url)
    sx += 1720

doc = {"type": "excalidraw", "version": 2, "source": "https://excalidraw.com", "elements": els,
       "appState": {"gridSize": 20, "viewBackgroundColor": "#ffffff"}, "files": {}}
json.dump(doc, open("docs/Stack_App.excalidraw", "w"), indent=1)
print(len(els), "elements")
