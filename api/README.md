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

## Current local checkout

The project `.htaccess` enables `TICKSECURE_PHP_CHECKOUT=1` alongside the
separate password-recovery flag. On localhost, `reserveSeats`,
`releaseSeatReservation`, and `checkout` automatically use the PHP bridge,
unless Firebase Emulator mode is enabled. These actions require a verified
Firebase ID token and an active, verified buyer profile. Venue blueprints have
their own authenticated local route below. Other mutations and uploads retain
their separate enablement requirements.

The flow is event category/quantity, seat reservation, wallet, simulated
payment, then booking confirmation/My Tickets. MetaMask provides the wallet
address; payment does not request a blockchain transaction. No card details
are collected, no money is charged, and bookings have `SIMULATED_PAID` status.
Prices and the RM20 service charge are calculated on the server. Repeating
checkout for the same purchased seats returns the original booking.

Local reservation queries use an event-scoped single-field query and filter
inside the transaction, so they work without the callable backend's composite
seat index. Physical seats are never sold directly: `EventSeats` stores each
event's reservations and sales. Local date/time sales boundaries use +08:00;
date-only end dates include the entire day.

With Apache running and the private Firebase configuration available, run
`node scripts/test-local-checkout.cjs` manually to test real HTTP requests and
Firebase client permissions. It creates temporary test users and fixtures and
removes them afterward; it never purchases an existing event's tickets.

## Configure the full PHP bridge

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

5. Restart Apache. Actions outside the checkout/recovery subset remain disabled unless the full backend flag is enabled. Uploads have their own flags.
6. In DevTools on the same `http://localhost` origin, set the matching local
   upload token and open the PHP-mode URL:

   ```js
   localStorage.setItem('ticksecure.localUploadToken', 'replace-with-the-same-token');
   location.href = '/ticksecure-ui/preview.php?firebaseBackend=php';
   ```

The selection is remembered only in that browser. Open
`?firebaseBackend=firebase` to return other workflows to the normal callable/Storage
path. Localhost checkout still uses its dedicated PHP route. Do **not** combine PHP mode with `?firebaseEmulator=1`: PHP mode validates
real Firebase Auth tokens and writes to the real Firestore project, while the
emulator uses local tokens and local data.

The app routes checkout, reservations, ticket transfer, resale, ticket
scanning, email-verification sync, local-evidence complaints, and normal
admin event moderation through this bridge. The PHP moderation action also
closes active resale listings when the admin UI suspends or cancels an event.
Do not change an event to `SUSPENDED`/`CANCELLED` directly in the Firebase
Console while using PHP mode; there is no deployed Cloud Function trigger to
sweep listings in that case.

## Password recovery

`checkPasswordResetEmail` is the signed-out account check accepted by `backend.php`. It uses the private service account to look up the Firebase Auth email, then reads only the matching `Users/{uid}` profile. It returns `{registered: true|false}`; it never returns user IDs, profile fields, credentials, or reset links. The other public read is `getEventAvailability`, enabled with the checkout flag: it returns only category allocations and remaining counts for published events. Ticket/profile mutations still require a verified Firebase ID token, and the endpoint remains opt-in and loopback-only.

For local password recovery, the project `.htaccess` enables `TICKSECURE_PHP_PASSWORD_RESET=1`. This flag permits only the loopback recovery lookup; checkout is enabled independently as described above. The local Forgot Password page selects PHP just for this lookup, so you can open `http://localhost/ticksecure-ui/auth/forgot-password.php` without changing the backend mode for other pages.

The ignored `api/firebase-config.local.php` specifies project `tick-c12a1` and the actual service-account file path outside `htdocs`. The key itself is not provided by this repository. If that private file is unavailable, the lookup returns `backend_not_configured` and sends no reset email.

 The service account also needs Firebase Authentication user-read permission (`firebaseauth.users.get`). The REST helper requests both the existing Datastore scope and the Identity Toolkit scope for the Auth lookup. Keep the service account outside the web root. The browser requests Firebase's reset email only after a positive result; configuration errors and lookup failures block that request.

## Local venue blueprints

The checked-in `.htaccess` enables `TICKSECURE_PHP_BLUEPRINT_UPLOAD=1` for
`venue-blueprint.php`. On localhost, venue blueprint uploads select this route
automatically, outside Emulator Suite mode. No `firebaseBackend=php` switch or
shared upload token is required. The existing `firebase-config.local.php` and
private service-account file outside `htdocs` must be available; Firebase Auth
and Firestore must be reachable.

The route accepts one content-validated PDF up to 10 MiB and a venue ID. Every
upload and download verifies a Firebase ID token and an active administrator
profile, following the existing administrator email-verification exception. It stores a random PDF filename under
`storage/blueprints/`, whose committed `.htaccess` blocks static HTTP access.
It updates only the selected venue's blueprint metadata in a Firestore
transaction. Guests and buyers cannot upload or download. Remote requests are
rejected even if the server flag is enabled. Keep these files in local backups;
they are ignored by Git.

`blueprintUrl` is a relative API path. To download, fetch that path on the same
project origin with `Authorization: Bearer <Firebase ID token>`; credentials
must not appear in the URL. Direct navigation without that header returns 401.

Run `node scripts/test-local-blueprint.cjs` with Apache running to exercise the
actual local endpoint and Firebase services. It creates temporary administrator
and buyer accounts, a temporary venue, and a sample PDF, then removes them.
It verifies metadata persistence and that guest, buyer, and public-file access
are denied. Ordinary automated checks include the policy and browser-routing
tests in `tests/blueprint-upload.test.cjs`.

## Local event posters

The checked-in `.htaccess` enables `TICKSECURE_PHP_POSTER_UPLOAD=1` for
`event-poster.php`. On localhost outside Emulator mode, poster uploads use this
route automatically. No upload-token or backend-mode setup is required. It uses
the existing private Firebase configuration, so Firebase Auth and Firestore
must remain reachable.

Send an authenticated multipart `POST` with `eventId`, one `file`, and
`Authorization: Bearer <Firebase ID token>`. The caller must be the active,
email-verified organizer owning the draft, or an active administrator. The
administrator email-verification exception matches sign-in. Buyers, other
organizers, suspended accounts, and non-draft events are rejected.

The server validates JPG/PNG content up to 5 MiB, saves a random image filename
under `uploads/posters/`, rechecks authorization and event state in a transaction,
and updates only `posterUrl` and `updatedAt`. It returns a strict relative path;
Firestore stores a root-relative URL that works under the XAMPP subdirectory.
Posters are public event artwork. The committed directory `.htaccess` permits
only server-named JPG/PNG images with the static handler. Other uploaded content
and directory listings are denied. Keep the ignored image files in backups.

Run `node scripts/test-local-poster.cjs` to verify live uploads, public image
retrieval, ownership/role checks, file validation, and draft restrictions using
temporary fixtures. The script removes all fixtures after testing.

## Other local uploads

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
