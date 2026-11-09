# Event content review (Gemini, local XAMPP)

Organizers submit saved event text through the authenticated PHP backend. Gemini checks the name, description, event category, venue name/address and ticket category names. No buyer information, faces, private keys or payment data is sent. Event text is untrusted data in the model prompt. Images/posters, permits, factual accuracy and legal compliance are not verified.

- **PASS:** saved as PENDING_REVIEW. Only an active administrator can publish, after a server-owned pass for the current text.
- **REJECT:** automatically saved as REJECTED, with the specific reason, quoted evidence, system history, audit entry and organizer notification. The organizer can use My Events → Revise and resubmit.
- **REVIEW:** intent is ambiguous; keep the organizer's event as DRAFT for clarification. An existing pending/unavailable event stays unpublished and cannot be approved.
- **ERROR:** unavailable provider, invalid key, quota, safety-blocked output, timeout or invalid JSON/evidence. Keep unpublished, record the failure and allow retry. No automatic retry or silent pass.

Words such as “kill” or “die” alone do not imply harmful intent. A music act's name, fictional title or suicide-prevention event can pass. Only explicit harmful real-world event intent should trigger rejection. This is an AI screening aid and can make mistakes; it is not legal advice or proof that an event is lawful. Administrators still review all passing submissions.

## Private configuration

Default file: `C:/xampp/private/gemini.env` (outside htdocs). Never commit it or place it in browser code.

```dotenv
GEMINI_API_KEY=replace_with_your_actual_Google_AI_Studio_key
GEMINI_MODEL=gemini-flash-lite-latest
```

The private file can alternatively contain just the API key on one line. Optionally set `TICKSECURE_GEMINI_ENV` in the server environment to another private file. The file must remain outside the web root. The key is sent only to `generativelanguage.googleapis.com` in an HTTPS header. Provider response bodies and credentials are not logged or returned to the browser.

The `.htaccess` flag `TICKSECURE_PHP_EVENT_REVIEW=1` enables only the loopback event-review/moderation subset. Local requests route to PHP regardless of the browser's normal Firebase mode. The new actions are `submitEventForReview` (owning active verified organizer) and `checkEventContent` (active admin, pending or suspended event). `moderateEvent` owns all moderation transitions. No new Gemini Cloud Function is included: remote/Emulator deployments need a corresponding trusted backend before using this flow.

## Database enforcement

Deploy the accompanying `firestore.rules` to the same Firebase project before relying on bypass prevention. It denies direct browser submissions/publication and writes to private `EventContentReviews` and `EventReviewLimits` collections. Event review summaries are server-written. Admin publication/restoration checks the private verdict, policy version and SHA-256 of the actual current event text inside its transaction; a forged summary cannot authorize approval. Existing published events are not automatically rescanned or unpublished. Older pending/unavailable events must use **Run AI check** before approval/restoration.

The provider runs outside Firestore transaction retries. A 90-second lease prevents duplicate parallel checks; a changed event or replaced lease discards a stale answer. Up to five new provider assessments per account per ten minutes are allowed. Exact unchanged PASS/REJECT assessments are reused to reduce requests; no guarantee of free API usage is made. Google's own model availability, quotas and charges apply.

## Validation

```powershell
C:/xampp/php/php.exe tests/event-content-review.test.php
node --test tests/admin-event-review.test.cjs tests/event-unavailable.test.cjs tests/organizer-event-detail.test.cjs
```

These use synthetic records, do not call Gemini, and do not change Firebase. Optional live Gemini smoke test (two synthetic descriptions, no Firebase writes):

```powershell
C:/xampp/php/php.exe tools/check-event-ai.php
```

Official API reference: https://ai.google.dev/api/generate-content
