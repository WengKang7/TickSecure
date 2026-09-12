# TickSecure

TickSecure is a PHP-rendered ticketing application backed by Firebase. PHP supplies the pages and shared UI; Firebase Authentication, Cloud Firestore, and callable Firebase Functions supply identity, data, and protected ticketing workflows.

## Architecture at a glance

- Browser-side Firebase services handle allowed CRUD for profiles, organizer drafts, administrator-managed venues, complaints, and notification read state.
- `firestore.rules` restricts every browser request by role and ownership.
- Firebase Functions uses the Admin SDK for security-sensitive state changes: inventory reservations, checkout, ticket transfer, resale, and entry scanning. The Emulator Suite runs that same backend free on localhost; an explicit local XAMPP/PHP bridge is also available for a Spark-plan FYP demo.
- `Seats` contains reusable physical venue layout. `EventSeats` is the separate event-scoped copy that holds reservations and sales, preventing one event from consuming another event's inventory.
- `Bookings`, `NFTTickets`, `ResaleListings`, `AuditLogs`, and `BlockchainTransactions` are protected records. The backend creates or changes them through validated transactions; browser writes are intentionally denied.

See [`firebase-schema.md`](firebase-schema.md) for the canonical collection shapes, ownership fields, status values, and event inventory lifecycle.

## Project layout

| Path | Purpose |
| --- | --- |
| `assets/js/firebase-init.js` | Firebase client initialization and callable Function configuration. |
| `assets/js/firebase-services.js` | Authentication and profile helpers. |
| `assets/js/firestore-crud.js` | Browser-facing service objects used by the PHP pages. |
| `functions/index.js` | Trusted Firebase Admin SDK callable backend. |
| `api/backend.php` | Loopback-only PHP trusted-workflow bridge for an explicit local Spark-plan demo. |
| `api/firebase-admin.php` | Dependency-free Firebase Auth-token verification and Firestore REST transaction helper used by the local PHP bridge. |
| `firestore.rules` | Browser access-control policy. |
| `firestore.indexes.json` | Versioned Firestore composite-index definitions. |
| `storage.rules` | Firebase Storage access policy for posters, blueprints, and complaint evidence. |
| `firebase.json` | Firebase CLI deployment configuration. |
| `firebase-schema.md` | Canonical Firestore data model. |
| `api/upload.php` | Disabled-by-default, loopback-only local upload fallback for PHP demo mode. |

## Local UI preview

From the project directory:

```bash
php -S localhost:8000
```

Open <http://localhost:8000/preview.php>.

For XAMPP, place the project in `htdocs`, start Apache, then open:

```text
http://localhost/ticksecure-ui/preview.php
```

The PHP server renders the UI, but protected ticket workflows need a configured Firebase project, an authenticated user, deployed Firestore rules/indexes, required Firestore data, and one of: deployed Functions, the Emulator Suite, or the explicit local PHP bridge below.

## Free local Firebase Emulator Suite (no Blaze plan)

For an FYP demonstration, run Auth, Firestore, Storage, and callable Functions locally instead of deploying them. This requires no Firebase billing plan and does not create a production Storage bucket or deploy Cloud Functions.

The checked-in `.firebaserc` keeps the emulator project ID aligned with the browser configuration (`tick-c12a1`). If you change Firebase projects later, update both that file and `assets/js/firebase-init.js`.

1. Install the Firebase CLI and ensure the Firestore emulator can use a supported Java runtime. Then install the checked-in Functions dependencies:

   ```bash
   cd functions
   npm install
   cd ..
   ```

2. From the project root, start the local services:

   ```bash
   firebase emulators:start --only auth,firestore,storage,functions
   ```

   The Emulator UI is available at <http://localhost:4000>. The checked-in ports are Auth `9099`, Firestore `8080`, Functions `5001`, and Storage `9199`.

3. With XAMPP/Apache serving the PHP app, open it once with the explicit opt-in switch:

   ```text
   http://localhost/ticksecure-ui/preview.php?firebaseEmulator=1&firebaseBackend=firebase
   ```

The switches are remembered only in that browser's local storage. Use `?firebaseEmulator=0` to return to the real Firebase project. If the emulator is running on another machine, add `&firebaseEmulatorHost=HOSTNAME_OR_IP` to the opt-in URL.

When emulator mode is enabled, the browser connects all four Firebase services to the local suite. Secure checkout, resale, transfer, and scanning still go through the local callable Functions emulator; no browser-side privileged-write fallback is enabled. Emulator data is temporary unless you start the suite with Firebase CLI import/export options.

## Local XAMPP/PHP fallback (Spark-plan FYP demo)

If you cannot install a supported JDK for the Emulator Suite, keep Firebase
Authentication and Firestore on Spark and use the explicit PHP bridge instead.
It replaces the privileged callable workflows and Firebase Storage uploads only
for `localhost`; normal direct CRUD continues through Firestore Rules.

1. Store a Firebase service-account JSON outside `htdocs`, then copy
   [`api/firebase-config.example.php`](api/firebase-config.example.php) to
   ignored `api/firebase-config.local.php` and set that private path.
2. Enable `TICKSECURE_PHP_BACKEND=1`, `TICKSECURE_LOCAL_UPLOADS=1`, and a
   random `TICKSECURE_LOCAL_UPLOAD_TOKEN` in the local Apache configuration.
3. Set the same upload token in browser local storage and open:

   ```text
   http://localhost/ticksecure-ui/preview.php?firebaseBackend=php
   ```

Full Apache settings, safety restrictions, and the browser command are in
[`api/README.md`](api/README.md). PHP mode is loopback-only and must not be
combined with `?firebaseEmulator=1`; it uses real Firebase Auth tokens and real
Firestore data. Switch back with `?firebaseBackend=firebase`.

## Firebase setup and deployment

The checked-in browser configuration currently targets Firebase project `tick-c12a1`. Use a different project only after replacing the Firebase configuration in `assets/js/firebase-init.js` and selecting that project in the Firebase CLI. This deployment path requires a Firebase plan that permits Cloud Functions and Cloud Storage; do not run it for a Spark-only FYP project—use one of the local modes above instead.

1. Create or select the Firebase project, enable Cloud Firestore in Native mode, and enable Email/Password in Firebase Authentication.
2. Install the Firebase CLI, authenticate, and select the intended project:

   ```bash
   firebase login
   firebase use tick-c12a1
   ```

3. Install the Functions dependencies with Node.js 20:

   ```bash
   cd functions
   npm install
   cd ..
   ```

4. Deploy the security policy, required indexes, Storage policy, and backend as one release:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage,functions
   ```

The callable backend is deployed to `asia-southeast1`. The browser initializes Functions in the same region; keep those settings aligned if the deployment region changes.

### Spark-only email verification

Firebase Authentication and Firestore Rules work on the Spark plan. After
updating this project, deploy the verification policy below once; it does not
deploy Functions or Storage and does not require Blaze:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

This lets a user whose Firebase Auth email has already been verified update
only their own `Users/{uid}.emailVerified` projection when no callable backend
is available. The browser still refreshes Firebase Auth first, so the client
cannot mark an unverified email as verified.

### Indexes and inventory prerequisites

`firestore.indexes.json` is the source of truth for composite indexes used by the checked-in seat and booking queries. Include `firestore:indexes` in every deployment, then allow newly created indexes to finish building before exercising affected queries. Do not rely on console-only indexes that are absent from this file.

Before secure reservation or checkout can create `EventSeats`, an administrator must activate the venue layout so its reusable physical `Seats` documents exist. For a published event, the backend lazily clones the number of physical seats configured in `Events.categories` into event-specific inventory. It creates only missing clones and never resets an existing reservation or sale.

## Accounts and roles

Firebase Authentication owns credentials, while `Users/{uid}` holds the application profile.

- Browser registration creates an unverified active `buyer` or pending `organizer` profile. A verified Firebase Auth email is required before an account can read protected data or use ticket workflows.
- Create the first active `admin` through the Firebase Console, Emulator Suite, or a protected Admin SDK script.
- Browser users cannot grant themselves an administrator role or alter their own role/status. Administrators approve, suspend, or reject organizer accounts.
- Firebase Authentication is the source of truth for email verification. After Firebase Auth verifies an email, the app refreshes the ID token and uses `syncEmailVerification` when a trusted backend is available. For a Spark-plan demo without callable Functions, the deployed Firestore policy permits only the verified account itself to project `Users.emailVerified: true` from that refreshed claim. This is not a client-controlled verification bypass.
- Do not restore browser seed data, demo administrator credentials, or service-account material. The checked-in browser seeder is deliberately disabled.

## CRUD and trusted workflows

Normal page CRUD uses the service objects in `assets/js/firestore-crud.js` (for example, `window.tsUsers`, `window.tsEvents`, and `window.tsComplaints`). Firestore Rules remain the authority for which direct browser operations are allowed.

The following mutations must be invoked through a trusted backend rather than direct Firestore writes:

- `reserveSeats` and `releaseSeatReservation`
- `checkout`
- `transferTicket`
- `createResaleListing`, `updateResalePrice`, `cancelResaleListing`, `suspendResaleListing`, and `purchaseResale`
- `scanTicket`
- `syncEmailVerification` (with a claim-verified Firestore fallback for Spark-only local demos)

In normal Firebase and Emulator Suite mode, these are callable Functions. In explicit PHP mode, the same browser requests go to a loopback-only endpoint that verifies the Firebase ID token and executes matching Firestore REST transactions with a service account outside `htdocs`. In either mode, checkout derives security-sensitive values from trusted Firestore records and validates the verified buyer, sales window, category allocation, price, current ticket-holding limit, wallet, and `EventSeats` reservation before it sells seats, creates booking/tickets, and records notifications, audit activity, and simulated blockchain work. Date-only sales and resale windows are evaluated in the product's +08:00 business timezone, with an end date inclusive through the end of that day.

The Functions backend also has an event-update trigger that suspends active resale listings if an administrator changes an event to `SUSPENDED` or `CANCELLED`. The PHP-mode admin UI calls its matching moderation action, which performs the same sweep. Resale purchase independently checks the event state, so it remains blocked while a sweep is processing.

## Production-readiness requirements

The current trusted backend is intentionally a secure development foundation, not a live payments or blockchain system.

- **Payments:** checkout and resale purchase currently write `SIMULATED_PAID`. Before accepting money, integrate a payment provider, verify server-side payment/webhook events, make operations idempotent, and implement failure, cancellation, refund, and reconciliation paths.
- **Blockchain:** mint, transfer, and resale workflows create backend-owned `BlockchainTransactions` records with simulated `PENDING` state and no transaction hash. They do not submit or confirm an on-chain transaction. Replace this with a secure wallet/provider integration and persist only provider-confirmed chain results.
- **App Check:** the current callable Functions set `enforceAppCheck: false`. Enable and enforce Firebase App Check, configure valid application clients, and test legitimate flows before public production use.
- **Uploads:** normal Firebase mode uses Firebase Storage; deploy `storage.rules`, enable Storage in the Firebase project, and keep paths/allowed MIME types aligned with the rules. In explicit local PHP mode only, `api/upload.php` is enabled by server environment variables, a local token, and a loopback check. Its static local files are not private evidence storage and must not be used for production data.
- **Wallets:** address-format validation is not wallet ownership proof. Before treating wallet identity or on-chain delivery as production-ready, add a signed nonce/challenge flow, canonical unique wallet addresses, and a real custody/provider integration.
- **Operations:** keep Firestore Rules, Storage Rules, indexes, Functions, and the schema documentation in the same release review. Restrictive rules are deliberate; do not weaken them to make a protected browser write succeed.

If this Firebase project already contains browser-seeded records, backfill canonical uppercase workflow statuses, `organizerUid` projections, and `Users.emailVerified` before deploying these rules. Old ticket, booking, and resale records without those fields will not satisfy the scoped production queries.

## Useful checks

```bash
php -l api/upload.php
php -l api/backend.php
php -l api/firebase-admin.php
node --check assets/js/firebase-init.js
node --check assets/js/backend-client.js
node --check assets/js/firestore-crud.js
cd functions && npm run check
```

Run PHP syntax checks against edited pages as part of normal development. When a permission-sensitive workflow changes, deploy the rules, indexes, and Functions together and test it with non-privileged as well as authorized accounts.
