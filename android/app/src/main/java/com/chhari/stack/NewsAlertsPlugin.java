package com.chhari.stack;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.TimeUnit;

/** Turns breaking-news alerts (NewsAlertWorker) on or off, for the feeds of the topics you picked. */
@CapacitorPlugin(name = "NewsAlerts")
public class NewsAlertsPlugin extends Plugin {

    private static final String WORK = "news-alerts";

    /** { on, feeds: [{ source, url }] } */
    @PluginMethod
    public void configure(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        JSArray feeds = call.getArray("feeds", new JSArray());
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(NewsAlertWorker.PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor edit = prefs.edit().putBoolean("on", on);
        // New topics: start from what's there now instead of alerting on old stories.
        if (!feeds.toString().equals(prefs.getString("feeds", ""))) edit.putString("feeds", feeds.toString()).putLong("lastSeen", 0);
        edit.apply();

        WorkManager wm = WorkManager.getInstance(ctx);
        if (on && feeds.length() > 0) {
            NewsAlertWorker.ensureChannel(ctx);
            PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(NewsAlertWorker.class, 30, TimeUnit.MINUTES)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build();
            wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, req);
        } else {
            wm.cancelUniqueWork(WORK);
        }
        call.resolve();
    }

    /** Shows the newest story now, to check alerts work. */
    @PluginMethod
    public void test(PluginCall call) {
        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(NewsAlertWorker.class)
            .setInputData(new Data.Builder().putBoolean("test", true).build())
            .build();
        WorkManager.getInstance(getContext()).enqueue(req);
        call.resolve();
    }
}
