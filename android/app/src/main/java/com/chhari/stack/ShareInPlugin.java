package com.chhari.stack;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * "Share to Stack". ShareActivity (the pop-up card over the other app) puts
 * each shared item in an inbox here; the web app imports the inbox with
 * takeInbox() when it starts or comes back, and whenever the "shared" event
 * says something new arrived. PDFs are copied into files/inbox/ until imported.
 */
@CapacitorPlugin(name = "ShareIn")
public class ShareInPlugin extends Plugin {

    static final String EXTRA_OPEN = "com.chhari.stack.OPEN_SHARED";
    private static final String PREFS = "stack_share_inbox";
    private static final String KEY = "items";
    private static final long MAX_PDF_BYTES = 200L * 1024 * 1024;

    private static volatile ShareInPlugin instance;
    /** Set when the card's "Open in Stack" launched the app. */
    private static volatile boolean openRequested = false;

    @Override
    public void load() {
        instance = this;
    }

    // ---- Called by ShareActivity ----

    /** Reads a share intent into an inbox item, or null if there's nothing usable. */
    static JSONObject itemFrom(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return null;
        String type = intent.getType() == null ? "" : intent.getType();
        try {
            JSONObject item = new JSONObject();
            item.put("at", System.currentTimeMillis());
            if (type.startsWith("text/")) {
                String text = intent.getStringExtra(Intent.EXTRA_TEXT);
                if (text == null || text.trim().isEmpty()) return null;
                item.put("kind", "text");
                item.put("text", text.length() > 20000 ? text.substring(0, 20000) : text);
                String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
                if (subject != null) item.put("subject", subject);
                return item;
            }
            if (type.equals("application/pdf")) {
                Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (uri == null) return null;
                File copy = copyPdf(context, uri);
                if (copy == null) return null;
                item.put("kind", "pdf");
                item.put("path", copy.getAbsolutePath());
                item.put("name", displayName(context, uri));
                return item;
            }
        } catch (Exception ignored) {
            // fall through
        }
        return null;
    }

    static synchronized void enqueue(Context context, JSONObject item) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray items = new JSONArray(prefs.getString(KEY, "[]"));
            items.put(item);
            prefs.edit().putString(KEY, items.toString()).apply();
        } catch (Exception ignored) {
            prefs.edit().putString(KEY, new JSONArray().put(item).toString()).apply();
        }
        ping();
    }

    // ---- Called by MainActivity ----

    /** The card's "Open in Stack" button starts MainActivity with EXTRA_OPEN. */
    static void handleOpen(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(EXTRA_OPEN, false)) return;
        intent.removeExtra(EXTRA_OPEN);
        openRequested = true;
        ping();
    }

    private static void ping() {
        ShareInPlugin plugin = instance;
        if (plugin != null) plugin.notifyListeners("shared", new JSObject());
    }

    // ---- Called from JavaScript ----

    /**
     * Everything waiting in the inbox, oldest first, and whether to show it.
     * Items stay until ackInbox() confirms they were saved, so a share isn't
     * lost if Android stops Stack in the middle of importing.
     */
    @PluginMethod
    public void takeInbox(PluginCall call) {
        JSArray out = new JSArray();
        synchronized (ShareInPlugin.class) {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            try {
                JSONArray items = new JSONArray(prefs.getString(KEY, "[]"));
                for (int i = 0; i < items.length(); i++) out.put(items.getJSONObject(i));
            } catch (Exception ignored) {
                prefs.edit().remove(KEY).apply(); // a broken inbox is dropped
            }
        }
        JSObject ret = new JSObject();
        ret.put("items", out);
        ret.put("open", openRequested);
        openRequested = false;
        call.resolve(ret);
    }

    /** Removes the oldest `count` items (new shares are appended, so they stay). */
    @PluginMethod
    public void ackInbox(PluginCall call) {
        int count = call.getInt("count", 0);
        synchronized (ShareInPlugin.class) {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            try {
                JSONArray items = new JSONArray(prefs.getString(KEY, "[]"));
                JSONArray rest = new JSONArray();
                for (int i = count; i < items.length(); i++) rest.put(items.get(i));
                prefs.edit().putString(KEY, rest.toString()).apply();
            } catch (Exception ignored) {
                prefs.edit().remove(KEY).apply();
            }
        }
        call.resolve();
    }

    /** Deletes an imported PDF copy (only inside files/inbox/). */
    @PluginMethod
    public void removeFile(PluginCall call) {
        String path = call.getString("path", "");
        File inbox = inboxDir(getContext());
        File f = new File(path);
        try {
            if (f.getCanonicalPath().startsWith(inbox.getCanonicalPath() + File.separator)) f.delete();
        } catch (Exception ignored) {
            // nothing to delete
        }
        call.resolve();
    }

    // ---- Files ----

    private static File inboxDir(Context context) {
        File dir = new File(context.getFilesDir(), "inbox");
        dir.mkdirs();
        return dir;
    }

    // The sender only lends us the file for a moment, so keep a copy until
    // the web app has imported it.
    private static File copyPdf(Context context, Uri uri) {
        File out = new File(inboxDir(context), "shared-" + System.nanoTime() + ".pdf");
        try (InputStream in = context.getContentResolver().openInputStream(uri);
             OutputStream os = new FileOutputStream(out)) {
            if (in == null) return null;
            byte[] buf = new byte[64 * 1024];
            long total = 0;
            int n;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > MAX_PDF_BYTES) throw new Exception("too large");
                os.write(buf, 0, n);
            }
            return out;
        } catch (Exception e) {
            out.delete();
            return null;
        }
    }

    static String displayName(Context context, Uri uri) {
        try (Cursor c = context.getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                String name = c.getString(0);
                if (name != null) return name;
            }
        } catch (Exception ignored) {
            // fall through
        }
        return "Shared PDF.pdf";
    }
}
