package com.chhari.stack;

import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * "Continue with Google" through Android's Credential Manager, using the
 * "Sign in with Google" button flow: Google's own dialog, which lists the
 * phone's accounts and offers to add one if there are none. Returns a Google
 * ID token that the web app hands to Firebase. A new Google account gets a new
 * Stack account, so the same button is both sign-in and sign-up.
 */
@CapacitorPlugin(name = "GoogleSignIn")
public class GoogleSignInPlugin extends Plugin {

    @PluginMethod
    public void signIn(PluginCall call) {
        String clientId = call.getString("serverClientId");
        String nonce = call.getString("nonce"); // SHA-256 of the raw nonce, hex
        if (clientId == null || clientId.isEmpty()) {
            call.reject("Google sign-in isn't set up in this build", "NOT_CONFIGURED");
            return;
        }
        GetSignInWithGoogleOption.Builder option = new GetSignInWithGoogleOption.Builder(clientId);
        if (nonce != null) option.setNonce(nonce);
        GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(option.build())
                .build();

        CredentialManager manager = CredentialManager.create(getContext());
        manager.getCredentialAsync(
                getActivity(),
                request,
                new CancellationSignal(),
                ContextCompat.getMainExecutor(getContext()),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse response) {
                        Credential credential = response.getCredential();
                        if (credential instanceof CustomCredential
                                && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                            try {
                                GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                                JSObject ret = new JSObject();
                                ret.put("idToken", google.getIdToken());
                                ret.put("email", google.getId());
                                ret.put("name", google.getDisplayName());
                                call.resolve(ret);
                            } catch (Exception e) {
                                call.reject("Google sent something Stack couldn't read", "BAD_CREDENTIAL");
                            }
                        } else {
                            call.reject("Google sent something Stack couldn't read", "BAD_CREDENTIAL");
                        }
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException e) {
                        if (e instanceof GetCredentialCancellationException) {
                            call.reject("Sign-in was cancelled", "CANCELLED");
                        } else if (e instanceof NoCredentialException) {
                            // With the button flow Google handles "no account" itself, so this
                            // means Google doesn't recognise the app (package + SHA-1 not
                            // registered for this project), e.g. Google's error [28433].
                            call.reject("Google doesn't recognise this app yet: " + e.getMessage(), "NOT_REGISTERED");
                        } else {
                            call.reject(e.getMessage() == null ? "Google sign-in failed" : e.getMessage(), "FAILED");
                        }
                    }
                });
    }
}
