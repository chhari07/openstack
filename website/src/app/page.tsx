import { Logo } from "@/components/logo";
import { PhoneShot } from "@/components/phone-shot";
import { SignupForm } from "@/components/signup-form";
import { Footer } from "@/components/footer";
import { TabNav, type TabId } from "@/components/tab-nav";
import { SITE } from "@/lib/site";

// One page, in the same order people meet things in the app, so nothing on
// the site is new to them when they open Stack:
// welcome (hero) → first minute (the app's own onboarding) → the five tabs,
// in tab-bar order, with real screens → local first → join → questions.
// Names and button labels are the app's own words.

// Staggered load delays, as classes so no inline styles are needed.
const LETTER_DELAYS = ["[animation-delay:350ms]", "[animation-delay:420ms]", "[animation-delay:490ms]", "[animation-delay:560ms]", "[animation-delay:630ms]"];

// The app's first launch (stack/src/app/welcome/page.tsx), step by step.
const FIRST_MINUTE = [
  { n: "01", title: "Open Stack", body: "The logo stacks itself up, block by block, and you’re on the welcome screen." },
  { n: "02", title: "Sign in, or don’t", body: "Continue with Google or email to sync between devices, or tap “Continue without an account”. Everything works either way." },
  { n: "03", title: "Make it yours", body: "Add your name and a photo, so Stack knows what to call you. You can skip this and do it later." },
  { n: "04", title: "Get started", body: "Tap “Get started” and you land on Today, the first of the five tabs below." },
];

// The five tabs, in the app's order. The ids match the tab bar (tab-nav.tsx).
const TOUR: {
  id: TabId;
  title: string;
  lead: string;
  points: string[];
  text: string;
  shot: { light: string; dark?: string; alt: string };
}[] = [
  {
    id: "today",
    title: "TODAY",
    lead: "Your day on one screen: the top story, what you’re reading, your latest notes and the daily review.",
    points: [
      "Top story and more stories to swipe through",
      "Continue reading: the PDFs you have open",
      "Daily review: 3 old highlights each morning, with “Open where you read it”",
      "A focus card to start a timer or Pomodoro",
      "This week: time read, articles finished and PDF pages, a bar for each day",
    ],
    text: "text-music-text",
    shot: { light: "/screens/today-light.png", dark: "/screens/today-dark.png", alt: "The Today tab with the top story, PDFs in progress and recent notes" },
  },
  {
    id: "news",
    title: "NEWS",
    lead: "12 topics from trusted sources, including Video, plus any site or RSS feed you add under My feeds.",
    points: [
      "Flash cards or a list, with the date and time on every story",
      "Video news from BBC, Al Jazeera, DW, Reuters, WION, NDTV and India Today",
      "Save a story to read it in a clean reader mode, even offline",
      "Select any line to highlight it or keep it as a note",
      "Breaking-news alerts for the topics you pick, at most one an hour",
    ],
    text: "text-news-text",
    shot: { light: "/screens/news-light.png", dark: "/screens/news-dark.png", alt: "The News tab showing stories as swipeable flash cards" },
  },
  {
    id: "music",
    title: "MUSIC",
    lead: "Songs on your phone and your own playlists, for reading or a focus session.",
    points: [
      "A spinning record with the song title on its label",
      "Keeps playing in the background, with Stack’s own notification and lock screen",
      "Shuffle, repeat, speed, sleep timer and an Up next queue",
      "Playlists with your own cover images",
    ],
    text: "text-music-text",
    shot: { light: "/screens/music-light.png", dark: "/screens/music-dark.png", alt: "The Music tab with songs from the phone" },
  },
  {
    id: "library",
    title: "LIBRARY",
    lead: "Your PDFs and saved articles on coloured shelves. Share anything to Stack and it lands here.",
    points: [
      "Share from Chrome, WhatsApp or Files: a “Saved to Stack” card pops up",
      "Import PDFs from Telegram: forward them to your bot, then pick which to add",
      "PDF reader with highlights, page notes and reading time left",
      "Listen: articles and PDFs read aloud, with the same controls as music",
    ],
    text: "text-pdf-deep",
    shot: { light: "/screens/library-light.png", dark: "/screens/library-dark.png", alt: "The Library tab with coloured shelves of PDFs" },
  },
  {
    id: "notes",
    title: "NOTES",
    lead: "Every highlight becomes a note that remembers where it came from, next to the notes you write yourself.",
    points: [
      "Titles, checklists, colours and pins",
      "Each highlight shows its source: the article, or the PDF and page",
      "One search across notes, highlights, articles and PDFs",
      "Export to Markdown for Obsidian, Notion or any editor",
    ],
    text: "text-ink",
    shot: { light: "/screens/notes-light.png", dark: "/screens/notes-dark.png", alt: "The Notes tab with notes and saved highlights" },
  },
];

const FAQ = [
  {
    q: "What is a soft launch?",
    a: "Stack is finished enough to use every day, and we're opening it to a small group first. Testers get the Android app early through Google Play's closed test, and their feedback shapes the public release.",
  },
  { q: "Is it free?", a: "Yes. Stack is free and open source. Testers will also get Stack Plus free for a year when it arrives." },
  { q: "Do I need an account?", a: "No. Stack works fully offline on your phone. Signing in is only for syncing between devices." },
  {
    q: "Can Stack read to me?",
    a: "Yes. Tap the headphones on any article or PDF and Stack reads it aloud with your phone’s own voice, with play, pause, speed and a sleep timer in the notification.",
  },
  {
    q: "Can I get my notes out?",
    a: "Anytime. Export your notes and highlights to Markdown (each with a link to where you read it), or save a full backup file from Settings.",
  },
  { q: "Can I turn AI off?", a: "Yes. Stack AI is optional, asks before sending anything, and one switch in Settings turns it off completely." },
  {
    q: "Can I import PDFs from Telegram?",
    a: "Yes. Make a free bot with Telegram’s @BotFather, connect it in Library, forward PDFs to it and pick which ones to add (up to 20 MB each).",
  },
  {
    q: "I have an iPhone. Can I join?",
    a: "There's no iPhone app yet, but Stack also runs in the browser. Join with launch news only and we'll tell you when the web version opens.",
  },
  {
    q: "What does the test ask of me?",
    a: "Install the app from the invite link, stay opted in for 14 days, and use it for a few minutes on some of those days. We'll send one short feedback form.",
  },
];

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-on-ink"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
        {/* Reading progress: fills as you scroll down the story */}
        <div className="progress absolute inset-x-0 bottom-[-1px] h-[2px] origin-left bg-ink" aria-hidden="true" />
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#main" className="flex items-center gap-2" aria-label="Stack, back to top">
            <Logo size={28} />
            <span className="display text-2xl">STACK</span>
          </a>
          <a href="#join" className="label rounded-full bg-ink px-4 py-2.5 text-xs text-on-ink transition hover:opacity-90">
            Join<span className="max-sm:hidden"> the soft launch</span>
          </a>
        </div>
      </header>

      <main id="main" className="scroll-mt-20 overflow-x-clip">
        <Hero />
        <Problem />
        <FirstMinute />
        <Tour />
        <LocalFirst />
        <Join />
        <Questions />
      </main>

      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="relative">
      {/* Soft colour behind the phone: the four app colours, blurred */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute right-[-10%] top-[8%] size-[28rem] rounded-full bg-pdf-tint opacity-70 blur-3xl" />
        <div className="absolute right-[18%] top-[45%] size-[20rem] rounded-full bg-news-tint opacity-70 blur-3xl" />
        <div className="absolute left-[-8%] top-[60%] size-[18rem] rounded-full bg-blue-tint opacity-50 blur-3xl" />
      </div>

      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-14 px-4 py-14 sm:px-6 md:grid-cols-[1.15fr_1fr] md:py-10">
        <div>
          <p className="rise label inline-flex items-center gap-2 rounded-full border border-rule bg-card/60 px-3 py-1.5 text-xs text-muted">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-news opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-news" />
            </span>
            Soft launch · Closed test open
          </p>

          <h1 className="mt-8">
            <span className="flex items-end gap-3 sm:gap-5">
              <Logo size={116} animate className="shrink-0 max-sm:size-[70px]" />
              <span className="letters display whitespace-nowrap text-[5.6rem] sm:text-[8.5rem] lg:text-[10rem]" aria-label="STACK">
                {"STACK".split("").map((l, i) => (
                  <span key={i} aria-hidden="true">
                    <span className={LETTER_DELAYS[i]}>{l}</span>
                  </span>
                ))}
              </span>
            </span>
            <span className="rise mt-7 block text-balance font-serif text-4xl italic leading-tight [animation-delay:750ms] sm:text-5xl">
              {SITE.tagline}
            </span>
          </h1>

          <p className="rise mt-6 max-w-xl text-lg text-prose [animation-delay:900ms] sm:text-xl">
            News, your PDFs, music and notes in one place. Highlight what matters, and Stack brings it back so you{" "}
            <mark className="marker font-semibold">remember what you read</mark>.
          </p>

          <div className="rise mt-9 flex flex-wrap items-center gap-3 [animation-delay:1050ms]">
            <a href="#join" className="label group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-4 text-sm text-on-ink transition hover:opacity-90">
              Join the soft launch
              <span aria-hidden="true" className="transition group-hover:translate-x-1">→</span>
            </a>
            <a href="#first-minute" className="label rounded-full border border-ink px-7 py-4 text-sm transition hover:bg-paper-2">
              See the app
            </a>
          </div>

          <ul className="rise label mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted [animation-delay:1200ms]">
            <li>Free</li>
            <li aria-hidden="true">·</li>
            <li>Open source</li>
            <li aria-hidden="true">·</li>
            <li>Works offline</li>
            <li aria-hidden="true">·</li>
            <li>No ads</li>
          </ul>
        </div>

        {/* The phone with little cards from the app floating around it */}
        <div className="relative mx-auto w-full max-w-[290px] py-10 sm:max-w-[310px]">
          <PhoneShot
            light="/screens/today-light.png"
            dark="/screens/today-dark.png"
            alt="Stack's Today screen with the top story, PDFs in progress and recent notes"
            priority
            className="phone-in"
          />

          <div
            aria-hidden="true"
            className="float absolute -left-16 top-[14%] w-56 rounded-2xl border border-rule bg-card p-4 shadow-xl [animation-delay:1400ms,2.9s] max-sm:-left-6 max-sm:w-48"
          >
            <p className="label text-[10px] text-pdf-deep">Highlight · PDF p.1</p>
            <p className="mt-2 font-serif text-[15px] italic leading-snug">
              “<span className="bg-pdf/40">Signifiers tell you where the action should happen.</span>”
            </p>
          </div>

          <div
            aria-hidden="true"
            className="float absolute -right-12 top-[4%] flex items-center gap-2 rounded-full bg-news px-3.5 py-2 text-sm font-semibold text-white shadow-lg [animation-delay:1650ms,3.2s] max-sm:-right-3"
          >
            <span className="grid size-5 place-items-center rounded-full bg-white/25 text-xs">✓</span>
            Saved to Stack
          </div>

          <div
            aria-hidden="true"
            className="float absolute -right-14 bottom-[12%] w-52 rounded-2xl bg-ink p-4 text-on-ink shadow-xl [animation-delay:1900ms,3.5s] max-sm:-right-4 max-sm:w-44"
          >
            <p className="label text-[10px] opacity-60">Daily review · 3 today</p>
            <p className="mt-2 text-sm font-semibold leading-snug">Every module needs one obvious action.</p>
            <div className="mt-3 flex gap-2">
              <span className="label rounded-full bg-on-ink px-2.5 py-1 text-[10px] text-ink">Got it</span>
              <span className="label rounded-full border border-on-ink/30 px-2.5 py-1 text-[10px]">Again soon</span>
            </div>
          </div>
        </div>
      </div>

      <a href="#problem" className="rise absolute bottom-4 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 [animation-delay:1600ms] md:flex" aria-label="Scroll to the story">
        <span className="label text-[10px] text-muted">Scroll</span>
        <span className="h-10 w-px overflow-hidden bg-rule">
          <span className="cue block h-full w-full bg-ink" />
        </span>
      </a>
    </section>
  );
}

function Problem() {
  return (
    <section id="problem" className="scroll-mt-16 border-y border-line bg-paper-2">
      <div className="reveal mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <p className="label text-xs text-muted">The problem</p>
        <p className="mt-5 font-serif text-3xl italic leading-snug sm:text-5xl">
          You read a lot. A week later, you remember almost none of it.
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          Bookmarks pile up and highlights stay buried. Stack is built around one habit: keep the lines that matter,
          and see them again before you forget them.
        </p>
      </div>
    </section>
  );
}

function FirstMinute() {
  return (
    <section id="first-minute" className="scroll-mt-16 mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="reveal">
        <p className="label text-xs text-muted">When you open the app</p>
        <h2 className="display mt-3 text-6xl sm:text-8xl">YOUR FIRST MINUTE</h2>
        <p className="mt-5 max-w-2xl text-lg text-prose">The same four steps you’ll see on your phone, in the same order.</p>
      </div>
      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FIRST_MINUTE.map((s, i) => (
          <li key={s.n} className="reveal relative rounded-3xl border border-rule bg-card p-6">
            <p className="label text-[11px] font-medium text-muted">Step {s.n}</p>
            <h3 className="mt-8 text-2xl font-extrabold tracking-tight">{s.title}</h3>
            <p className="mt-2 text-muted">{s.body}</p>
            {i < FIRST_MINUTE.length - 1 && (
              <span aria-hidden="true" className="label absolute -right-3 top-1/2 z-10 hidden size-6 -translate-y-1/2 place-items-center rounded-full bg-ink text-[11px] text-on-ink lg:grid">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Tour() {
  return (
    <section aria-labelledby="tour-title" className="border-y border-line bg-paper-2">
      <div className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28">
        <div className="reveal">
          <p className="label text-xs text-muted">Inside the app</p>
          <h2 id="tour-title" className="display mt-3 text-6xl sm:text-8xl">FIVE TABS</h2>
          <p className="mt-5 max-w-2xl text-lg text-prose">
            Stack has the same five tabs at the bottom of every screen. Here’s what’s in each one, in the same order.
          </p>
        </div>
      </div>

      {/* Phones: the tab bar sticks under the header, like the app's bottom bar. */}
      <div className="sticky top-16 z-30 mt-10 md:hidden">
        <TabNav layout="bar" />
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 sm:px-6 sm:pb-28 md:mt-12 md:grid-cols-[88px_1fr]">
        {/* Tablets and computers: a rail on the left, like the app on a tablet. */}
        <div className="hidden md:block">
          <div className="sticky top-28">
            <TabNav layout="rail" />
          </div>
        </div>

        <div>
          {TOUR.map((t, i) => (
            <article
              key={t.id}
              id={`tab-${t.id}`}
              className="grid scroll-mt-36 items-center gap-10 border-b border-rule py-16 first:pt-6 last:border-0 md:scroll-mt-24 md:grid-cols-[1fr_260px] md:gap-16"
            >
              <div className="reveal">
                <p className={`label text-[11px] font-medium ${t.text}`}>
                  0{i + 1} — {t.id}
                </p>
                <h3 className="display mt-4 text-6xl sm:text-7xl">{t.title}</h3>
                <p className="mt-5 max-w-lg text-lg text-prose">{t.lead}</p>
                <ul className="mt-6 grid max-w-lg gap-3">
                  {t.points.map((p) => (
                    <li key={p} className="flex gap-3 text-prose">
                      <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ink" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="reveal-phone mx-auto w-full max-w-[240px]">
                <PhoneShot light={t.shot.light} dark={t.shot.dark} alt={t.shot.alt} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LocalFirst() {
  const points = [
    { t: "Works offline, no account", b: "Notes, highlights, PDFs and saved articles live on your phone, readable without a connection. Sign in only if you want sync." },
    { t: "No ads, no trackers", b: "We don’t sell or share your data, and never will." },
    { t: "AI only when you ask", b: "Stack AI is optional, asks before any text leaves your phone, and turns off completely in Settings." },
    { t: "Open source", b: `Built in the open by ${SITE.maker}, made in India.` },
  ];
  return (
    <section className="bg-ink text-on-ink">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-24 md:grid-cols-[1fr_1.4fr]">
        <div className="reveal">
          <p className="label text-xs opacity-60">Your reading stays yours</p>
          <h2 className="display mt-3 text-6xl sm:text-7xl">LOCAL FIRST</h2>
        </div>
        <ul className="reveal grid gap-8 sm:grid-cols-2">
          {points.map((p) => (
            <li key={p.t} className="border-t border-on-ink/15 pt-4">
              <h3 className="text-lg font-bold">{p.t}</h3>
              <p className="mt-1 opacity-70">{p.b}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Join() {
  return (
    <section id="join" className="scroll-mt-16 mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-28 md:grid-cols-2">
      <div className="reveal">
        <Logo size={56} />
        <p className="label mt-8 text-xs text-muted">Soft launch</p>
        <h2 className="display mt-3 text-6xl sm:text-8xl">BE ONE OF THE FIRST</h2>
        <p className="mt-6 text-lg text-prose">
          We’re inviting a small group to use Stack before the public Play Store release. Join the list and we’ll
          send your invite by email.
        </p>
        <ul className="mt-8 grid gap-3">
          {["Early access to the Android app", "A direct line to the people building it", "Stack Plus free for a year when it arrives"].map((t) => (
            <li key={t} className="flex items-center gap-3">
              <span className="size-2.5 shrink-0 rounded-full bg-news" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-10 rounded-3xl border border-rule p-6">
          <p className="label text-[11px] font-medium">What happens next</p>
          <ol className="mt-4 grid gap-3">
            {[
              "Join the list here",
              "We email you an invite link",
              "Tap it, opt in, and install Stack from Google Play",
              "Open Stack: your first minute starts, as above",
            ].map((t, i) => (
              <li key={t} className="flex items-baseline gap-3 text-prose">
                <span className="label text-[11px] text-muted">0{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="reveal rounded-[2rem] border border-rule bg-card p-6 shadow-[0_20px_60px_rgb(0_0_0/0.06)] sm:p-8">
        <SignupForm />
      </div>
    </section>
  );
}

function Questions() {
  return (
    <section id="faq" className="border-t border-line bg-paper-2">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="reveal">
          <p className="label text-xs text-muted">Questions</p>
          <h2 className="display mt-3 text-6xl sm:text-8xl">FAQ</h2>
        </div>
        <div className="reveal mt-10 divide-y divide-rule border-y border-rule">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {f.q}
                <span className="label text-xl text-muted transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 text-prose">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
