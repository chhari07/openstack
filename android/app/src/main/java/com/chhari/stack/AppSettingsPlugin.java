package com.chhari.stack;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Opens other apps' screens: Stack's page in Android Settings, and the Spotify app. */
@CapacitorPlugin(name = "AppSettings")
public class AppSettingsPlugin extends Plugin {

    private static final String SPOTIFY = "com.spotify.music";

    @PluginMethod
    public void open(PluginCall call) {
        String page = call.getString("page", "app");
        Intent intent;
        if ("notifications".equals(page) && Build.VERSION.SDK_INT >= 26) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(intent);
        call.resolve();
    }

    /**
     * Starts the Spotify app so it shows up as a Spotify Connect device Stack can
     * control. With a "spotify:…" uri it opens straight to that playlist/album.
     */
    @PluginMethod
    public void openSpotify(PluginCall call) {
        JSObject ret = new JSObject();
        String uri = call.getString("uri");
        Intent intent = null;
        if (uri != null && uri.startsWith("spotify:")) {
            intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri)).setPackage(SPOTIFY);
        }
        if (intent == null || intent.resolveActivity(getContext().getPackageManager()) == null) {
            intent = getContext().getPackageManager().getLaunchIntentForPackage(SPOTIFY);
        }
        if (intent == null) {
            ret.put("opened", false); // Spotify isn't installed
            call.resolve(ret);
            return;
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getActivity().startActivity(intent);
            ret.put("opened", true);
        } catch (ActivityNotFoundException e) {
            ret.put("opened", false);
        }
        call.resolve(ret);
    }
}
