package com.chhari.stack;

import android.graphics.Bitmap;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.spotify.android.appremote.api.ConnectionParams;
import com.spotify.android.appremote.api.Connector;
import com.spotify.android.appremote.api.SpotifyAppRemote;
import com.spotify.protocol.client.CallResult;
import com.spotify.protocol.client.Subscription;
import com.spotify.protocol.types.Artist;
import com.spotify.protocol.types.Empty;
import com.spotify.protocol.types.Image;
import com.spotify.protocol.types.PlayerContext;
import com.spotify.protocol.types.PlayerState;
import com.spotify.protocol.types.Track;
import java.io.File;
import java.io.FileOutputStream;

/**
 * Spotify inside Stack via Spotify's App Remote SDK: Stack connects to the
 * Spotify app on the phone (which runs in the background, it doesn't open)
 * and controls playback directly, so there's never a "no active device".
 *
 * Needs, in the Spotify developer dashboard: the Android package
 * com.chhari.stack with this APK's SHA1 signing fingerprint, and the redirect
 * URI com.chhari.stack://callback.
 */
@CapacitorPlugin(name = "SpotifyRemote")
public class SpotifyRemotePlugin extends Plugin {

    private static final String REDIRECT = "com.chhari.stack://callback";

    private SpotifyAppRemote remote;
    private Subscription<PlayerState> stateSub;
    private Subscription<PlayerContext> contextSub;
    private JSObject lastState = new JSObject();
    private String contextTitle = "";
    private String contextUri = "";

    @PluginMethod
    public void isInstalled(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("installed", SpotifyAppRemote.isSpotifyInstalled(getContext()));
        call.resolve(ret);
    }

    /** Connects (the first time, Spotify shows a one-tap "Agree" screen). */
    @PluginMethod
    public void connect(PluginCall call) {
        String clientId = call.getString("clientId");
        if (clientId == null || clientId.isEmpty()) {
            call.reject("No Spotify Client ID", "NO_CLIENT_ID");
            return;
        }
        if (remote != null && remote.isConnected()) {
            call.resolve(lastState);
            return;
        }
        if (!SpotifyAppRemote.isSpotifyInstalled(getContext())) {
            call.reject("The Spotify app isn't installed", "NOT_INSTALLED");
            return;
        }
        ConnectionParams params = new ConnectionParams.Builder(clientId).setRedirectUri(REDIRECT).showAuthView(true).build();
        getActivity().runOnUiThread(() ->
            SpotifyAppRemote.connect(getContext(), params, new Connector.ConnectionListener() {
                @Override
                public void onConnected(SpotifyAppRemote appRemote) {
                    remote = appRemote;
                    subscribe();
                    JSObject ret = new JSObject();
                    ret.put("connected", true);
                    call.resolve(ret);
                }

                @Override
                public void onFailure(Throwable error) {
                    remote = null;
                    // e.g. UserNotAuthorizedException, NotLoggedInException,
                    // CouldNotFindSpotifyApp, AuthenticationFailedException
                    call.reject(String.valueOf(error.getMessage()), error.getClass().getSimpleName());
                    JSObject ev = new JSObject();
                    ev.put("connected", false);
                    notifyListeners("state", ev);
                }
            })
        );
    }

    private void subscribe() {
        stateSub = remote.getPlayerApi().subscribeToPlayerState();
        stateSub.setEventCallback(state -> {
            lastState = toJs(state);
            notifyListeners("state", lastState);
        });
        contextSub = remote.getPlayerApi().subscribeToPlayerContext();
        contextSub.setEventCallback(ctx -> {
            contextTitle = ctx.title == null ? "" : ctx.title;
            contextUri = ctx.uri == null ? "" : ctx.uri;
            lastState.put("contextTitle", contextTitle);
            lastState.put("contextUri", contextUri);
            notifyListeners("state", lastState);
        });
    }

    private JSObject toJs(PlayerState s) {
        JSObject o = new JSObject();
        o.put("connected", true);
        o.put("paused", s.isPaused);
        o.put("position", s.playbackPosition);
        o.put("contextTitle", contextTitle);
        o.put("contextUri", contextUri);
        if (s.playbackOptions != null) {
            o.put("shuffle", s.playbackOptions.isShuffling);
            o.put("repeat", s.playbackOptions.repeatMode);
        }
        if (s.playbackRestrictions != null) {
            o.put("canSkipNext", s.playbackRestrictions.canSkipNext);
            o.put("canSkipPrev", s.playbackRestrictions.canSkipPrev);
            o.put("canSeek", s.playbackRestrictions.canSeek);
        }
        Track t = s.track;
        if (t != null) {
            o.put("uri", t.uri);
            o.put("name", t.name);
            o.put("duration", t.duration);
            StringBuilder artists = new StringBuilder();
            if (t.artists != null) {
                for (Artist a : t.artists) {
                    if (artists.length() > 0) artists.append(", ");
                    artists.append(a.name);
                }
            } else if (t.artist != null) artists.append(t.artist.name);
            o.put("artists", artists.toString());
            o.put("album", t.album != null ? t.album.name : "");
            o.put("imageUri", t.imageUri != null ? t.imageUri.raw : "");
        }
        return o;
    }

    private boolean ready(PluginCall call) {
        if (remote == null || !remote.isConnected()) {
            call.reject("Not connected to Spotify", "NOT_CONNECTED");
            return false;
        }
        return true;
    }

    private void done(PluginCall call, CallResult<Empty> r) {
        r.setResultCallback(e -> call.resolve()).setErrorCallback(err -> call.reject(String.valueOf(err.getMessage()), err.getClass().getSimpleName()));
    }

    @PluginMethod
    public void getState(PluginCall call) {
        JSObject ret = new JSObject(lastState.toString().isEmpty() ? "{}" : "{}");
        if (remote == null || !remote.isConnected()) {
            ret.put("connected", false);
            call.resolve(ret);
            return;
        }
        remote.getPlayerApi().getPlayerState().setResultCallback(s -> {
            lastState = toJs(s);
            call.resolve(lastState);
        }).setErrorCallback(err -> call.reject(String.valueOf(err.getMessage())));
    }

    /** Plays a track, album, playlist or artist URI; `index` starts a playlist/album at that track. */
    @PluginMethod
    public void play(PluginCall call) {
        if (!ready(call)) return;
        String uri = call.getString("uri", "");
        Integer index = call.getInt("index");
        if (index != null && index > 0) done(call, remote.getPlayerApi().skipToIndex(uri, index));
        else done(call, remote.getPlayerApi().play(uri));
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (ready(call)) done(call, remote.getPlayerApi().pause());
    }

    @PluginMethod
    public void resume(PluginCall call) {
        if (ready(call)) done(call, remote.getPlayerApi().resume());
    }

    @PluginMethod
    public void next(PluginCall call) {
        if (ready(call)) done(call, remote.getPlayerApi().skipNext());
    }

    @PluginMethod
    public void previous(PluginCall call) {
        if (ready(call)) done(call, remote.getPlayerApi().skipPrevious());
    }

    @PluginMethod
    public void seek(PluginCall call) {
        if (ready(call)) done(call, remote.getPlayerApi().seekTo(call.getLong("position", 0L)));
    }

    @PluginMethod
    public void setShuffle(PluginCall call) {
        if (ready(call)) done(call, remote.getPlayerApi().setShuffle(Boolean.TRUE.equals(call.getBoolean("on", false))));
    }

    /** Album art for an image URI, saved as a cached JPEG. */
    @PluginMethod
    public void image(PluginCall call) {
        if (!ready(call)) return;
        String raw = call.getString("imageUri", "");
        if (raw.isEmpty()) {
            call.resolve(new JSObject());
            return;
        }
        File dir = new File(getContext().getCacheDir(), "spotify-art");
        dir.mkdirs();
        File out = new File(dir, Integer.toHexString(raw.hashCode()) + ".jpg");
        if (out.exists()) {
            JSObject ret = new JSObject();
            ret.put("path", out.getAbsolutePath());
            call.resolve(ret);
            return;
        }
        remote.getImagesApi().getImage(new com.spotify.protocol.types.ImageUri(raw), Image.Dimension.LARGE)
            .setResultCallback(bmp -> {
                JSObject ret = new JSObject();
                try (FileOutputStream os = new FileOutputStream(out)) {
                    bmp.compress(Bitmap.CompressFormat.JPEG, 88, os);
                    ret.put("path", out.getAbsolutePath());
                } catch (Exception ignored) {}
                call.resolve(ret);
            })
            .setErrorCallback(err -> call.resolve(new JSObject()));
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        release();
        call.resolve();
    }

    private void release() {
        if (stateSub != null) stateSub.cancel();
        if (contextSub != null) contextSub.cancel();
        stateSub = null;
        contextSub = null;
        if (remote != null) SpotifyAppRemote.disconnect(remote);
        remote = null;
    }

    @Override
    protected void handleOnDestroy() {
        release();
    }
}
