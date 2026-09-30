package com.chhari.stack;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Breaking-news alerts, run by WorkManager about every 30 minutes (see
 * NewsAlertsPlugin). Reads the RSS feeds of the topics you picked and, when a
 * story newer than anything seen before appears, shows one notification that
 * opens it in Stack's reader. At most one alert an hour, and the first check
 * only notes what's there, so turning alerts on never floods you.
 */
public class NewsAlertWorker extends Worker {

    static final String PREFS = "stack_news_alerts";
    static final String CHANNEL = "news_alerts";
    private static final long HOUR = 3_600_000L;
    private static final int NOTIFICATION_ID = 7301;

    public NewsAlertWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    private static final class Story {
        String source, title, link;
        long at;
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean test = getInputData().getBoolean("test", false);
        if (!prefs.getBoolean("on", false) && !test) return Result.success();

        long lastSeen = prefs.getLong("lastSeen", 0);
        Story newest = null;
        long maxSeen = lastSeen;
        try {
            JSONArray feeds = new JSONArray(prefs.getString("feeds", "[]"));
            for (int i = 0; i < feeds.length(); i++) {
                JSONObject f = feeds.getJSONObject(i);
                String xml = fetch(f.getString("url"));
                if (xml == null) continue;
                for (Story s : parse(xml, f.getString("source"))) {
                    maxSeen = Math.max(maxSeen, s.at);
                    if ((test || s.at > lastSeen) && (newest == null || s.at > newest.at)) newest = s;
                }
            }
        } catch (Exception e) {
            return Result.retry();
        }

        long now = System.currentTimeMillis();
        prefs.edit().putLong("lastSeen", Math.min(maxSeen, now)).apply();
        if (newest == null) return Result.success();
        boolean firstCheck = lastSeen == 0;
        boolean recent = now - newest.at < 3 * HOUR;
        boolean quiet = now - prefs.getLong("lastNotified", 0) < HOUR;
        if (test || (!firstCheck && recent && !quiet)) {
            notify(ctx, newest, test);
            if (!test) prefs.edit().putLong("lastNotified", now).apply();
        }
        return Result.success();
    }

    private static String fetch(String url) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(10_000);
            c.setReadTimeout(10_000);
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (compatible; Stack/0.1; news reader)");
            if (c.getResponseCode() != 200) return null;
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0 && out.size() < 2_000_000) out.write(buf, 0, n);
                return out.toString("UTF-8");
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static final Pattern ITEM = Pattern.compile("<item[\\s>][\\s\\S]*?</item>", Pattern.CASE_INSENSITIVE);

    private static String tag(String item, String name) {
        Matcher m = Pattern.compile("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", Pattern.CASE_INSENSITIVE).matcher(item);
        if (!m.find()) return null;
        return decode(m.group(1).replaceAll("<!\\[CDATA\\[|\\]\\]>", "")).replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim();
    }

    private static String decode(String s) {
        return s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&#39;", "'").replace("&nbsp;", " ").replace("&amp;", "&");
    }

    private static java.util.List<Story> parse(String xml, String source) {
        java.util.List<Story> out = new java.util.ArrayList<>();
        Matcher m = ITEM.matcher(xml);
        while (m.find() && out.size() < 15) {
            String item = m.group();
            Story s = new Story();
            s.source = source;
            s.title = tag(item, "title");
            s.link = tag(item, "link");
            if (s.link == null || s.link.isEmpty()) s.link = tag(item, "guid");
            s.at = date(tag(item, "pubDate"));
            if (s.title == null || s.link == null || !s.link.startsWith("https://") || s.at == 0) continue;
            // Same clean-up as the news list (lib/news.ts), so the story opens with the same id.
            if (s.link.contains("at_medium=RSS") || s.link.contains("traffic_source")) s.link = s.link.replaceAll("[?#].*$", "");
            out.add(s);
        }
        return out;
    }

    private static long date(String s) {
        if (s == null) return 0;
        for (String f : new String[] { "EEE, dd MMM yyyy HH:mm:ss Z", "EEE, dd MMM yyyy HH:mm:ss zzz", "EEE, d MMM yyyy HH:mm:ss Z" }) {
            try {
                Date d = new SimpleDateFormat(f, Locale.US).parse(s.trim());
                if (d != null) return d.getTime();
            } catch (Exception ignored) {}
        }
        return 0;
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Breaking news", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("New top stories from the topics you picked");
        nm.createNotificationChannel(ch);
    }

    private static void notify(Context ctx, Story s, boolean test) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        ensureChannel(ctx);
        // Opens Stack's reader: com.chhari.stack://open?href=/read?id=web-<base64url of the link>
        String id = "web-" + Base64.encodeToString(s.link.getBytes(StandardCharsets.UTF_8), Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("com.chhari.stack://open?href=" + Uri.encode("/read?id=" + id)));
        open.setClass(ctx, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_stack)
            .setColor(Color.parseColor("#0A8A3A"))
            .setContentTitle(s.title)
            .setContentText((test ? "Test alert · " : "") + s.source + " · tap to read")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(s.title))
            .setSubText("Breaking news")
            .setWhen(s.at)
            .setShowWhen(true)
            .setContentIntent(pi)
            .setAutoCancel(true);
        try {
            NotificationManagerCompat.from(ctx).notify(NOTIFICATION_ID, b.build());
        } catch (SecurityException ignored) {}
    }
}
