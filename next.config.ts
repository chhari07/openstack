import type { NextConfig } from "next";

// `STACK_TARGET=apk next build` makes a static bundle for the Android app
// (see build-apk.sh). The app has no server, so API routes (route.ts) are left
// out by only treating .tsx files as routes; the app fetches news itself.
const apk = process.env.STACK_TARGET === "apk";

const nextConfig: NextConfig = apk
  ? {
      output: "export",
      pageExtensions: ["tsx"],
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
