"""Generates docs/Stack_Revision_Cards.excalidraw: the whiteboard plan (logic.jpeg), cleaned up:
sources -> Stack AI -> 60-word bilingual revision cards -> Daily Review. Run: python3 scripts/make-revision-excalidraw.py"""
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
        "strokeStyle": kw.pop("strokeStyle", "solid"), "roughness": 1, "opacity": 100, "groupIds": [], "frameId": None,
        "roundness": kw.pop("roundness", {"type": 3}), "seed": random.randint(1, 2**31), "version": 1,
        "versionNonce": random.randint(1, 2**31), "isDeleted": False, "boundElements": [], "updated": 1,
        "link": kw.pop("link", None), "locked": False,
    }
    e.update(kw)
    els.append(e)
    return e


def text(x, y, s, size=18, color="#1e1e1e", family=1, width=None, align="left", link=None):
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
             roundness=None, text=s, originalText=s, fontSize=size, fontFamily=1, textAlign=align,
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
    text(x, y, title, size=34, color=color, family=1)

# ---------------- Colours ----------------
BUILT = ("#2f9e44", "#d3f9d8")    # already in Stack
NEW = ("#1971c2", "#d0ebff")      # to build
CHANGED = ("#e8590c", "#ffe8cc")  # changed from the whiteboard
AI = ("#6741d9", "#e5dbff")
REVIEW = ("#c2255c", "#ffdeeb")
NOTE = ("#1e1e1e", "#fff9db")
GREY = "#6b6862"


def b(x, y, w, h, s, c, size=17, align="center", dashed=False):
    return box(x, y, w, h, s, stroke=c[0], bg=c[1], size=size, align=align, dashed=dashed)


# ---------------- Title ----------------
text(0, -170, "STACK · revision flow", size=46)
text(0, -110, "The whiteboard plan (logic.jpeg), cleaned up · 29 Sep 2026 · everything you read becomes 60-word cards you revise",
     size=20, color=GREY)
for i, (label, c) in enumerate((("already in Stack", BUILT), ("new, to build", NEW),
                                ("changed from the whiteboard", CHANGED), ("Stack AI", AI), ("revision", REVIEW))):
    b(i * 300, -60, 280, 40, label, c, size=16)

# ---------------- 1. Sources ----------------
section(0, 20, "1 · Everything you read", "#1e1e1e")
notes = b(0, 90, 400, 150, "USER NOTES\nnotes · highlights · checklists\n(“Notes of user”)", BUILT)
phone = b(460, 90, 400, 150, "PHONE PDFs\nLibrary + every PDF on the phone\n(“System PDF”)", BUILT)
tele = b(920, 90, 440, 150, "TELEGRAM PDFs\n“From Telegram” shelf: found in\nTelegram's download folder, no login\n+ Share to Stack from Telegram", CHANGED, size=16)
news = b(1420, 90, 440, 150, "NEWS + MY FEEDS\n11 topics + your own RSS feeds\n(“User combined feed”)", BUILT)
pick = b(920, 290, 440, 80, "Select the PDF to import →\nlands on a shelf (“PDF Imported”)", CHANGED, size=16)
arrow(tele, pick, CHANGED[0])
ask = b(1420, 290, 440, 80, "🆕 “Ask about the news”\nAI answers from loaded stories + feeds", NEW, size=16)
arrow(news, ask, NEW[0])
text(1520, -66, "Why Telegram changed: it has no safe “log in with Telegram”\nfor apps to read your files. Its download folder + Share\nto Stack do the same job with no login.",
     size=14, color=CHANGED[0])

# ---------------- 2. Pick one source ----------------
section(0, 470, "2 · Pick one thing to revise", "#1e1e1e")
one = b(0, 540, 1860, 110,
        "ONE SOURCE AT A TIME:   a set of notes   ·   one PDF chapter (pages 40–62)   ·   one article   ·   today's news\n"
        "(small pieces are fast and cheap; a whole book at once is slow and costly)", NOTE, size=18)
for s in (notes, phone, pick, ask):
    arrow(s, one, "#495057")

# ---------------- 3. Stack AI ----------------
section(0, 720, "3 · Stack AI", "#1e1e1e")
ai = b(0, 790, 600, 300,
       "STACK AI  (server: /api/ai)\nengine: OpenAI gpt-5.5  or  Claude\n\n✅ Summaries\n✅ Tidy notes\n✅ Ask your Stack\n✅ Ask this PDF\n🆕 Make revision cards\n🆕 Ask about the news\n🆕 Translate: English ⇄ हिंदी",
       AI, size=17)
arrow(one, ai, AI[0])
rules = b(0, 1120, 600, 170,
          "Rules\n• every card links to its source (p. 42, your note, the article)\n• same source → same cards: never pay twice\n• you keep or delete each card first\n• daily AI limit per person",
          NOTE, size=15, align="left")

# ---------------- 4. Card ----------------
card = b(700, 790, 560, 300,
         "REVISION CARD  (≤ 60 words)\n\nFRONT: the question / key idea\nBACK:  the answer in 60 words\n\n[ English | हिंदी ]  flip language\nsource chip:  p. 42 · Deep Work\n\n  Keep ✓     Delete ✕",
         NEW, size=17)
arrow(ai, card, NEW[0])
text(700, 1100, "Short · swipeable · bilingual: same swipe UI as the News flash cards", size=15, color=GREY)
lang = b(700, 1150, 560, 90, "Settings → Card language:\nEnglish · हिंदी · both", NEW, size=16)

# ---------------- 5. Revision ----------------
review = b(1360, 790, 500, 300,
           "DAILY REVIEW  (spaced repetition)\n\nswipe right: Got it → back in 3 days,\n  then ~2.5× longer each time\nswipe left: Again → tomorrow\nStop → retired\n\n+ morning notification",
           REVIEW, size=17)
arrow(card, review, REVIEW[0])
text(1360, 1100, "Revision already exists for highlights:\ncards simply join the same queue", size=15, color=GREY)
streak = b(1360, 1150, 500, 90, "Streaks · badges · focus goal\n(Profile) keep people coming back", BUILT, size=16)
arrow(review, streak, BUILT[0], dashed=True)

# ---------------- 6. Build order ----------------
section(0, 1400, "4 · Build order", "#1e1e1e")
steps = [
    ("1", "Revision cards from a PDF chapter, a note set or an article (English)", NEW),
    ("2", "Cards join Daily Review (same swipe + schedule)", NEW),
    ("3", "“From Telegram” shelf", CHANGED),
    ("4", "Hindi + language switch on cards", NEW),
    ("5", "Ask about the news", NEW),
]
prev = None
for i, (num, s, c) in enumerate(steps):
    st = b(i * 380, 1470, 340, 120, f"{num}\n" + "\n".join(textwrap.wrap(s, 30)), c, size=16)
    if prev:
        arrow(prev, st, "#495057")
    prev = st

doc = {"type": "excalidraw", "version": 2, "source": "https://excalidraw.com", "elements": els,
       "appState": {"gridSize": 20, "viewBackgroundColor": "#ffffff"}, "files": {}}
json.dump(doc, open("docs/Stack_Revision_Cards.excalidraw", "w"), indent=1)
print(len(els), "elements → docs/Stack_Revision_Cards.excalidraw")
