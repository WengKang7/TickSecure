# Email copies of website notifications

Users can receive TickSecure updates in Gmail or any other verified email
mailbox. Brevo's HTTPS transactional API sends the messages. A Gmail API
connection and users' Gmail passwords are not required. Render Free blocks
ordinary SMTP ports, so do not substitute a Gmail SMTP password.

## Setup

1. Create a Brevo account, enable transactional sending if prompted, and verify
   the sender address. Brevo may review a new account before activating it.
   Free email domains may be replaced with a Brevo sending address for
   authentication; a verified custom domain is preferred when available.
2. Create a transactional **API key**, not an SMTP password.
3. Save the following outside the project, at
   `C:\xampp\private\notification-email.env` locally, and as a Render Secret File
   named `notification-email.env`. Never commit this file or paste its key into chat.

```ini
BREVO_API_KEY=your-private-api-key
NOTIFICATION_FROM_EMAIL=your-verified-sender@example.com
```

The sender name is TickSecure. The default link is
`https://ticksecure.onrender.com`. For another HTTPS deployment, set
`NOTIFICATION_APP_URL`. An optional `TICKSECURE_NOTIFICATION_EMAIL_ENV` points
to a different private file. Render environment variables can also supply the
values. `NOTIFICATION_EMAIL_ENABLED=0` disables new queuing and delivery.
Absent or invalid configuration leaves the existing website notifications
working and performs no email queue scans. No old notifications are backfilled.

Deploy the updated Dockerfile and application files. The Docker startup launches
the PHP email worker alongside Apache; no Firebase paid trigger or paid Render
cron is required. Existing default-deny Firestore rules already protect the new
collection; an explicit `EmailOutbox` denial is included for clarity.

For local XAMPP, run a separate worker while demonstrating:

```powershell
C:/xampp/php/php.exe api/notification-worker.php --watch
```

For one bounded delivery pass, omit `--watch`. This is a CLI-only script;
requests through the website cannot run it. The worker must remain running
locally for automatic delivery. Render starts it automatically.

## Which messages are emailed

New notifications written by the trusted PHP workflows are copied, including
booking confirmations, transfer receipts for recipients, resale updates, event
decisions and waiting-list notices. Administrator-originated notifications use
the authenticated `createNotification` endpoint, preserving the previous
administrator-only creation permission. Existing website lists and badges stay
unchanged. Calculated administrator attention badges are not saved notification
records and are not separately emailed by this feature.

Verification and password-reset emails remain Firebase Authentication emails.
The email worker is for the Render/local PHP deployment. Emulator and separately
deployed Cloud Functions-only notification writers are not email-enabled here.

Each recipient is resolved from their Firebase Auth UID at delivery time. Only
the verified Auth email is used; a browser or editable profile cannot choose a
different destination. There is one recipient per message. Templates escape
notification text and include a sign-in link, with no QR images, face captures,
biometric templates, attachments or wallet secrets.

## Reliability and database usage

The notification and deterministic `EmailOutbox/{notificationId}` record are
created in the **same transaction**. A failed transaction creates neither. The
worker sends after commit, so an email provider failure cannot roll back a
successful booking. A local wake signal is written only after commit; the
worker checks it every five seconds without querying Firestore each time.
An idle enabled worker checks its pending queue every five minutes (about 288
minimum empty-query reads/day while continuously awake), plus the actual job
reads and writes. There is one additional outbox write per new notification.
No extra browser polling or scan of historic notification collections is added.

Atomic claims prevent overlapping workers from sending the same job. Brevo
receives a stable idempotency key as an additional safeguard. Explicit provider
rate rejection or a failed account lookup retries at most three times with a
delay. A lost send response, provider server error or interrupted send is marked
`UNKNOWN` and is not automatically resent, because it might have been accepted.
Inspect Brevo logs before any manual recovery of these records. Do not blindly
reset `UNKNOWN`/`ACCEPTED` jobs to pending.

`ACCEPTED` means Brevo accepted the request, **not** confirmed inbox delivery.
Spam filtering, sender verification and provider limits still apply. The free
Brevo allowance is currently 300 messages/day and can change. An exhausted
allowance or unavailable sender does not stop the original website action.
Jobs expire after 24 hours. Waiting-list offer emails expire at the actual offer
deadline, so an old unprocessed offer is not sent as a current opportunity.
Always open the website for the latest seat/ticket state.

Render Free can sleep; the worker is not an independent always-on service.
Notifications are queued when a business request runs and normally wake the
worker within seconds. A restart recovers pending work; delayed work resumes
while the service is awake. Do not promise exact delivery time or offline
background reminders.

## Validation

```powershell
C:/xampp/php/php.exe tests/notification-email.test.php
node --test tests/firebase-admin.test.cjs tests/buyer-notifications.test.cjs tests/seat-waitlist.test.cjs tests/resale-workflows.test.cjs tests/ticket-transfer.test.cjs
```

The email tests use a fake transport and synthetic accounts: no real messages
are sent. After configuration and deployment, use a dedicated verified buyer to
perform one authorized test action, then check Gmail Inbox/Spam and Brevo's
transactional logs. Do not bulk-send historic notifications as a test.

Provider documentation:
- https://render.com/docs/free
- https://developers.brevo.com/docs/send-a-transactional-email
- https://help.brevo.com/hc/en-us/articles/208580669
- https://help.brevo.com/hc/en-us/articles/16045394674066


### Waiting-list seat offers

When the queue issues its five-minute offer, the same transaction creates an
in-app notification and an email job. The email has a seat-availability subject
and a link to the correct event/category picker. Delivery rechecks that the
recipient still owns that unexpired offer, so a claimed or declined offer is
not emailed as current. Existing queue advancement remains request-driven;
seat-map refreshes check availability every 30 seconds while visible. The
worker delivers issued offers; it does not independently expire seat holds.

The visible seat picker also opens a Claim seat / Later dialog once for each
offer. It reuses the existing map response, adding no database polling. Choosing
Claim seat uses the existing reservation flow; Later leaves the claim button
available until expiry. Popup confirmation rechecks the session and expiry.
Render must be awake with notification-email.env installed for email delivery.


### Alerts across TickSecure pages

The buyer header now checks only that buyer's live queue offers alongside its
existing 30-second notification refresh. Hidden tabs pause, then check when
visible again. A red warning dialog with an exclamation mark links directly to
the offered event/category. The picker handles its matching offer locally;
session storage prevents repeat popups when moving between pages in one tab.
A busy confirmation dialog is allowed to finish before an offer popup appears.

New waiting-list memberships include the buyer UID so a header check can advance
that buyer's expired queued holds without loading unrelated seats. Older
memberships are upgraded automatically when their buyer opens the seat picker,
without changing queue order. They also receive alerts whenever an offer has
already been issued by a release or picker refresh.
The browser must have a TickSecure page open; email remains the off-site channel.


### Provider key compatibility

Each notification uses a stable 36-character UUIDv5 for Brevo idempotency.
The original 64-character digest was rejected with HTTP 400 (`out_of_range`,
`Idempotency key exceeds char limit`). The replacement keeps retries tied to the
same notification while satisfying the provider key format. Both request forms
were checked using Brevo's no-delivery mode: the old key failed; the UUID passed.
Failed historic jobs are not automatically resent, and expired seat offers must
not be revived. Test new notifications after deploying this correction.
