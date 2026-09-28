package com.chhari.stack;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The web app calls hide() after its first render to dismiss the splash screen. */
@CapacitorPlugin(name = "Splash")
public class SplashPlugin extends Plugin {
    @PluginMethod
    public void hide(PluginCall call) {
        MainActivity.webReady = true;
        call.resolve();
    }
}
