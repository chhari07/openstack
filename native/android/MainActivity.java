package com.chhari.stack;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.os.SystemClock;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Set by SplashPlugin once the web app has painted its first screen. */
    static volatile boolean webReady = false;

    private static final long MAX_SPLASH_MS = 4000;
    // Let the logo animation (blocks dropping in, ~0.8 s) finish.
    private static final long MIN_SPLASH_MS = 850;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The animated Stack logo on the paper background (styles.xml), kept up
        // until the web app is ready so there's no blank flash (0.85–4 s).
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        long start = SystemClock.uptimeMillis();
        webReady = false;
        splash.setKeepOnScreenCondition(() -> {
            long elapsed = SystemClock.uptimeMillis() - start;
            return elapsed < MIN_SPLASH_MS || (!webReady && elapsed < MAX_SPLASH_MS);
        });

        // Phones stay portrait; tablets (600dp+) can rotate freely.
        boolean tablet = getResources().getConfiguration().smallestScreenWidthDp >= 600;
        setRequestedOrientation(tablet ? ActivityInfo.SCREEN_ORIENTATION_FULL_USER : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

        registerPlugin(SplashPlugin.class);
        registerPlugin(AppSettingsPlugin.class);
        registerPlugin(PhoneFilesPlugin.class);
        registerPlugin(LocalMusicPlugin.class);
        registerPlugin(ShareInPlugin.class);
        registerPlugin(GoogleSignInPlugin.class);
        super.onCreate(savedInstanceState);
        // Opened by the share card's "Open in Stack" (not on a rotation/recreate).
        if (savedInstanceState == null) ShareInPlugin.handleOpen(getIntent());
    }

    // "Open in Stack" while Stack was already running.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ShareInPlugin.handleOpen(intent);
    }
}
