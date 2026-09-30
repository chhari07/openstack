package com.chhari.stack;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.DefaultMediaNotificationProvider;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/**
 * Plays music from the phone in the background. Media3 turns the session into
 * the standard media notification (play/pause/skip, seek bar, artwork) and
 * lock-screen / headphone / Bluetooth controls.
 */
public class PlaybackService extends MediaSessionService {

    private MediaSession session;

    // Sleep timer. It lives here rather than in the plugin so it still fires
    // after Stack is swiped away from recents.
    private static PlaybackService instance;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable sleepNow = () -> {
        sleepAt = 0;
        if (session != null) session.getPlayer().pause();
    };
    static long sleepAt; // ms since epoch, 0 = off
    static boolean sleepEndOfTrack;

    /** minutes > 0: pause after that long; endOfTrack: pause when this song ends; neither: off. */
    static void setSleep(long minutes, boolean endOfTrack) {
        PlaybackService s = instance;
        if (s == null) return;
        s.handler.removeCallbacks(s.sleepNow);
        sleepAt = minutes > 0 ? System.currentTimeMillis() + minutes * 60_000 : 0;
        sleepEndOfTrack = endOfTrack;
        if (sleepAt > 0) s.handler.postDelayed(s.sleepNow, minutes * 60_000);
        if (s.session != null) ((ExoPlayer) s.session.getPlayer()).setPauseAtEndOfMediaItems(endOfTrack);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        ExoPlayer player = new ExoPlayer.Builder(this)
            // Pause for calls and other apps' audio; duck for navigation prompts.
            .setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                true
            )
            // Pause when headphones are unplugged.
            .setHandleAudioBecomingNoisy(true)
            .build();

        // "End of song" sleep timer: after it pauses, go back to normal playback.
        player.addListener(
            new Player.Listener() {
                @Override
                public void onPlayWhenReadyChanged(boolean playWhenReady, int reason) {
                    if (reason == Player.PLAY_WHEN_READY_CHANGE_REASON_END_OF_MEDIA_ITEM && sleepEndOfTrack) {
                        setSleep(0, false);
                    }
                }
            }
        );

        // Tapping the notification opens Stack.
        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        // Stack's look in the notification and on the lock screen: the Stack
        // mark as the small icon, and the record artwork (StackArtwork).
        DefaultMediaNotificationProvider notifications = new DefaultMediaNotificationProvider(this);
        notifications.setSmallIcon(R.drawable.ic_stat_stack);
        setMediaNotificationProvider(notifications);

        session = new MediaSession.Builder(this, player)
            .setSessionActivity(contentIntent)
            .setBitmapLoader(new StackArtwork(this))
            .build();
        instance = this;
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return session;
    }

    // Swiping Stack away from recents stops the music unless it's playing.
    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        Player player = session.getPlayer();
        if (!player.getPlayWhenReady() || player.getMediaItemCount() == 0) {
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(sleepNow);
        sleepAt = 0;
        sleepEndOfTrack = false;
        if (instance == this) instance = null;
        if (session != null) {
            session.getPlayer().release();
            session.release();
            session = null;
        }
        super.onDestroy();
    }
}
