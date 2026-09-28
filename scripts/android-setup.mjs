// Applies Stack's changes to the generated android/ project. Safe to run
// again: every step checks whether it's already done.
import { cpSync, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";

const res = "android/app/src/main/res";
const patch = (path, fn) => writeFileSync(path, fn(readFileSync(path, "utf8")));

// 1. Icons: launcher icon, white notification icon (ic_stat_stack) and the
//    animated splash logo (drawable/splash_icon.xml). Older builds had PNG
//    splash icons, which would override the animated one, so remove them.
for (const dir of readdirSync(res)) {
  if (dir.startsWith("drawable") && existsSync(`${res}/${dir}/splash_icon.png`)) rmSync(`${res}/${dir}/splash_icon.png`);
}
cpSync("resources/android", res, { recursive: true });
mkdirSync(`${res}/values`, { recursive: true });
mkdirSync(`${res}/values-night`, { recursive: true });
writeFileSync(
  `${res}/values/stack_colors.xml`,
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#F7F5F0</color>
    <color name="splash_background">#F7F5F0</color>
    <color name="splash_ink">#111111</color>
</resources>
`,
);
writeFileSync(
  `${res}/values-night/stack_colors.xml`,
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="splash_background">#141413</color>
    <color name="splash_ink">#F1EFE9</color>
</resources>
`,
);
// The generated project may also define ic_launcher_background; keep one copy.
if (existsSync(`${res}/values/ic_launcher_background.xml`)) {
  writeFileSync(`${res}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources/>\n`);
}

// See-through window for the "Saved to Stack" share card (ShareActivity).
writeFileSync(
  `${res}/values/stack_share.xml`,
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="StackShareCard" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:windowIsTranslucent">true</item>
        <item name="android:windowBackground">@android:color/transparent</item>
        <item name="android:windowNoTitle">true</item>
        <item name="android:backgroundDimEnabled">false</item>
        <item name="android:windowAnimationStyle">@null</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
    </style>
</resources>
`,
);

// 2. Splash screen (androidx core-splashscreen; MainActivity installs it).
patch(`${res}/values/styles.xml`, (s) =>
  s.replace(
    /<style name="AppTheme\.NoActionBarLaunch" parent="Theme\.SplashScreen">[\s\S]*?<\/style>/,
    `<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/splash_background</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="windowSplashScreenAnimationDuration">800</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`,
  ),
);

// 3. Native code: plugins, the playback service and the activity.
cpSync("native/android", "android/app/src/main/java/com/chhari/stack", { recursive: true });

// 4. Media3 for local music playback.
patch("android/app/build.gradle", (s) =>
  s.includes("androidx.media3:media3-exoplayer")
    ? s
    : s.replace(
        "    implementation project(':capacitor-android')",
        `    implementation project(':capacitor-android')
    // Local music playback with a media notification (PlaybackService)
    implementation "androidx.media3:media3-exoplayer:1.8.0"
    implementation "androidx.media3:media3-session:1.8.0"`,
      ),
);

// Android's Google account picker (Credential Manager) for "Continue with Google".
patch("android/app/build.gradle", (s) =>
  s.includes("androidx.credentials:credentials")
    ? s
    : s.replace(
        "    implementation project(':capacitor-android')",
        `    implementation project(':capacitor-android')
    // "Continue with Google" (native account picker, GoogleSignInPlugin)
    implementation "androidx.credentials:credentials:1.5.0"
    implementation "androidx.credentials:credentials-play-services-auth:1.5.0"
    implementation "com.google.android.libraries.identity.googleid:googleid:1.1.1"`,
      ),
);

// 5. Manifest.
const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = readFileSync(manifestPath, "utf8");
// Spotify login comes back through com.chhari.stack://callback.
if (!manifest.includes('android:scheme="com.chhari.stack"')) {
  manifest = manifest.replace(
    /(<category android:name="android\.intent\.category\.LAUNCHER" \/>\s*<\/intent-filter>)/,
    `$1

            <!-- Spotify login redirect -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="com.chhari.stack" android:host="callback" />
            </intent-filter>`,
  );
}
// "Share to Stack": other apps' share sheets open ShareActivity, a card over
// that app (see-through window, its own task, so Stack doesn't come forward).
// An earlier build put these filters on MainActivity; take them off it.
manifest = manifest.replace(
  /\s*<!-- Share to Stack: links and text, and PDFs -->\s*<intent-filter android:label="Save to Stack">[\s\S]*?application\/pdf" \/>\s*<\/intent-filter>/,
  "",
);
if (!manifest.includes(".ShareActivity")) {
  manifest = manifest.replace(
    /(\n\s*<provider)/,
    `

        <!-- Share to Stack: links and text, and PDFs -->
        <activity
            android:name=".ShareActivity"
            android:label="Save to Stack"
            android:exported="true"
            android:theme="@style/StackShareCard"
            android:taskAffinity=""
            android:excludeFromRecents="true"
            android:noHistory="true">
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="application/pdf" />
            </intent-filter>
        </activity>$1`,
  );
}
// (An earlier build added a com.chhari.stack://auth link for browser Google
// sign-in; the app now uses the native account picker, so drop it.)
manifest = manifest.replace(/\n\s*<data android:scheme="com\.chhari\.stack" android:host="auth" \/>/, "");
// Orientation is set in MainActivity (phones portrait, tablets rotate), so
// drop the old manifest lock if an earlier build added it.
manifest = manifest.replace(/\n\s*android:screenOrientation="portrait"/, "");
// Background music service with its media notification.
if (!manifest.includes(".PlaybackService")) {
  manifest = manifest.replace(
    "</application>",
    `    <service
            android:name=".PlaybackService"
            android:exported="true"
            android:foregroundServiceType="mediaPlayback">
            <intent-filter>
                <action android:name="androidx.media3.session.MediaSessionService" />
            </intent-filter>
        </service>
    </application>`,
  );
}
// Android 11+ hides other apps unless declared: Stack needs to find Spotify to open it.
if (!manifest.includes('<package android:name="com.spotify.music"')) {
  manifest = manifest.replace(
    "</manifest>",
    `    <queries>\n        <package android:name="com.spotify.music" />\n    </queries>\n</manifest>`,
  );
}
const permissions = [
  '<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />',
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  // "All files access": lets Stack find every PDF and song on the phone (user-granted in Settings).
  '<uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />',
];
for (const p of permissions) {
  const name = p.match(/android:name="([^"]+)"/)[1];
  if (!manifest.includes(`"${name}"`)) manifest = manifest.replace("</manifest>", `    ${p}\n</manifest>`);
}
writeFileSync(manifestPath, manifest);

if (!existsSync(`${res}/mipmap-xxxhdpi/ic_launcher.png`)) throw new Error("icons not copied");
console.log("android project patched");
