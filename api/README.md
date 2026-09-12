# Local XAMPP/PHP fallback

This folder contains an explicit, loopback-only alternative for a local FYP
demo when a Spark Firebase project cannot use Firebase Storage or deploy Cloud
Functions. It is not a replacement for the Emulator Suite or a production
backend.

The browser still uses Firebase Authentication and Cloud Firestore. For the
protected mutations that normally use callable Functions, `backend.php`
verifies the Firebase ID token and uses a service account stored **outside**
`htdocs` to run Firestore REST transactions. `upload.php` stores uploads under
this local project instead of Firebase Storage.

## Configure the PHP bridge

1. Ensure Firebase Authentication (Email/Password) and Cloud Firestore are
   enabled for `tick-c12a1`. Both can be used on the Spark plan.
   Deploy only the checked-in Firestore policy and indexes (not Storage or
   Functions) after logging in to the Firebase CLI:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
2. In Firebase Console → Project settings → Service accounts, create a private
   key. Save it outside the web root, for example:

   ```text
   C:\xampp\private\tick-c12a1-service-account.json
   ```

3. Copy `firebase-config.example.php` to `firebase-config.local.php`, then set
   the exact private-key path. Both files are intentionally ignored by Git.
4. Add the following to a local Apache/XAMPP virtual-host or `<Directory>`
   configuration for this project, using a random upload token of at least 32
   characters. Do not commit it.

   ```apache
   SetEnv TICKSECURE_PHP_BACKEND 1
   SetEnv TICKSECURE_LOCAL_UPLOADS 1
   SetEnv TICKSECURE_LOCAL_UPLOAD_TOKEN replace-with-a-random-32-character-or-longer-token
   ```

5. Restart Apache. Both endpoints otherwise return `410 Gone`.
6. In DevTools on the same `http://localhost` origin, set the matching local
   upload token and open the PHP-mode URL:

   ```js
   localStorage.setItem('ticksecure.localUploadToken', 'replace-with-the-same-token');
   location.href = '/ticksecure-ui/preview.php?firebaseBackend=php';
   ```

The selection is remembered only in that browser. Open
`?firebaseBackend=firebase` to return to the normal Firebase callable/Storage
path. Do **not** combine PHP mode with `?firebaseEmulator=1`: PHP mode validates
real Firebase Auth tokens and writes to the real Firestore project, while the
emulator uses local tokens and local data.

The app routes checkout, reservations, ticket transfer, resale, ticket
scanning, email-verification sync, local-evidence complaints, and normal
admin event moderation through this bridge. The PHP moderation action also
closes active resale listings when the admin UI suspends or cancels an event.
Do not change an event to `SUSPENDED`/`CANCELLED` directly in the Firebase
Console while using PHP mode; there is no deployed Cloud Function trigger to
sweep listings in that case.

## Local uploads

`upload.php` is disabled by default and normally returns `410 Gone`. The
configuration above makes it a local XAMPP-only fallback; Firebase Storage is
still the normal application path outside PHP mode. It also accepts requests
only from the loopback machine (`127.0.0.0/8` or `::1`).

## Request contract

Send a same-origin multipart `POST` to:

```text
/ticksecure-ui/api/upload.php?mode=local-dev
```

with these headers:

```text
X-TickSecure-Upload-Mode: local-dev
X-TickSecure-Local-Upload-Token: <the server environment token>
```

and exactly one multipart field named `file`. Only content-validated JPEG,
PNG, and PDF files up to 10 MiB are accepted. The original filename is ignored;
the endpoint stores a random generated name under `uploads/local/YYYY/MM/` and
returns JSON such as:

```json
{"ok":true,"path":"uploads/local/2026/09/<random>.pdf","mimeType":"application/pdf","size":1234}
```

The response intentionally returns a relative path, not an access-controlled
public URL. In PHP application mode, complaint records retain only this strict
relative path and the UI expands it on the same local origin. The file is still
a static XAMPP file, not access-controlled storage—do not use this fallback for
real or sensitive evidence. Add an authenticated download endpoint before any
production use.
