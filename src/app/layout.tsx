import type { Metadata, Viewport } from "next";
import { Archivo, Bodoni_Moda, IBM_Plex_Mono } from "next/font/google";
import { SpotifyProvider } from "@/components/spotify-provider";
import { ToastProvider } from "@/components/toast";
import { NativeBoot } from "@/components/native-boot";
import { NavRail } from "@/components/tab-bar";
import { LocalMusicProvider } from "@/components/local-music-provider";
import { FocusProvider } from "@/components/focus-provider";
import { AccountProvider } from "@/components/account-provider";
import { FirstRun } from "@/components/first-run";
import { StatusScrim } from "@/components/status-scrim";
import { THEME_BOOT } from "@/lib/theme-boot";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Stack",
  description: "News, your music, PDFs and notes in one place.",
};

export const viewport: Viewport = {
  themeColor: "#F7F5F0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      // data-theme is set before hydration by THEME_BOOT.
      suppressHydrationWarning
      // Lets Next turn smooth scrolling off while it changes pages.
      data-scroll-behavior="smooth"
      className={`${archivo.variable} ${bodoni.variable} ${plexMono.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <SpotifyProvider>
          <LocalMusicProvider>
            <ToastProvider>
              <AccountProvider>
              <FocusProvider>
              <NativeBoot />
              <FirstRun />
              <NavRail />
              <StatusScrim />
              {/* Phones: one column (centred on the "desk" on wide screens without the rail).
                  Tablets (768px+): full width beside the navigation rail. */}
              <div className="relative mx-auto min-h-dvh w-full max-w-[480px] bg-paper pt-[env(safe-area-inset-top)] shadow-[0_0_60px_rgba(0,0,0,.06)] md:max-w-none md:pl-[var(--rail)] md:shadow-none">
                {children}
              </div>
              </FocusProvider>
              </AccountProvider>
            </ToastProvider>
          </LocalMusicProvider>
        </SpotifyProvider>
      </body>
    </html>
  );
}
