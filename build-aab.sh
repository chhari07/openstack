#!/usr/bin/env bash
# Builds the Google Play version of Stack: a signed Android App Bundle (.aab).
# Differences from build-apk.sh (the sideloaded APK): no "All files access",
# Spotify only with your own Client ID, https-only networking, release signing.
# Needs android/keystore.properties (see docs/Stack_Launch_Guide.pdf, stage 4)
# and NEXT_PUBLIC_AI_URL set to the https address of the "ai" Supabase function
# in .env.local (or leave it empty to ship without AI). Bump "version" in package.json before each upload.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"
TC="$HOME/.local/share/tipsy-toolchain"
export JAVA_HOME="$(ls -d "$TC"/jdk-* | head -1)"
export PATH="$JAVA_HOME/bin:$PATH"
export JAVA_TOOL_OPTIONS="-Djava.net.preferIPv4Stack=true" # Gradle downloads time out over IPv6 here

[ -f android/keystore.properties ] || { echo "missing android/keystore.properties (the upload key)"; exit 1; }
ai_url="$(grep -E '^NEXT_PUBLIC_AI_URL=' .env.local 2>/dev/null | cut -d= -f2- || true)"
case "$ai_url" in
  ""|https://*) ;;
  *) echo "NEXT_PUBLIC_AI_URL must be https for the Play build (it is: $ai_url)"; exit 1 ;;
esac

# Static web bundle → out/
rm -rf out
STACK_TARGET=apk NEXT_PUBLIC_STACK_STORE=play npx next build

[ -d android ] || npx cap add android
echo "sdk.dir=$TC/sdk" > android/local.properties
STACK_STORE=play node scripts/android-setup.mjs
npx cap sync android
(cd android && ./gradlew bundleRelease --console=plain -q)
version="$(node -p 'require("./package.json").version')"
cp android/app/build/outputs/bundle/release/app-release.aab "$HOME/Desktop/Stack-$version.aab"
echo "built: $HOME/Desktop/Stack-$version.aab (upload it in Play Console)"
echo "note: the next ./build-apk.sh puts All files access back for the sideloaded APK"
