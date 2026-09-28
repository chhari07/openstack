package com.chhari.stack;

import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.Patterns;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.regex.Matcher;
import org.json.JSONObject;

/**
 * The "Saved to Stack" card. Opens over the app the user is sharing from
 * (see-through window, no Stack screen behind it), saves the item to the
 * inbox, and closes itself after a few seconds. "Open in Stack" jumps to the
 * app, which imports the inbox and shows what was saved.
 */
public class ShareActivity extends Activity {

    private static final long AUTO_CLOSE_MS = 4500;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable autoClose = this::close;
    private LinearLayout card;
    private TextView label;
    private TextView title;
    private TextView detail;
    private boolean closing = false;

    // Stack colours (light / dark), matching globals.css.
    private int paper, ink, muted, line, onInk;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        boolean dark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
        paper = Color.parseColor(dark ? "#1F1F1D" : "#F7F5F0");
        ink = Color.parseColor(dark ? "#F1EFE9" : "#111111");
        onInk = Color.parseColor(dark ? "#141413" : "#FFFFFF");
        muted = Color.parseColor(dark ? "#A39F97" : "#6B6862");
        line = Color.parseColor(dark ? "#34332F" : "#E2DFD8");

        Intent intent = getIntent();
        setContentView(buildCard());
        describe(intent);

        // Copy/read on a background thread (a shared PDF can be large).
        new Thread(() -> {
            JSONObject item = ShareInPlugin.itemFrom(this, intent);
            main.post(() -> {
                if (isFinishing()) return;
                if (item == null) {
                    label.setText("COULDN’T SAVE");
                    detail.setText("Stack can save links, text and PDFs.");
                } else {
                    ShareInPlugin.enqueue(this, item);
                    label.setText("SAVED TO STACK");
                }
                main.postDelayed(autoClose, AUTO_CLOSE_MS);
            });
        }).start();
    }

    // What the card says, straight from the intent (before saving finishes).
    private void describe(Intent intent) {
        String type = intent.getType() == null ? "" : intent.getType();
        if (type.equals("application/pdf")) {
            Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            String name = uri == null ? "PDF" : ShareInPlugin.displayName(this, uri);
            title.setText(name.replaceAll("(?i)\\.pdf$", ""));
            detail.setText("PDF · added to the “Shared” shelf");
            return;
        }
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (text == null) text = "";
        Matcher m = Patterns.WEB_URL.matcher(text);
        String url = null;
        while (m.find()) {
            String found = m.group();
            if (found.startsWith("http://") || found.startsWith("https://")) {
                url = found;
                break;
            }
        }
        if (url != null) {
            String host = Uri.parse(url).getHost();
            host = host == null ? "" : host.replaceFirst("^(www|m)\\.", "");
            String words = text.replace(url, "").trim();
            title.setText(!TextUtils.isEmpty(subject) ? subject : words.length() > 3 ? words : host);
            boolean video = host.endsWith("youtube.com") || host.equals("youtu.be") || host.endsWith("vimeo.com");
            detail.setText(host + (video ? " · video, saved to your Library" : " · in your Library to read later"));
        } else {
            title.setText(!TextUtils.isEmpty(subject) ? subject : text.trim());
            detail.setText("Note · saved to your Notes");
        }
    }

    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    private View buildCard() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.argb(56, 0, 0, 0));
        root.setOnClickListener(v -> close()); // tap outside the card

        card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(22), dp(20), dp(22), dp(18));
        card.setClickable(true);
        card.setElevation(dp(12));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(paper);
        bg.setCornerRadius(dp(26));
        card.setBackground(bg);
        // Touching the card keeps it open.
        card.setOnTouchListener((v, e) -> {
            if (e.getAction() == MotionEvent.ACTION_DOWN) main.removeCallbacks(autoClose);
            return false;
        });

        // Logo + "SAVED TO STACK"
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.stack_mark);
        top.addView(logo, new LinearLayout.LayoutParams(dp(30), dp(30)));
        label = mono("SAVING TO STACK…", 11, ink);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        lp.leftMargin = dp(10);
        top.addView(label, lp);
        card.addView(top);

        title = new TextView(this);
        title.setTextColor(ink);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 21);
        title.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD));
        title.setLineSpacing(0, 1.05f);
        title.setMaxLines(3);
        title.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        tp.topMargin = dp(14);
        card.addView(title, tp);

        detail = mono("", 10, muted);
        detail.setMaxLines(1);
        detail.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams dpar = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        dpar.topMargin = dp(8);
        card.addView(detail, dpar);

        View rule = new View(this);
        rule.setBackgroundColor(line);
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1));
        rp.topMargin = dp(16);
        card.addView(rule, rp);

        // Buttons
        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        TextView done = pill("Done", false);
        done.setOnClickListener(v -> close());
        TextView open = pill("Open in Stack", true);
        open.setOnClickListener(v -> openStack());
        LinearLayout.LayoutParams b1 = new LinearLayout.LayoutParams(0, dp(50), 1);
        LinearLayout.LayoutParams b2 = new LinearLayout.LayoutParams(0, dp(50), 1.4f);
        b2.leftMargin = dp(10);
        buttons.addView(done, b1);
        buttons.addView(open, b2);
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bp.topMargin = dp(14);
        card.addView(buttons, bp);

        FrameLayout.LayoutParams cp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        int side = dp(12);
        cp.setMargins(side, 0, side, side);
        // Phones: full width; tablets: a 440dp card, centred.
        if (getResources().getConfiguration().smallestScreenWidthDp >= 600) {
            cp.width = dp(440);
            cp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        }
        root.addView(card, cp);

        // Stay above the gesture/navigation bar.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int bottom = insets.getSystemWindowInsetBottom();
            FrameLayout.LayoutParams p = (FrameLayout.LayoutParams) card.getLayoutParams();
            p.bottomMargin = side + bottom;
            card.setLayoutParams(p);
            return insets;
        });

        // Slide up.
        card.setTranslationY(dp(260));
        card.animate().translationY(0).setDuration(260).setInterpolator(new DecelerateInterpolator(2f)).start();
        return root;
    }

    private TextView mono(String text, int sp, int color) {
        TextView t = new TextView(this);
        t.setText(text);
        t.setTextColor(color);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTypeface(Typeface.MONOSPACE);
        t.setLetterSpacing(0.08f);
        t.setAllCaps(true);
        return t;
    }

    private TextView pill(String text, boolean filled) {
        TextView b = new TextView(this);
        b.setText(text);
        b.setGravity(Gravity.CENTER);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        b.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        b.setTextColor(filled ? onInk : ink);
        GradientDrawable d = new GradientDrawable();
        d.setCornerRadius(dp(25));
        if (filled) d.setColor(ink);
        else {
            d.setColor(Color.TRANSPARENT);
            d.setStroke(dp(1), line);
        }
        b.setBackground(d);
        b.setClickable(true);
        return b;
    }

    private void openStack() {
        main.removeCallbacks(autoClose);
        Intent i = new Intent(this, MainActivity.class);
        i.putExtra(ShareInPlugin.EXTRA_OPEN, true);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(i);
        finish();
        overridePendingTransition(0, 0);
    }

    private void close() {
        if (closing) return;
        closing = true;
        main.removeCallbacks(autoClose);
        card.animate().translationY(card.getHeight() + dp(40)).setDuration(200)
                .withEndAction(() -> {
                    finish();
                    overridePendingTransition(0, 0);
                })
                .start();
    }

    @Override
    public void onBackPressed() {
        close();
    }
}
