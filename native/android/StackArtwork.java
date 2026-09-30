package com.chhari.stack;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PathMeasure;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.util.Size;
import androidx.annotation.Nullable;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.util.BitmapLoader;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.ListeningExecutorService;
import com.google.common.util.concurrent.MoreExecutors;
import java.util.Locale;
import java.util.concurrent.Executors;

/**
 * Artwork for the media notification and lock screen, in Stack's look: the
 * same record as the in-app player, with the song title curved around the red
 * label and the album art (when the file has one) in the middle. Android 13+
 * also colours its media player from this picture.
 *
 * Queue items carry their track URI as artworkUri; this renders it on demand,
 * so only the song on screen is ever drawn.
 */
final class StackArtwork implements BitmapLoader {

    private static final int SIZE = 720;
    private static final int PAPER = Color.parseColor("#141413");
    private static final int VINYL = Color.parseColor("#111111");
    private static final int MUSIC = Color.parseColor("#D62F26");

    private final Context context;
    private final ListeningExecutorService executor = MoreExecutors.listeningDecorator(Executors.newSingleThreadExecutor());

    StackArtwork(Context context) {
        this.context = context.getApplicationContext();
    }

    @Override
    public boolean supportsMimeType(String mimeType) {
        return true;
    }

    @Override
    public ListenableFuture<Bitmap> decodeBitmap(byte[] data) {
        return executor.submit(() -> {
            Bitmap b = BitmapFactory.decodeByteArray(data, 0, data.length);
            if (b == null) throw new IllegalArgumentException("Couldn't decode artwork");
            return b;
        });
    }

    @Override
    public ListenableFuture<Bitmap> loadBitmap(Uri uri) {
        return executor.submit(() -> render(uri, "", ""));
    }

    @Nullable
    @Override
    public ListenableFuture<Bitmap> loadBitmapFromMetadata(MediaMetadata m) {
        if (m.artworkData != null) return decodeBitmap(m.artworkData);
        if (m.artworkUri == null) return null;
        String title = m.title == null ? "" : m.title.toString();
        String artist = m.artist == null ? "" : m.artist.toString();
        return executor.submit(() -> render(m.artworkUri, title, artist));
    }

    private Bitmap render(Uri track, String title, String artist) {
        Bitmap out = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(out);
        float cx = SIZE / 2f;
        float cy = SIZE / 2f;
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);

        c.drawColor(PAPER);

        // Record and grooves
        p.setColor(VINYL);
        c.drawCircle(cx, cy, 320, p);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(1.6f);
        for (int r = 150; r <= 312; r += 9) {
            p.setColor(r % 27 == 0 ? Color.parseColor("#2F2F2D") : Color.parseColor("#1E1E1D"));
            c.drawCircle(cx, cy, r, p);
        }
        p.setStyle(Paint.Style.FILL);
        p.setShader(new RadialGradient(cx - 110, cy - 130, 420, Color.argb(46, 255, 255, 255), Color.argb(0, 255, 255, 255), Shader.TileMode.CLAMP));
        c.drawCircle(cx, cy, 320, p);
        p.setShader(null);

        // Red label
        p.setColor(MUSIC);
        c.drawCircle(cx, cy, 140, p);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(2);
        p.setColor(Color.argb(64, 255, 255, 255));
        c.drawCircle(cx, cy, 132, p);
        p.setStyle(Paint.Style.FILL);

        // Title over the top of the label, artist along the bottom
        Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
        text.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
        text.setColor(Color.WHITE);
        text.setTextSize(25);
        text.setLetterSpacing(0.08f);
        curved(c, text, (title.isEmpty() ? "Unknown track" : title).toUpperCase(Locale.ROOT), cx, cy, 100, 155, 230);
        if (!artist.isEmpty()) {
            text.setTypeface(Typeface.MONOSPACE);
            text.setTextSize(19);
            text.setColor(Color.argb(200, 255, 255, 255));
            curved(c, text, artist.toUpperCase(Locale.ROOT), cx, cy, 116, 150, -120);
        }

        // Middle: the album art if the file has one, else the Stack mark
        Bitmap art = albumArt(track);
        if (art != null) {
            float r = 78;
            BitmapShader shader = new BitmapShader(art, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP);
            float scale = (2 * r) / Math.min(art.getWidth(), art.getHeight());
            Matrix m = new Matrix();
            m.setScale(scale, scale);
            m.postTranslate(cx - art.getWidth() * scale / 2, cy - art.getHeight() * scale / 2);
            shader.setLocalMatrix(m);
            p.setShader(shader);
            c.drawCircle(cx, cy, r, p);
            p.setShader(null);
        } else {
            Paint mark = new Paint(Paint.ANTI_ALIAS_FLAG);
            mark.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
            mark.setTextSize(17);
            mark.setLetterSpacing(0.25f);
            mark.setColor(Color.argb(170, 255, 255, 255));
            mark.setTextAlign(Paint.Align.CENTER);
            c.drawText("STACK", cx, cy - 26, mark);
            c.drawText("33⅓", cx, cy + 42, mark);
        }
        p.setColor(PAPER);
        c.drawCircle(cx, cy, 9, p);
        return out;
    }

    // Draws `s` centred along an arc; negative sweep runs anticlockwise (for text along the bottom).
    private static void curved(Canvas c, Paint paint, String s, float cx, float cy, float r, float start, float sweep) {
        Path path = new Path();
        path.arcTo(new RectF(cx - r, cy - r, cx + r, cy + r), start, sweep, true);
        float length = new PathMeasure(path, false).getLength();
        String fit = s;
        while (fit.length() > 1 && paint.measureText(fit) > length * 0.94f) {
            fit = fit.substring(0, fit.length() - 2) + "…";
        }
        c.drawTextOnPath(fit, path, (length - paint.measureText(fit)) / 2, 0, paint);
    }

    @Nullable
    private Bitmap albumArt(Uri track) {
        if (Build.VERSION.SDK_INT < 29 || !"content".equals(track.getScheme())) return null;
        try {
            return context.getContentResolver().loadThumbnail(track, new Size(320, 320), null);
        } catch (Exception e) {
            return null; // no embedded artwork
        }
    }
}
