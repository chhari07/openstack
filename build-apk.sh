#!/usr/bin/env bash
# Builds Stack.apk (debug-signed, installable) with the JDK + Android SDK in
# ~/.local/share/tipsy-toolchain (the same toolchain as TIPSY).
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"
TC="$HOME/.local/share/tipsy-toolchain"
export JAVA_HOME="$(ls -d "$TC"/jdk-* | head -1)"
export PATH="$JAVA_HOME/bin:$PATH"
export JAVA_TOOL_OPTIONS="-Djava.net.preferIPv4Stack=true" # Gradle downloads time out over IPv6 here

# Static web bundle → out/
rm -rf out
STACK_TARGET=apk npx next build

[ -d android ] || npx cap add android
echo "sdk.dir=$TC/sdk" > android/local.properties
node scripts/android-setup.mjs
npx cap sync android
(cd android && ./gradlew assembleDebug --console=plain -q)
cp android/app/build/outputs/apk/debug/app-debug.apk "$HOME/Desktop/Stack.apk"
echo "built: $HOME/Desktop/Stack.apk"
