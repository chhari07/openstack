package com.chhari.stack;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * PDFs on the phone, two ways:
 * - "All files access" (the user turns it on in Android Settings): Stack scans
 *   the whole shared storage, including Download.
 * - Or ONE folder the user picks with Android's folder picker (Storage Access
 *   Framework), for people who don't want to grant all-files access.
 */
@CapacitorPlugin(
    name = "PhoneFiles",
    permissions = { @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE }) }
)
public class PhoneFilesPlugin extends Plugin {

    private static final int SCAN_MAX_DEPTH = 10;
    private static final int SCAN_MAX_FILES = 3000;

    // ---- All files access ----

    static boolean hasAllFiles(PhoneFilesPlugin p) {
        if (Build.VERSION.SDK_INT >= 30) return Environment.isExternalStorageManager();
        return p.getPermissionState("storage") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void allFilesStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasAllFiles(this));
        call.resolve(ret);
    }

    /**
     * Android 11+: opens the system "Allow access to manage all files" switch for
     * Stack (the app re-checks when it comes back). Older Android: the normal
     * storage permission prompt.
     */
    @PluginMethod
    public void requestAllFiles(PluginCall call) {
        if (hasAllFiles(this)) {
            allFilesStatus(call);
            return;
        }
        if (Build.VERSION.SDK_INT >= 30) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
            if (intent.resolveActivity(getContext().getPackageManager()) == null) {
                intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("granted", false);
            ret.put("openedSettings", true);
            call.resolve(ret);
        } else {
            requestPermissionForAlias("storage", call, "storageResult");
        }
    }

    @PermissionCallback
    private void storageResult(PluginCall call) {
        allFilesStatus(call);
    }

    /** Every PDF in shared storage (skips Android/ and hidden folders). */
    @PluginMethod
    public void scanPdfs(PluginCall call) {
        if (!hasAllFiles(this)) {
            call.reject("All files access is off", "NO_PERMISSION");
            return;
        }
        getBridge().execute(() -> {
            File root = Environment.getExternalStorageDirectory();
            JSArray out = new JSArray();
            scan(root, root, 0, out);
            JSObject ret = new JSObject();
            ret.put("files", out);
            call.resolve(ret);
        });
    }

    private void scan(File root, File dir, int depth, JSArray out) {
        File[] entries = dir.listFiles();
        if (entries == null) return;
        for (File f : entries) {
            if (out.length() >= SCAN_MAX_FILES) return;
            String name = f.getName();
            if (name.startsWith(".")) continue;
            if (f.isDirectory()) {
                if (depth == 0 && name.equals("Android")) continue; // other apps' private data
                if (depth < SCAN_MAX_DEPTH) scan(root, f, depth + 1, out);
            } else if (name.toLowerCase().endsWith(".pdf")) {
                String rel = f.getAbsolutePath().substring(root.getAbsolutePath().length() + 1);
                JSObject o = new JSObject();
                o.put("uri", f.getAbsolutePath()); // a file path; the web layer loads it via convertFileSrc
                o.put("name", name);
                o.put("path", rel);
                o.put("size", f.length());
                o.put("modified", f.lastModified());
                out.put(o);
            }
        }
    }

    private static final String PREFS = "stack.phonefiles";
    private static final String KEY_TREE = "tree";
    private static final int MAX_DEPTH = 3;
    private static final int MAX_FILES = 500;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private Uri savedTree() {
        String s = prefs().getString(KEY_TREE, null);
        if (s == null) return null;
        Uri uri = Uri.parse(s);
        // The user can revoke access in system settings; treat that as "no folder".
        for (UriPermission p : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (p.getUri().equals(uri) && p.isReadPermission()) return uri;
        }
        return null;
    }

    private String folderName(Uri tree) {
        String id = DocumentsContract.getTreeDocumentId(tree); // e.g. "primary:Download"
        int colon = id.lastIndexOf(':');
        String path = colon >= 0 ? id.substring(colon + 1) : id;
        return path.isEmpty() ? "Phone storage" : path;
    }

    @PluginMethod
    public void getFolder(PluginCall call) {
        Uri tree = savedTree();
        JSObject ret = new JSObject();
        if (tree != null) ret.put("name", folderName(tree));
        call.resolve(ret);
    }

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("cancelled", "CANCELLED");
            return;
        }
        Uri tree = data.getData();
        ContentResolver cr = getContext().getContentResolver();
        // Drop the previous folder's grant so we only ever hold one.
        Uri old = savedTree();
        if (old != null && !old.equals(tree)) {
            try {
                cr.releasePersistableUriPermission(old, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (SecurityException ignored) {}
        }
        cr.takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        prefs().edit().putString(KEY_TREE, tree.toString()).apply();
        JSObject ret = new JSObject();
        ret.put("name", folderName(tree));
        call.resolve(ret);
    }

    @PluginMethod
    public void forgetFolder(PluginCall call) {
        Uri tree = savedTree();
        if (tree != null) {
            try {
                getContext().getContentResolver().releasePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (SecurityException ignored) {}
        }
        prefs().edit().remove(KEY_TREE).apply();
        call.resolve();
    }

    /** PDFs in the chosen folder and its subfolders (up to 3 levels). */
    @PluginMethod
    public void listPdfs(PluginCall call) {
        Uri tree = savedTree();
        if (tree == null) {
            call.reject("No folder chosen", "NO_FOLDER");
            return;
        }
        getBridge().execute(() -> {
            JSArray files = new JSArray();
            try {
                walk(tree, DocumentsContract.getTreeDocumentId(tree), "", 0, files);
                JSObject ret = new JSObject();
                ret.put("files", files);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Couldn't read the folder: " + e.getMessage());
            }
        });
    }

    private void walk(Uri tree, String docId, String prefix, int depth, JSArray out) {
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, docId);
        String[] cols = {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED,
        };
        try (Cursor c = getContext().getContentResolver().query(children, cols, null, null, null)) {
            if (c == null) return;
            while (c.moveToNext() && out.length() < MAX_FILES) {
                String id = c.getString(0);
                String name = c.getString(1);
                String mime = c.getString(2);
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                    if (depth < MAX_DEPTH && !name.startsWith(".")) {
                        walk(tree, id, prefix + name + "/", depth + 1, out);
                    }
                } else if ("application/pdf".equals(mime) || name.toLowerCase().endsWith(".pdf")) {
                    JSObject f = new JSObject();
                    f.put("uri", DocumentsContract.buildDocumentUriUsingTree(tree, id).toString());
                    f.put("name", name);
                    f.put("path", prefix + name);
                    f.put("size", c.isNull(3) ? 0 : c.getLong(3));
                    f.put("modified", c.isNull(4) ? 0 : c.getLong(4));
                    out.put(f);
                }
            }
        }
    }

    /**
     * Copies one PDF into the app's cache so the web layer can load it with
     * fetch(Capacitor.convertFileSrc(path)). Only URIs inside the chosen folder
     * are accepted.
     */
    @PluginMethod
    public void copyToCache(PluginCall call) {
        String uriStr = call.getString("uri");
        Uri tree = savedTree();
        if (uriStr == null || tree == null) {
            call.reject("No folder chosen", "NO_FOLDER");
            return;
        }
        Uri uri = Uri.parse(uriStr);
        String treeId = DocumentsContract.getTreeDocumentId(tree);
        String prefix = treeId.endsWith(":") || treeId.endsWith("/") ? treeId : treeId + "/";
        String docId;
        try {
            docId = DocumentsContract.getDocumentId(uri);
        } catch (IllegalArgumentException e) {
            docId = "";
        }
        if (!tree.getAuthority().equals(uri.getAuthority()) || !docId.startsWith(prefix)) {
            call.reject("File is outside the chosen folder");
            return;
        }
        getBridge().execute(() -> {
            File dir = new File(getContext().getCacheDir(), "imports");
            dir.mkdirs();
            File out = new File(dir, "import-" + System.nanoTime() + ".pdf");
            try (InputStream in = getContext().getContentResolver().openInputStream(uri);
                 OutputStream os = new FileOutputStream(out)) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                JSObject ret = new JSObject();
                ret.put("path", out.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                out.delete();
                call.reject("Couldn't read the file: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void clearCache(PluginCall call) {
        File[] files = new File(getContext().getCacheDir(), "imports").listFiles();
        if (files != null) for (File f : files) f.delete();
        call.resolve();
    }
}
