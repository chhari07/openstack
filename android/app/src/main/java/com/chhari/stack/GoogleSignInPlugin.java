package com.chhari.stack;

import android.content.Intent;
import android.os.CancellationSignal;
import android.provider.Settings;
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
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * "Continue with Google" with Android's own account picker (Credential
 * Manager). Returns a Google ID token, which the web app hands to Supabase
 * (signInWithIdToken). Signing in with a new Google account creates the Stack
 * account, so the same button is both sign-in and sign-up.
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
        GetGoogleIdOption.Builder option = new GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false) // any Google account on the phone
                .setServerClientId(clientId)
                .setAutoSelectEnabled(false);
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
                            call.reject("No Google account on this phone yet.", "NO_ACCOUNT");
                        } else {
                            call.reject(e.getMessage() == null ? "Google sign-in failed" : e.getMessage(), "FAILED");
                        }
                    }
                });
    }

    /** Opens Android's "Add account" screen for a Google account. */
    @PluginMethod
    public void addAccount(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ADD_ACCOUNT)
                .putExtra(Settings.EXTRA_ACCOUNT_TYPES, new String[] { "com.google" })
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Couldn't open Android's accounts screen", "NO_SETTINGS");
        }
    }
}
