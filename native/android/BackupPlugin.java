package com.chhari.stack;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Saves a Stack backup where the person chooses (Android's "Save to" picker),
 * written in pieces so a backup with PDFs never has to cross the bridge at once.
 * See src/lib/backup.ts.
 */
@CapacitorPlugin(name = "Backup")
public class BackupPlugin extends Plugin {

    @PluginMethod
    public void create(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("name", "stack-backup.json"));
        startActivityForResult(call, intent, "created");
    }

    @ActivityCallback
    private void created(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("cancelled", "CANCELLED");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("uri", data.getData().toString());
        call.resolve(ret);
    }

    /** Writes text to the file: "wt" replaces it, "wa" adds to the end. */
    @PluginMethod
    public void write(PluginCall call) {
        String uri = call.getString("uri");
        String text = call.getString("text", "");
        boolean append = Boolean.TRUE.equals(call.getBoolean("append", false));
        if (uri == null) {
            call.reject("uri missing");
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(Uri.parse(uri), append ? "wa" : "wt")) {
            if (out == null) throw new java.io.IOException("can't open file");
            out.write(text.getBytes(StandardCharsets.UTF_8));
            call.resolve();
        } catch (Exception e) {
            call.reject("write failed: " + e.getMessage());
        }
    }
}
