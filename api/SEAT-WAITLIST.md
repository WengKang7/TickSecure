# Per-seat waiting lists

Supported website backends: TickSecure Render and local PHP checkout mode.

Buyers open **Event details -> Wait for a held seat**, choose a category, then
join a particular held seat's waiting list from the seat picker. Quantity must
be one. There is one active entry per buyer per event, and at most 50 waiting
buyers per seat. A buyer cannot queue their own reservation or a sold seat.

Queue insertion and offer assignment use Firestore transactions. Records live
in server-only `SeatWaitlists` and `SeatWaitlistMembers` collections; browser
responses include only the requesting buyer's position or offer. The inventory
stores `hasWaitlist` so other reservation paths cannot take a released priority
seat between requests. The existing Firestore rules deny unmatched collections;
explicit denials for the new private collections are also included in source.

When a hold expires or is released, the next active, email-verified buyer below
the event purchase limit is offered the seat for five minutes. An in-app
notification links back to its picker. Claiming starts the existing ten-minute
reservation. No payment or MetaMask approval is performed automatically. Decline
and expiry advance to the next eligible buyer. A completed sale closes the queue.

Offers advance on server requests: the existing visible seat-map refresh, or
a reservation/checkout request. There is no paid background scheduler. If nobody
is active, the next offer starts when a request processes the released seat;
its five-minute timer starts on issuance. Check notifications or keep the picker
open. Existing 30-second polling is reused; no extra browser polling timer is added.

Cloud Functions retain guards against taking a flagged priority seat. Queue
joining and offer processing use the PHP backend; the Firebase Emulator-only
interface does not expose the new queue controls.

Tests: `node --test tests/seat-waitlist.test.cjs tests/seat-picker.test.cjs`.
