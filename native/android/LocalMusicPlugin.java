package com.chhari.stack;

import android.Manifest;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Size;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.MoreExecutors;
import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Music stored on the phone: lists it from Android's media library (needs the
 * "Music and audio" permission) and controls PlaybackService, which plays it
 * in the background with a media notification.
 */
@CapacitorPlugin(
    name = "LocalMusic",
    permissions = {
        @Permission(alias = "audio", strings = { Manifest.permission.READ_MEDIA_AUDIO }),
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE }),
    }
)
public class LocalMusicPlugin extends Plugin {

    private ListenableFuture<MediaController> controllerFuture;
    private MediaController controller;

    // Android 13+ has a music-only permission; older versions use storage.
    private String alias() {
        return Build.VERSION.SDK_INT >= 33 ? "audio" : "storage";
    }

    @Override
    public void load() {
        SessionToken token = new SessionToken(getContext(), new ComponentName(getContext(), PlaybackService.class));
        controllerFuture = new MediaController.Builder(getContext(), token).buildAsync();
        controllerFuture.addListener(
            () -> {
                try {
                    controller = controllerFuture.get();
                    controller.addListener(
                        new Player.Listener() {
                            @Override
                            public void onEvents(Player player, Player.Events events) {
                                notifyListeners("state", state());
                            }
                        }
                    );
                } catch (Exception ignored) {}
            },
            MoreExecutors.directExecutor()
        );
    }

    @Override
    protected void handleOnDestroy() {
        if (controllerFuture != null) MediaController.releaseFuture(controllerFuture);
    }

    private interface WithController {
        void run(MediaController c) throws Exception;
    }

    // Player calls must happen on the main thread, after the controller connects.
    private void withController(PluginCall call, WithController fn) {
        controllerFuture.addListener(
            () -> {
                try {
                    fn.run(controllerFuture.get());
                } catch (Exception e) {
                    call.reject("Player error: " + e.getMessage());
                }
            },
            ContextCompatExecutor.main(getContext())
        );
    }

    // ---- Permission ----

    // "All files access" also covers music, so either permission is enough.
    private boolean allFiles() {
        return Build.VERSION.SDK_INT >= 30 && android.os.Environment.isExternalStorageManager();
    }

    private boolean canRead() {
        return allFiles() || getPermissionState(alias()) == PermissionState.GRANTED;
    }

    private String permissionState() {
        return canRead() ? "granted" : getPermissionState(alias()).toString();
    }

    @PluginMethod
    public void checkAudio(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("audio", permissionState());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestAudio(PluginCall call) {
        if (canRead()) {
            checkAudio(call);
            return;
        }
        requestPermissionForAlias(alias(), call, "audioPermissionResult");
    }

    @PermissionCallback
    private void audioPermissionResult(PluginCall call) {
        checkAudio(call);
    }

    // ---- Library ----

    @PluginMethod
    public void listTracks(PluginCall call) {
        if (!canRead()) {
            call.reject("Music permission not granted", "NO_PERMISSION");
            return;
        }
        getBridge().execute(() -> {
            JSArray tracks = new JSArray();
            Uri collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            String[] cols = {
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.DATE_ADDED,
            };
            // Songs only: skip ringtones, notification/alarm sounds and short clips.
            // Files Android hasn't fully scanned yet have NULL flags; keep those.
            String where =
                "(" + MediaStore.Audio.Media.IS_MUSIC + " != 0 OR " + MediaStore.Audio.Media.IS_MUSIC + " IS NULL)" +
                " AND (" + MediaStore.Audio.Media.DURATION + " IS NULL OR " + MediaStore.Audio.Media.DURATION + " >= 20000)" +
                " AND IFNULL(" + MediaStore.Audio.Media.IS_RINGTONE + ", 0) = 0" +
                " AND IFNULL(" + MediaStore.Audio.Media.IS_NOTIFICATION + ", 0) = 0" +
                " AND IFNULL(" + MediaStore.Audio.Media.IS_ALARM + ", 0) = 0";
            try (Cursor c = getContext().getContentResolver().query(collection, cols, where, null, MediaStore.Audio.Media.TITLE + " COLLATE NOCASE")) {
                while (c != null && c.moveToNext()) {
                    JSObject t = new JSObject();
                    t.put("uri", ContentUris.withAppendedId(collection, c.getLong(0)).toString());
                    t.put("title", c.getString(1));
                    String artist = c.getString(2);
                    t.put("artist", artist == null || artist.equals(MediaStore.UNKNOWN_STRING) ? "" : artist);
                    t.put("album", c.getString(3) == null ? "" : c.getString(3));
                    t.put("duration", c.getLong(4));
                    t.put("added", c.getLong(5) * 1000);
                    tracks.put(t);
                }
                JSObject ret = new JSObject();
                ret.put("tracks", tracks);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Couldn't read music: " + e.getMessage());
            }
        });
    }

    /** Album art for one track, as a cached JPEG path (or nothing). */
    @PluginMethod
    public void artwork(PluginCall call) {
        String uriStr = call.getString("uri", "");
        if (!uriStr.startsWith(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI.toString())) {
            call.reject("Not a music track");
            return;
        }
        getBridge().execute(() -> {
            JSObject ret = new JSObject();
            try {
                File dir = new File(getContext().getCacheDir(), "art");
                dir.mkdirs();
                File out = new File(dir, Integer.toHexString(uriStr.hashCode()) + ".jpg");
                if (!out.exists() && Build.VERSION.SDK_INT >= 29) {
                    Bitmap bmp = getContext().getContentResolver().loadThumbnail(Uri.parse(uriStr), new Size(512, 512), null);
                    try (FileOutputStream os = new FileOutputStream(out)) {
                        bmp.compress(Bitmap.CompressFormat.JPEG, 85, os);
                    }
                }
                if (out.exists()) ret.put("path", out.getAbsolutePath());
            } catch (Exception ignored) {
                // No embedded artwork.
            }
            call.resolve(ret);
        });
    }

    // ---- Playback ----

    private JSObject state() {
        JSObject s = new JSObject();
        MediaController c = controller;
        if (c == null) return s;
        MediaItem item = c.getCurrentMediaItem();
        s.put("playing", c.isPlaying() || (c.getPlayWhenReady() && c.getPlaybackState() == Player.STATE_BUFFERING));
        s.put("position", Math.max(0, c.getCurrentPosition()));
        long d = c.getDuration();
        s.put("duration", d > 0 ? d : 0);
        s.put("index", c.getCurrentMediaItemIndex());
        s.put("count", c.getMediaItemCount());
        s.put("hasNext", c.hasNextMediaItem());
        s.put("hasPrevious", c.hasPreviousMediaItem());
        s.put("shuffle", c.getShuffleModeEnabled());
        s.put("repeat", c.getRepeatMode() == Player.REPEAT_MODE_ALL ? "all" : c.getRepeatMode() == Player.REPEAT_MODE_ONE ? "one" : "off");
        if (item != null) {
            s.put("uri", item.mediaId);
            MediaMetadata m = item.mediaMetadata;
            s.put("title", m.title == null ? "" : m.title.toString());
            s.put("artist", m.artist == null ? "" : m.artist.toString());
            s.put("album", m.albumTitle == null ? "" : m.albumTitle.toString());
        }
        return s;
    }

    @PluginMethod
    public void getState(PluginCall call) {
        withController(call, c -> call.resolve(state()));
    }

    /** Replaces the queue with `tracks` and starts at `index`. */
    @PluginMethod
    public void play(PluginCall call) {
        JSArray arr = call.getArray("tracks");
        int index = call.getInt("index", 0);
        withController(call, c -> {
            List<MediaItem> items = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject t = arr.getJSONObject(i);
                String uri = t.getString("uri");
                if (!uri.startsWith("content://media/")) continue; // only the phone's music library
                items.add(
                    new MediaItem.Builder()
                        .setUri(uri)
                        .setMediaId(uri)
                        .setMediaMetadata(
                            new MediaMetadata.Builder()
                                .setTitle(t.optString("title"))
                                .setArtist(t.optString("artist"))
                                .setAlbumTitle(t.optString("album"))
                                .build()
                        )
                        .build()
                );
            }
            c.setMediaItems(items, Math.max(0, Math.min(index, items.size() - 1)), 0);
            c.prepare();
            c.play();
            call.resolve(state());
        });
    }

    @PluginMethod
    public void toggle(PluginCall call) {
        withController(call, c -> {
            if (c.isPlaying()) c.pause();
            else {
                if (c.getPlaybackState() == Player.STATE_ENDED) c.seekTo(0, 0);
                c.play();
            }
            call.resolve(state());
        });
    }

    @PluginMethod
    public void next(PluginCall call) {
        withController(call, c -> {
            c.seekToNext();
            call.resolve(state());
        });
    }

    @PluginMethod
    public void previous(PluginCall call) {
        withController(call, c -> {
            c.seekToPrevious();
            call.resolve(state());
        });
    }

    @PluginMethod
    public void seek(PluginCall call) {
        long ms = call.getLong("position", 0L);
        withController(call, c -> {
            c.seekTo(ms);
            call.resolve(state());
        });
    }

    @PluginMethod
    public void setShuffle(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        withController(call, c -> {
            c.setShuffleModeEnabled(on);
            call.resolve(state());
        });
    }

    @PluginMethod
    public void setRepeat(PluginCall call) {
        String mode = call.getString("mode", "off");
        withController(call, c -> {
            c.setRepeatMode("all".equals(mode) ? Player.REPEAT_MODE_ALL : "one".equals(mode) ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);
            call.resolve(state());
        });
    }
}
