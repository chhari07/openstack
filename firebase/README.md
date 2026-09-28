# Stack accounts and sync (Firebase)

Stack works without this: everything stays on the device. With it, people sign
in with **Google** (the same button creates the account), or with email and a
password, and their notes, saved articles, PDFs, playlists, focus history and
profile sync across the phone and the website.

## 1. Create the project (free Spark plan is enough)

1. https://console.firebase.google.com → **Add project** → name it "Stack".
2. **Project settings → General → Your apps → Web (`</>`)** → register "Stack web".
   Copy the config values into `.env.local`:

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=stack-xxxx.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=stack-xxxx
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc
   ```

   These values are meant to be public (they ship inside the app). The
   security rules below are what keep each person's data private.

## 2. Sign-in: Google (and email as a fallback)

1. **Build → Authentication → Get started → Sign-in method**:
   - **Google** → Enable → pick a support email → Save. Open it again and copy
     **Web SDK configuration → Web client ID** into `.env.local`:
     ```
     NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=1234-abc.apps.googleusercontent.com
     ```
   - **Email/Password** → Enable (for people without a Google account).
2. **Project settings → General → Your apps → Add app → Android**:
   - Package name: `com.chhari.stack`
   - **SHA-1**: `A6:E5:F8:21:58:C9:50:71:92:5C:1F:FD:47:4A:15:2D:F4:F3:8E:65`
     (the key that signs the debug APKs `./build-apk.sh` makes on this laptop;
     a release key has its own SHA-1, add it too when you have one).
   - You don't need to download `google-services.json`.

   This is what lets the phone's Google account picker sign in to Stack.
3. **Authentication → Settings → Authorized domains**: `localhost` is there
   already; add `127.0.0.1` (for `npm run dev`) and your website's domain.

## 3. Database (Cloud Firestore)

1. **Build → Firestore Database → Create database** → a location near your
   users (e.g. `asia-south1`, Mumbai) → **production mode**.
2. **Rules** tab → replace everything with [`firestore.rules`](firestore.rules) → **Publish**.

## 4. PDF files (optional, needs the Blaze plan)

Firebase only offers Cloud Storage on the pay-as-you-go **Blaze** plan (it has
a free allowance: 5 GB stored). Without it, a PDF's title, page and cover
still sync, but the file itself stays on the phone that added it.

1. Upgrade to Blaze, then **Build → Storage → Get started**.
2. **Rules** tab → paste [`storage.rules`](storage.rules) → **Publish**.
3. Add the bucket to `.env.local`: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=stack-xxxx.firebasestorage.app`
4. Website only: allow browsers to download the files (the Android app doesn't need this):
   ```
   echo '[{"origin":["*"],"method":["GET"],"maxAgeSeconds":3600}]' > cors.json
   gsutil cors set cors.json gs://stack-xxxx.firebasestorage.app
   ```

## 5. Build

`npm run dev` for the website, `./build-apk.sh` for the app. The values are
built into the APK, so rebuild after changing them.

## Trying it without a real project (emulators)

The Firebase emulators run Auth, Firestore and Storage on this laptop (needs Java):

```
cd firebase && npx firebase-tools emulators:start --project demo-stack
```

and start the website with demo values:

```
NEXT_PUBLIC_FIREBASE_API_KEY=demo NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-stack \
NEXT_PUBLIC_FIREBASE_APP_ID=demo NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-stack.firebaseapp.com \
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-stack.appspot.com \
NEXT_PUBLIC_FIREBASE_EMULATOR=127.0.0.1 npm run dev
```

The emulator's Google sign-in shows a test page where you can make up accounts.
Its dashboard is at http://127.0.0.1:4000.

## How sync works

- Each item is one Firestore document: `users/<uid>/items/<collection>__<id>`,
  stamped with the server's time on every write.
- Every change on the device is marked and uploaded a few seconds later (and
  when the app comes back, when the connection returns, and every 5 minutes).
  Then the device downloads what changed since its last download. A local
  change that isn't uploaded yet wins over the downloaded copy.
- Deletions stay as `deleted: true` documents so other devices remove the item too.
- The first time a device signs in, everything already on it is added to the account.
