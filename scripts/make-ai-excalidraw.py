"""Generates docs/Stack_AI_Engines.excalidraw: how Stack's planned AI features reach Claude, which
model each one uses, and the rules around keys, cost and privacy. Run: python3 scripts/make-ai-excalidraw.py"""
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

# Colours: one per engine, so every lane shows at a glance which model it uses.
OPUS = ("#6741d9", "#e5dbff")
SONNET = ("#1971c2", "#d0ebff")
HAIKU = ("#2f9e44", "#d3f9d8")
VOYAGE = ("#e8590c", "#ffe8cc")
STACK = ("#495057", "#f1f3f5")
GREY = "#6b6862"


def step(x, y, s, c=STACK, w=320, h=130, size=17, dashed=False):
    return box(x, y, w, h, s, stroke=c[0], bg=c[1], size=size, dashed=dashed)


# ---------------- Title + logo ----------------
BLOCKS = [(304.7, 245, 65, 18, 0), (303.9, 203.8, 60, 18, -26.6), (293.7, 176.9, 38, 18, -32), (281.5, 145, 18, 29, 0)]
S = 0.9
for cx, cy, w, h, r in BLOCKS:
    base("rectangle", (cx - 242.5) * S - w * S / 2, (cy - 130) * S - 160 - h * S / 2, w * S, h * S, stroke="#111111",
         bg="#111111", angle=math.radians(r), roundness={"type": 3})
text(150, -150, "STACK — AI engines: how each feature works", size=44)
text(150, -90, "Plan, 29 Sep 2026 · default engine Claude Opus 5.5 · cheaper options marked per feature · nothing built yet",
     size=20, color=GREY)

# ---------------- 1. Request flow ----------------
section(0, 0, "1 · How an AI request travels", "#1e1e1e")
app = step(0, 130, "STACK APP\nphone (APK) + website\n\nYou tap Summarize,\nAsk, Quiz…", STACK, w=300, h=200, size=18)
backend = step(400, 100, "STACK AI BACKEND  /api/ai\n• keeps the Claude API key\n  (never inside the APK)\n• checks you're signed in (Firebase)\n• daily limit per person\n• picks the model for the feature",
               ("#c2255c", "#ffdeeb"), w=440, h=260, size=17)
claude = step(940, 40, "CLAUDE API\nAnthropic TypeScript SDK\n\n• streaming answers\n• prompt caching\n  (repeat PDFs ≈ 10% price)\n• Batch API (50% off, not urgent)\n• refusal fallback",
              ("#1e1e1e", "#ffffff"), w=380, h=380, size=17)
opus = step(1420, 40, "Claude Opus 5.5  (DEFAULT)\nclaude-opus-5-5 · $4 / $20 per 1M tokens\nbest quality · 1M-token context", OPUS, w=440, h=110, size=16)
sonnet = step(1420, 175, "Claude Sonnet 5.5  (option)\nclaude-sonnet-5-5 · $2 / $10\n≈ half the cost, still strong", SONNET, w=440, h=110, size=16)
haiku = step(1420, 310, "Claude Haiku 4.5  (option)\nclaude-haiku-4-5 · $1 / $5\ncheapest + fastest · 200K context", HAIKU, w=440, h=110, size=16)
arrow(app, backend, "#c2255c")
text(306, 180, "HTTPS +\nsign-in", size=14, color=GREY)
arrow(backend, claude, "#1e1e1e")
text(858, 196, "SDK call", size=14, color=GREY)
for m, c in ((opus, OPUS), (sonnet, SONNET), (haiku, HAIKU)):
    arrow(claude, m, c[0])
back = step(400, 430, "Answer streams back → shown in Stack → you can save it to Notes", STACK, w=920, h=60, size=17, dashed=True)
text(0, 520, "Legend:", size=18)
for i, (label, c) in enumerate((("Opus 5.5 (default)", OPUS), ("Sonnet 5.5", SONNET), ("Haiku 4.5", HAIKU),
                                ("Voyage AI (embeddings)", VOYAGE), ("Stack app / data", STACK))):
    box(90 + i * 330, 510, 300, 44, label, stroke=c[0], bg=c[1], size=16)

# ---------------- 2. Feature pipelines ----------------
Y = 660
section(0, Y, "2 · Feature pipelines (left → right)", "#1e1e1e")
LANES = [
    ("1 · Article summary\n“Summarize” in reader", [
        ("Article text\n(Readability, already\nin the reader)", STACK),
        ("/api/ai/summary\nshort prompt:\n3 bullets + 1 takeaway", STACK),
        ("Opus 5.5 (default)\ncheaper: Haiku 4.5", OPUS),
        ("Shown under the title\n“Save to Notes” button\n≈ 1–2 ¢ per article", STACK)]),
    ("2 · Chat with your PDF\ncites page numbers", [
        ("PDF from Library\n(IndexedDB blob)", STACK),
        ("Sent as a document\n+ citations ON\n+ prompt caching\n(≤ 32 MB, 600 pages)", STACK),
        ("Opus 5.5 (default)\ncheaper: Sonnet 5.5", OPUS),
        ("Answer with “p. 42” links\ntap → jumps to page\n1st question ≈ 60 ¢,\nnext ones much less", STACK)]),
    ("3 · Ask your Stack\nall notes + highlights", [
        ("Your question", STACK),
        ("Stack word search\n(lib/search.ts)\n→ top 20 notes\n& highlights", STACK),
        ("Opus 5.5 (default)\ncheaper: Sonnet 5.5", OPUS),
        ("Answer + links to\neach note it used", STACK)]),
    ("4 · Daily briefing\n& weekly recap", [
        ("Night job (cron)\nyour topics, feeds,\nweek's highlights", STACK),
        ("Batch API\n50% cheaper,\nready by morning", STACK),
        ("Opus 5.5 (default)\ncheaper: Sonnet 5.5", OPUS),
        ("On Today at 9 AM\n+ morning notification", STACK)]),
    ("5 · Quick jobs\nquiz · tidy note ·\nplaylist names · shelves", [
        ("Note, highlight,\nsong list or PDF title", STACK),
        ("/api/ai/quick\nasks for structured\nJSON output", STACK),
        ("Opus 5.5 (default)\ncheaper: Haiku 4.5", OPUS),
        ("Quiz cards, clean\nchecklist, playlist\nname, shelf + tags", STACK)]),
]
y = Y + 80
for title, steps in LANES:
    lab = step(0, y, title, ("#1e1e1e", "#fff9db"), w=280, h=130, size=17)
    prev = lab
    for i, (s, c) in enumerate(steps):
        b = step(360 + i * 380, y, s, c, w=320, h=130, size=16)
        arrow(prev, b, c[0] if c != STACK else "#495057")
        prev = b
    y += 170

# Lane 6: search by meaning, two options
lab = step(0, y + 45, "6 · Search by meaning\n“that article about\nsleep and memory”", ("#1e1e1e", "#fff9db"), w=280, h=130, size=17)
q = step(360, y, "Your search words", STACK, w=320, h=220, size=16)
a = step(740, y, "OPTION A (recommended)\nword search finds ~50 →\nClaude picks the best\none provider, simpler", HAIKU, w=440, h=100, size=15)
b = step(740, y + 120, "OPTION B\nVoyage AI embeddings → vector index\n→ nearest by meaning\n2nd provider + 2nd API key", VOYAGE, w=440, h=100, size=15)
res = step(1260, y, "Results list\n(same screen as\ntoday's Search)", STACK, w=320, h=220, size=16)
arrow(lab, q, "#495057")
for o, c in ((a, HAIKU), (b, VOYAGE)):
    arrow(q, o, c[0])
    arrow(o, res, c[0])
text(1620, y + 20, "Option A model:\nOpus 5.5 (default)\ncheaper: Haiku 4.5", size=15, color=GREY)
y += 290

# ---------------- 3. Rules ----------------
section(0, y, "3 · Rules for every AI feature", "#1e1e1e")
rules = [
    "API key lives only on the backend — never inside the APK (anyone could pull it out).",
    "Opt-in and honest: each feature says what is sent to Claude (article, PDF, notes) before first use.",
    "Limits per person per day, so one user can't run up the bill.",
    "Prompt caching for repeat questions on the same PDF/notes; Batch API for nightly jobs (50% off).",
    "Always check stop_reason (refusal / max_tokens) before showing an answer; refusal fallback turned on.",
    "Stream long answers so the screen fills as Claude writes.",
    "The model per feature is a setting on the backend — switch Opus ↔ Sonnet ↔ Haiku without an app update.",
]
box(0, y + 60, 1860, 240, bullets(rules, 150), stroke="#c2255c", bg="#fff0f6", size=18, align="left")

doc = {"type": "excalidraw", "version": 2, "source": "https://excalidraw.com", "elements": els,
       "appState": {"gridSize": 20, "viewBackgroundColor": "#ffffff"}, "files": {}}
json.dump(doc, open("docs/Stack_AI_Engines.excalidraw", "w"), indent=1)
print(len(els), "elements → docs/Stack_AI_Engines.excalidraw")
