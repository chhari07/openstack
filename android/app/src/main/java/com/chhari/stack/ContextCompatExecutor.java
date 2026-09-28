package com.chhari.stack;

import android.content.Context;
import androidx.core.content.ContextCompat;
import java.util.concurrent.Executor;

final class ContextCompatExecutor {
    private ContextCompatExecutor() {}

    /** Runs tasks on the app's main (UI) thread. */
    static Executor main(Context context) {
        return ContextCompat.getMainExecutor(context);
    }
}
