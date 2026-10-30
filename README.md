# TickSecure

TickSecure is a PHP-rendered ticketing application backed by Firebase. PHP supplies the pages and shared UI; Firebase Authentication, Cloud Firestore, and callable Firebase Functions supply identity, data, and protected ticketing workflows.

## Architecture at a glance

- Browser-side Firebase services handle allowed CRUD for profiles and saved events, organizer drafts, administrator-managed venues, complaints, and notification read state.
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
| `api/venue-blueprint.php` | Authenticated, administrator-only local blueprint upload and download for XAMPP. |
| `api/event-poster.php` | Authenticated local poster upload for the owning organizer's draft event. |
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

Open <http://localhost:8000/>.

For XAMPP, place the project in `htdocs`, start Apache, then open:

```text
http://localhost/ticksecure-ui/
```

The application opens on `index.php`. Guests can browse published events and event details. Booking, saved events, resale, tickets, wallet, support, dashboards, and entry verification require sign-in; organizer and administrator screens also require the matching role. Old `preview.php` links redirect to the home page. Apache uses the project's `.htaccess` to select `index.php` and disable directory listings.

Deploy the guest-access policy after updating: `firebase deploy --only firestore:rules`. Published events remain publicly readable; resale listings require an active, verified account. UI redirects do not replace Firebase rules or backend authorization.

The PHP server renders the UI, but protected ticket workflows need a configured Firebase project, an authenticated user, deployed Firestore rules/indexes, required Firestore data, and one of: deployed Functions, the Emulator Suite, or the explicit local PHP bridge below.

## Free local Firebase Emulator Suite (no Blaze plan)

For an FYP demonstration, run Auth, Firestore, Storage, and callable Functions locally instead of deploying them. This requires no Firebase billing plan and does not create a production Storage bucket or deploy Cloud Functions.

The checked-in `.firebaserc` keeps the emulator project ID aligned with the browser configuration (`tick-c12a1`). If you change Firebase projects later, update both that file and `assets/js/firebase-init.js`.

1. Install the Firebase CLI and Java 21 or newer for the current Firestore emulator ([Firebase emulator requirements](https://firebase.google.com/docs/emulator-suite/connect_firestore)). Then install the checked-in Functions dependencies:

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
   http://localhost/ticksecure-ui/?firebaseEmulator=1&firebaseBackend=firebase
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
   http://localhost/ticksecure-ui/?firebaseBackend=php
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

### Registration and reset password policy

Firebase Authentication for `tick-c12a1` enforces 8 to 4096 characters, including uppercase, lowercase, a number, and a supported special character. This applies to registration and Firebase's hosted reset page, including links opened on a phone. The local registration and reset forms share `validatePassword` and accept Firebase's supported symbols. Existing passwords are not forcibly upgraded at sign-in.

The desired policy is tracked in [config/password-policy.json](config/password-policy.json). Using the configured private service account, inspect it with `node scripts/configure-password-policy.cjs`, or apply it with `node scripts/configure-password-policy.cjs --apply`. The script reads back the admin and public policies, preserves the existing sign-in upgrade setting, refuses to reduce stricter length requirements, and saves the previous policy under ignored `tmp/` before applying. It does not reset any user's password.

### Password recovery account checks

The Forgot Password form checks `checkPasswordResetEmail` before requesting a Firebase reset email. The backend requires both a Firebase Authentication account and a matching `Users/{uid}` profile with a buyer, organizer, or administrator role. Unknown emails and orphaned Auth accounts cannot request reset instructions through this form. Only a boolean eligibility result reaches the browser; the `Users` collection remains private.

Enable the check before testing live password recovery:

- **Firebase mode:** deploy the new callable with `firebase deploy --only functions:checkPasswordResetEmail`, or restart the Functions emulator when using the Emulator Suite.
- **Local XAMPP:** the recovery-only PHP route is enabled in `.htaccess` and selected automatically for the localhost Forgot Password page. Supply the private key at the path configured in ignored `api/firebase-config.local.php`; see [local password recovery setup](api/README.md#password-recovery). Other workflows retain their existing backend selection. Its service account needs permission to read Firebase Authentication users as well as Firestore. The new Auth lookup requests the Identity Toolkit OAuth scope. No browser credential or public profile-read rule is needed.

If the backend is missing, unavailable, or times out, the form shows an error and does not request a reset email. Firebase reset-link verification and delivery still use Firebase Authentication. The database check applies to this application's recovery form; it does not replace Firebase's own account-recovery policy.

## CRUD and trusted workflows

### Organizer drafts and buyer rules

My Events opens drafts with **Edit Draft**, starting at Basic Info so organizers
can change the name, date, venue, description, and media. **Save Draft** keeps
current inputs without requiring every field or submitting the event.
**Continue to Tickets & Rules** validates the basic details and selected venue.
Changing the venue resets its ticket category mappings while preserving other
details and rule inputs.

On Tickets & Rules, adding, editing, and removing categories changes the current
form. Save Draft persists those changes, unfinished category fields, blank rule
inputs, and switch states. Returning with Edit Event Details saves current
configuration work first. **Review & Submit** validates the event and opens a
review; only **Submit for Administrator Approval** submits it. Pending and
published events retain the existing editing restrictions.

Organizers choose which venue sections to use and how many tickets to sell in
each. Selling 25 tickets in a 250-seat section is valid; unused sections and
seats stay off sale. Capacity is only an upper limit. Review automatically
includes a complete category currently in the editor and does not block on an
unchanged copy of an already configured category.

Configuration validation shows an error below the relevant input, highlights
it, and scrolls to and focuses the first field needing attention. Editing the
field clears its error. Invalid saved categories open in the category editor;
missing basic event details point back to Edit Event Details. General loading
or save-service failures retain the page-level message.

The organizer preview and buyer event page use the same rule summary: sales
dates in Malaysia time (UTC+8), ticket holding limits, transfer requirements,
resale dates, percentage or fixed price caps, and price examples for each
category. Service charges are described separately. Unfinished form state lives
in `Events.configurationDraft` and is removed on completion. The checked-in
Firestore Rules permit it only for editable drafts.

Run `node --test tests/organizer-drafts.test.cjs` for form and summary checks.
With the private Firebase configuration available, run
`node scripts/test-local-organizer-drafts.cjs` to test the actual EventService
using a temporary organizer/event, then remove those fixtures afterward.


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

Local XAMPP checkout is enabled separately through `TICKSECURE_PHP_CHECKOUT=1` in `.htaccess`. On localhost (outside Emulator mode), seat maps, reservation, release and checkout automatically use the authenticated PHP bridge. Choose a category/quantity on the event page, choose exact seats, reserve them, connect MetaMask, then confirm a simulated payment. The demo collects no card details and submits no blockchain transaction. The confirmation page and My Tickets show the resulting booking/tickets. Retries for the same purchased seats return the original booking. See [local checkout setup](api/README.md#current-local-checkout) for configuration and live test instructions.

### Ticket transfer receipts

Open **My Tickets → Sent & received** to see transfers involving your account. Each receipt shows the sender and receiver names and full wallet addresses, transfer time (UTC+8), event, venue, category, section/seat, ticket ID and transfer reference. Sent/Received filters and search help locate a record. Ticket details and the transfer form also link to this history; a successful transfer opens its receipt.

Both participants keep access to their receipt after ownership changes, including when the receiver later sends the ticket onward. Only the current owner gets the entry-ticket link. New transfers save display identities and ticket details at the time of transfer; older audit records are supported with a note that names reflect current profiles. Receipts do not expose account emails or QR data.

Localhost uses the authenticated PHP `transferTicket` and `getTicketTransfers` actions through the existing `TICKSECURE_PHP_TRANSFER=1` flag. Updated PHP files work immediately. For Firebase hosting, deploy `firebase deploy --only functions:transferTicket,functions:getTicketTransfers`, or restart the Functions emulator. This addition uses existing protected audit records and needs no new collection, rules or composite indexes. No deployment is performed automatically.

Run `node --test tests/ticket-transfer.test.cjs tests/transfer-history.test.cjs tests/ticket-pages.test.cjs` for transfer validation, sender/receiver access, legacy records, private-field filtering and receipt UI checks.

### Sepolia blockchain and Firebase hashes

Buyers perform real Sepolia ERC-721 operations from **My Tickets → My blockchain**: the purchaser mints, the sender transfers, and the resale buyer receives the NFT. The backend issues an exact, short-lived permission; the buyer approves MetaMask and pays test ETH gas. Admins monitor activity and perform one-time setup; organizers view only their events. Firebase saves real hashes in `BlockchainTransactions.transactionHash`, confirms them after two verified confirmations, preserves the mint hash in `NFTTickets.transactionHash`, and stores the latest operation in `NFTTickets.blockchainLastTransactionHash`.

An active admin must first register the buyer-enabled contract using a setup wallet and the backend authorization signer. Admin email verification is not required, including for blockchain setup; buyer and organizer verification remains required. Local PHP delegates blockchain actions to the shared Node service; its permission-signing key remains outside `htdocs`. Ticket payments remain simulated. Existing Firebase workflows queue NFT work separately, so chain ownership can lag application ownership until the buyer approves and confirms. See [setup, buyer workflow, recovery, deployment and tests](blockchain/README.md).

### Simple venue and seat-category setup

Admin venue setup uses three steps: **Upload floor plan → Review seats → Activate venue**. Detected seats are numbered automatically **row by row**: finish the front row left to right (1, 2, 3…), then continue numbering the next row toward the back. Physical rows are identified using seat positions and measured angles; matching rows in separate banks share the same row label and number continuously across aisles. Numbers continue across sections and pages without duplicates. Detected positions, angles, aisles and dimensions stay unchanged. If no stage is detected, rows start at the top of that page. Use **Adjust layout → Pick stage** to place a stage point and renumber automatically. Existing unnumbered drafts and drafts using the previous distance-based auto numbering are corrected when opened; active layouts and manual numbering are not automatically changed. Save Draft or Review & continue persists the corrected numbers.

The main view shows the numbered plan with a short status, with no manual numbering step. Correction tools, manual numbering overrides and **Renumber rows** stay inside **Adjust layout**. Automatically assigned numbers are visible over the original image. Shared diagonal outlines receive a gap-repair detection pass; no chairs are filled into empty aisles. Review the detected seats and their numbers before activation.

Admin and organizer maps display a rectangular stage and one shared rectangular seat size per floor. This is a display convention: physical seat IDs, detected positions, dimensions, rotation, numbering, and capacities are preserved in the venue data. Admin review keeps the uploaded artwork under **Original floor plan** for comparison.

For a positioned venue, organizers can click seats, drag a selection box (Shift adds seats), or choose a section/row and **From seat / To seat → Select range**. Give the selection a category name, colour and price. Ticket quantity follows the selected seats. Multiple categories can share one physical section, and one category can span several banks. Assigned seats cannot be selected for another category. Unselected seats remain off sale. Save Draft preserves unfinished selections and colour; editing a category retains its allocation ID. Older section-only venues keep their quantity-based configuration.

The exact allocation is stored as `Events.categories[allocationId].seatLabels`, using the full physical identifiers, with optional `color`. Both trusted backends validate the entire allocation before creating inventory: labels must exist at the venue, quantity must match the unique selection, and categories must not overlap. Event inventory keeps its category allocation in `sectionId` and its source section in `physicalSectionId`. Existing section-keyed categories remain supported. Physical venue records and geometry are unchanged by event category choices.

Buyer pages show category colours and numbered seating, then a compact selection summary. Identifier search and automatic assignment are optional disclosures. The primary action changes from reserving seats to continuing after a valid hold is created. Held/sold seats remain unavailable, with the same server-side reservation and checkout validation.

Local XAMPP uses the updated PHP files immediately. For deployed Functions, deploy the changed `getEventAvailability`, `getSeatMap`, `reserveSeats`, `holdSelectedSeats` and `checkout` functions together, or restart the Functions emulator. No deployment is performed automatically.

Run `node --test tests/seat-categories.test.cjs tests/organizer-drafts.test.cjs tests/seat-shapes.test.cjs tests/seat-layout-tools.test.cjs tests/seat-picker.test.cjs` for allocation parity, draft restoration, angled-outline detection, numbering and reservation checks.

### Buyer seat picker

Event categories open `buyer/seat-picker.php`. Buyers select the requested number
of available seats in the 3D venue, 2D plan or searchable identifier list, then press **Reserve
selected seats** for a ten-minute hold. Held and sold seats are disabled. The
server checks every selected ID, sales policy, buyer limit and current inventory
atomically; a conflict reserves none of the requested seats. Changing the same
section's selection releases the previous seats in that transaction. Checkout
uses those exact IDs and the existing wallet and simulated-payment workflow.
The automatic-assignment page remains available as a fallback.

The buyer picker opens in **3D view**. Drag to orbit the venue, use + / minus to
zoom, select a chair, then press **View from this seat** to look toward the stage
from that saved position. **Back to overview** returns to the whole venue.
Selected-seat chips also open the seated preview. Arrow keys browse chairs,
Enter selects, V opens the seated view, and Escape returns to the overview.
The **2D plan** and searchable seat list remain available; switching views keeps
exact seat IDs and the current selection. Multiple blueprint pages stay separate.

Turn on **Show people** to preview sample people seated nearby. Figures breathe
and gently move their heads; **Pause animation** keeps them still, and switching
**Show people** off removes them. Selected seats and your viewing seat stay clear.
These are illustrative figures, not actual attendees or an indication that a
seat is booked: use the seat colours for availability. The choice is off by
default and lasts for the current page. Motion respects reduced-motion settings
and stops in hidden tabs, off-screen views and the 2D plan. Audience size and
frame rate are bounded for larger venues.

The local canvas renderer uses uniformly sized 3D chairs, a rectangular stage,
and the blueprint's aspect ratio and seat centres. A picked stage position takes
priority over a detected stage. Missing stage positions are estimated at the top
and labelled as estimated. This is an illustrative flat-floor model, not a photo
or verified sightline: real dimensions, slopes, balconies, people, barriers and
other obstructions are not inferred from a 2D upload. No viewing guarantee is made.

Only the chosen category's allocated seats can be selected. Other physical chairs
appear in grey for spatial context, with no inventory IDs or availability exposed.
`getSeatMap.geometry.layoutSeats` contains at most 5,000 sanitized physical labels,
numbers and positions; page geometry includes an explicit stage point when saved.
No new database fields or third-party rendering assets are needed. Contextual
chairs require the updated `getSeatMap` backend; older responses still show the
offered seats. Unsupported canvas falls back to the working 2D plan.
The source image is used by admins only. Legacy unpositioned layouts use the identifier list. Availability polls every
30 seconds; reservation always rechecks it. The interactive response is capped
at 5,000 event seats; larger events use automatic assignment.

The PHP route is ready on localhost. For Firebase-hosted mode, deploy the updated
`getSeatMap`, `holdSelectedSeats` and `reserveSeats` functions (and existing
Firestore rules/indexes), or restart the Functions emulator. No deployment is
performed by the implementation scripts.

Run `node --test tests/seat-view-3d.test.cjs tests/seat-view-people.test.cjs tests/seat-picker.test.cjs tests/seat-picker-policy.test.cjs` for 3D geometry, audience motion and lifecycle, stage-facing cameras, page separation, camera controls, privacy parity, fallback and exact-seat reservation checks.

### Remaining seats on event details

Event details display total and per-category remaining seats, plus remaining counts on the venue sections. Counts subtract sold seats and active reservations from the event allocation; expired reservations are reusable. Physical venue capacity stays separate. The read-only `getEventAvailability` action returns aggregate counts for published events only, without exposing seat IDs or reservation owners. It does not create inventory. Counts refresh every 30 seconds while the page is visible, on returning to the tab, or using Refresh; reservation still checks availability again.

Local XAMPP uses the existing checkout-enabled PHP route automatically, including for guests. Firebase/Emulator mode uses the matching callable; deploy `firebase deploy --only functions:getEventAvailability` or restart the Functions emulator after this update. Firestore inventory rules stay private.

## Blueprint upload troubleshooting

Seat detection keeps up to 2,200 pixels on the long edge (at most four million pixels per scan) and checks dark and faint outlines. OCR stage, foyer, exit and other annotation areas are excluded before seat numbering. Isolated letter holes are also filtered from dense chair plans. A shared background that contains both a stage label and seating is not treated as an all-stage exclusion. Shape detection supports the existing 3,000-seat draft limit; it has no 100-seat cap. For chair-icon plans, regional OCR avoids scanning every chair glyph. If a large text crop has poor recognition, a second smaller text pass is attempted without shrinking the seat-detection image.

After updating the scanner, use **Scan status & settings → Detect Seats & Read Labels** to reprocess the saved blueprint. A rescan replaces the draft's old candidates; review and save the new result before activation. Counts reflect detected chair symbols, so a drawing with 165 chairs should remain 165 even when a larger layout is supported.

The venue layout upload shows the storage transfer percentage, file-link lookup,
and Firestore save as separate stages. A transfer with no new bytes for 30
seconds is cancelled; the total transfer/file-link wait is capped at two minutes.
PNG and PDF blueprints up to 10 MB are accepted. Every upload runs Tesseract.js
OCR and OpenCV.js shape detection in the administrator's browser, using the
bundled assets under `assets/lib/tesseract/` and `assets/lib/opencv/`. The shape
detector runs in a separate worker. No OCR API key or Python service is needed.
Rasterized PDF pages (up to ten) use the same OCR pipeline as PNG images.

OCR words and image color regions produce editable section polygons. OpenCV
detects small seat dots and outlined boxes, including touching colored dots;
labels such as A1/A2 retain their observed positions. Automatic mode distinguishes
small seat shapes from large section blocks. Choose **Individual seats** to force
shape import, or **Sections and standing areas** for section maps. Minimum and
maximum pixel-size controls filter detections on the scanned image. Section-only
plans leave capacities at zero; admins must enter them. OCR can miss or misread
small, rotated, low-contrast text, and boundaries are approximations. Review each
section before generation/activation. No reference template, fixed section count,
or invented seat capacity is substituted for failed OCR. Failed scans keep the
uploaded file, show an error and offer manual review or a rescan. New uploads clear
old geometry so it cannot accidentally be used with a different blueprint.

**Detect Seats & Read Labels** scans a stored blueprint using the authenticated
download path. PNG and PDF review show one original page behind transparent
selectable frames; source labels are not redrawn over the image. Use Select to
drag a selection box, Shift to add seats, and drag selected seats to move them.
The editor supports pan/zoom, add/delete, undo, individual dimensions/rotation,
straight-row and arc generation, row letters/numbers, reverse numbering and
odd/even numbering. For curved-row grouping, pick the stage centre first.
Group into physical sections and verify every row, seat label and capacity
before activation. Detected shapes receive consecutive numbers automatically, left to right, row by row from the stage; no chairs
are invented from a section-only illustration. Drafts allow up to 3,000 positioned
seats. Scanned geometry and OCR status persist in Firestore; the
source image and complete OCR output are not cached in session storage.

Run `node --test tests/*.test.cjs` for deterministic checks. To exercise the real
engine without accounts or cloud writes:

```powershell
npm.cmd install --prefix tmp/ocr-runtime --no-save tesseract.js@6.0.1 '@napi-rs/canvas@0.1.80'
node scripts/verify-blueprint-ocr.cjs
```

On localhost, venue blueprint uploads use the dedicated PHP route enabled by
`TICKSECURE_PHP_BLUEPRINT_UPLOAD=1` in `.htaccess`. It verifies the signed-in
administrator's Firebase ID token, saves the PNG or PDF in `storage/blueprints/`, and
updates the venue metadata in Firestore. Direct access to that directory is
denied; downloads require the administrator token through the same endpoint.
This route uses the existing private Firebase configuration and needs no shared
browser upload token, Firebase Storage bucket, or backend-mode switch. It still
needs internet access for Firebase Authentication and Firestore.

Remote sites and Emulator Suite sessions retain Firebase Storage. Local event
posters use the dedicated route below. Complaint evidence retains
[the separate upload setup](api/README.md#configure-the-full-php-bridge).
See [local blueprint details and verification](api/README.md#local-venue-blueprints).

## Local event posters

On localhost, event posters use `api/event-poster.php`, enabled by
`TICKSECURE_PHP_POSTER_UPLOAD=1` in `.htaccess`. This uses the existing private
Firebase configuration and requires no Storage bucket, shared upload token, or
backend-mode switch. It verifies the Firebase ID token, active organizer role,
verified email, ownership, and `DRAFT` event status. Active administrators retain
their existing email-verification exception.

Only content-validated JPG/PNG images up to 5 MiB are accepted. The server assigns
a random filename under `uploads/posters/` and saves the public image URL to the
event in a Firestore transaction. Poster images are public artwork, like the
normal Firebase Storage poster path. The directory permits only server-named
JPG/PNG files through the static handler; image files are ignored by Git.
Keep them in local backups.

If a poster fails after the event details were saved, the editor reports both
states correctly and retains the selected image for retry. Remote and emulator
sessions keep their normal Firebase Storage uploads.

Run `node scripts/test-local-poster.cjs` with Apache running for isolated live
JPG/PNG upload, authorization, and public image retrieval checks. It removes
its temporary accounts, event, and image files afterward.

## Production-readiness requirements

The current trusted backend is a development foundation with simulated payments and an optional Sepolia ticket NFT integration.

- **Payments:** checkout and resale purchase currently write `SIMULATED_PAID`. Before accepting money, integrate a payment provider, verify server-side payment/webhook events, make operations idempotent, and implement failure, cancellation, refund, and reconciliation paths.
- **Blockchain:** buyers publish their own queued mint, transfer and resale NFT operations through MetaMask on Sepolia using backend-signed permissions. The backend verifies the contract, buyer, calldata, receipt and confirmations before saving confirmed results. Admins manage setup/monitoring; organizers have scoped monitoring. Pending records retain a blank hash until submitted. See [blockchain setup and synchronization limits](blockchain/README.md).
- **App Check:** the current callable Functions set `enforceAppCheck: false`. Enable and enforce Firebase App Check, configure valid application clients, and test legitimate flows before public production use.
- **Uploads:** remote and emulator uploads use Firebase Storage; deploy `storage.rules`, enable Storage in the Firebase project, and keep paths/allowed MIME types aligned with the rules. Local venue blueprints use the administrator-authenticated route above. For other uploads in explicit local PHP mode, `api/upload.php` requires server environment variables, a local token, and a loopback check. Its static local files are not private evidence storage and must not be used for production data.
- **Wallets:** address-format validation is not wallet ownership proof. Before treating wallet identity or on-chain delivery as production-ready, add a signed nonce/challenge flow, canonical unique wallet addresses, and a real custody/provider integration.
- **Operations:** keep Firestore Rules, Storage Rules, indexes, Functions, and the schema documentation in the same release review. Restrictive rules are deliberate; do not weaken them to make a protected browser write succeed.

If this Firebase project already contains browser-seeded records, backfill canonical uppercase workflow statuses, `organizerUid` projections, and `Users.emailVerified` before deploying these rules. Old ticket, booking, and resale records without those fields will not satisfy the scoped production queries.

## Useful checks

```bash
php -l api/upload.php
php -l api/venue-blueprint.php
php -l api/event-poster.php
php -l api/backend.php
php -l api/firebase-admin.php
node --check assets/js/firebase-init.js
node --check assets/js/backend-client.js
node --check assets/js/firestore-crud.js
node --test tests/auth-guard.test.cjs tests/auth-loading.test.cjs tests/admin-users.test.cjs tests/password-reset.test.cjs tests/password-policy.test.cjs tests/event-detail.test.cjs tests/saved-events.test.cjs tests/checkout-flow.test.cjs tests/firebase-admin.test.cjs tests/ticket-pages.test.cjs tests/public-navigation.test.cjs tests/event-availability.test.cjs
cd functions && npm run check
```

Run PHP syntax checks against edited pages as part of normal development. When a permission-sensitive workflow changes, deploy the rules, indexes, and Functions together and test it with non-privileged as well as authorized accounts.
