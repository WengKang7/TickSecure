# TickSecure Firestore Data Model

This is the canonical Firestore model for TickSecure's trusted Firebase architecture. Collection names and field names are case-sensitive. Monetary values are numeric Malaysian Ringgit amounts, never formatted strings such as `RM688`.

## Security and ownership conventions

- Firebase Authentication owns credentials. Firestore holds the application profile at `Users/{uid}`.
- Only a protected Admin SDK environment may create an `admin` profile or change a user's `role` or `status`. Browser registration creates an active `buyer` or a pending `organizer` only.
- Firebase Authentication is authoritative for email verification. The `syncEmailVerification` callable normally projects a verified Firebase Auth ID-token claim into `Users.emailVerified`. For a Spark-only local demo with no callable backend, Firestore Rules allow only the account carrying that verified ID-token claim to set its own projection to `true`.
- Browser clients can perform the role- and ownership-scoped CRUD allowed by `firestore.rules` (for example, profile data, organizer event drafts, venues for administrators, complaints, and notification read state).
- Browsers must not directly create or settle bookings, reserve/sell inventory, issue/transfer/scan tickets, settle resale, or write audit or blockchain records. Those are callable Functions/Admin SDK operations.
- `organizerUid` on bookings, tickets, and resale listings is a backend-written authorization projection copied from the event. It enables organizers to query records for their own events without granting access to all customer records.
- The current browser services and Functions write ISO 8601 timestamp strings. If the project migrates to Firestore `Timestamp` values, migrate readers, writers, rules, and indexes together rather than mixing types in a live collection.
- Seed data and the first administrator belong in the Emulator Suite or a protected Admin SDK script. Never ship browser seed code, service-account keys, or demo administrator credentials.

## Inventory model

`Seats` and `EventSeats` intentionally serve different purposes:

1. `Seats` is the reusable physical layout for one venue. An administrator generates it when activating a venue layout.
2. `Events.categories` maps commercial categories to physical section IDs and specifies the number of seats allocated to that event.
3. On the first trusted reservation or checkout for a published event, the backend clones the allocated physical seats into `EventSeats`. Its deterministic document IDs are `${eventId}_${sourceSeatId}`.
4. Only `EventSeats` carries the event-specific `AVAILABLE`, `RESERVED`, and `SOLD` state. A reservation or sale for Event A must never affect Event B's inventory at the same venue.

The backend creates only missing `EventSeats` documents, so a later request cannot overwrite a reservation or completed sale. In the trusted production path, do not use `Seats.status` to calculate event availability.

## Collections

### `Users/{uid}`

The base authenticated-user profile.

| Field | Type | Notes |
| --- | --- | --- |
| `email` | string | Must match the Firebase Auth email at self-registration. |
| `emailVerified` | boolean | Read-model projection of Firebase Auth's verified email claim. Firebase Auth remains authoritative; rules use the verified ID-token claim and only permit a verified owner to project this field to `true` when the trusted sync backend is unavailable. |
| `fullName` | string | User-editable display name. |
| `role` | string | `buyer`, `organizer`, or trusted-backend-only `admin`. |
| `status` | string | `active`, `pending`, `suspended`, or `rejected`. |
| `walletAddress` | string | Optional connected wallet address; checkout and resale purchase require one. |
| `suspendReason`, `rejectReason` | string | Optional administrator-only moderation data. |
| `createdAt`, `updatedAt` | ISO 8601 string | Creation and modification times. |

### `OrganizerProfiles/{uid}`

One profile per organizer; the document ID equals `Users/{uid}`.

| Field | Type |
| --- | --- |
| `organizationName` | string |
| `organizationDescription` | string |
| `organizationPhone` | string |
| `organizationAddress` | string |

### `Venues/{venueId}`

Administrator-managed venue metadata and confirmed physical layout.

| Field | Type | Notes |
| --- | --- | --- |
| `name`, `address` | string | The application uses `address`, not the older `location` field. |
| `capacity` | number | Sum of configured section seats. |
| `layoutStatus` | string | `DRAFT`, `PROCESSING`, or `ACTIVE`. |
| `sections` | array | `{ sectionId, name, seatCount, geometry }` records. |
| `blueprintUrl`, `blueprintName`, `blueprintSize` | string/string/number | Optional layout-upload metadata. |
| `createdBy`, `createdAt`, `updatedAt` | string | Audit metadata. |

`geometry` contains numeric `left`, `top`, `width`, and `height` values.

### `Seats/{venueId}_{seatLabel}`

Reusable physical seat records generated from an active venue layout. Example document ID: `merdeka-hall_A01`.

| Field | Type | Notes |
| --- | --- | --- |
| `venueId`, `sectionId`, `seatLabel` | string | Physical placement and stable human-facing label. |
| `status` | string | Currently initialized as `AVAILABLE`; it is layout metadata, not event inventory state. |
| `createdAt`, `updatedAt` | ISO 8601 string | Provisioning metadata. |

Administrators own this collection. The trusted backend reads it to construct event-specific inventory; it does not reserve or sell this reusable physical record.

### `EventSeats/{eventId}_{sourceSeatId}`

Backend-created event-scoped inventory cloned from `Seats` according to the event's category allocations. This is the authoritative collection for reservation and sale state.

| Field | Type | Notes |
| --- | --- | --- |
| `eventId`, `venueId` | string | Event and source venue. |
| `sourceSeatId` | string | Document ID of the reusable physical `Seats` record. |
| `sectionId`, `seatLabel` | string | Physical section and label copied from the source seat. |
| `status` | string | `AVAILABLE`, `RESERVED`, or `SOLD`. |
| `reservedBy` | string | Buyer UID while the seat is temporarily reserved; otherwise empty. |
| `reservedAt`, `reservationExpiry` | ISO 8601 string | Reservation timestamps; an expired reservation can be reclaimed by the secure reservation workflow. |
| `reservationEventId` | string | Event ID recorded with a reservation; otherwise empty. |
| `bookingId` | string | Set after trusted checkout sells the seat. |
| `createdAt`, `updatedAt` | ISO 8601 string | Inventory audit metadata. |

Buyer clients do not read this inventory directly because it contains reservation ownership. Callable reservation/checkout responses expose only the caller's selected seat labels; administrators retain read access for operational review. All creation and state changes are performed by the Functions backend.

### `Events/{eventId}`

Organizer-authored events. Public clients may read only `PUBLISHED` records; organizers can read their own non-public records and administrators can read all records.

| Field | Type | Notes |
| --- | --- | --- |
| `name`, `description`, `eventCategory` | string | Event content. |
| `date`, `time` | string | Current UI date/time format. |
| `venueId`, `venueName`, `venueLocation` | string | Venue reference and display snapshot. |
| `organizerUid`, `organizerName` | string | Event owner and display snapshot. |
| `status` | string | `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `REJECTED`, `SUSPENDED`, or `CANCELLED`. |
| `posterUrl`, `startingPrice`, `availability` | string | Display fields. |
| `categories` | map | Keyed by physical `sectionId`; each value is `{ name, price, quantity }`, with numeric `price` and `quantity`. |
| `maxTicketsPerBuyer` | number | Maximum tickets a buyer may currently hold for the event; checkout, transfer, resale purchase, and reservations enforce it. |
| `salesStartDate`, `salesEndDate` | string | Sales-window policy. Date-only values use the product's +08:00 business timezone; the end date is inclusive through 23:59:59.999. |
| `transferEnabled`, `resaleEnabled` | boolean | Event policy switches. |
| `resaleStartDate`, `resaleDeadline` | string | Resale-window policy, evaluated with the same +08:00 inclusive end-date behavior. |
| `maxResaleMarkup`, `maxResalePrice` | number | Percentage and absolute resale caps in RM. |
| `statusHistory` | array | Transition records with `from`, `to`, `changedBy`, optional `reason`, and `timestamp`. |
| `rejectReason`, `createdAt`, `updatedAt` | string | Moderation and audit data. |

### `Bookings/{bookingId}`

Backend-created checkout records. A browser may request checkout but cannot create a confirmed booking directly.

| Field | Type | Notes |
| --- | --- | --- |
| `bookingNumber` | string | Human-facing reference. |
| `buyerUid`, `buyerName` | string | Buyer authorization and display snapshot. |
| `organizerUid` | string | Backend authorization projection from the event. |
| `eventId`, `eventName` | string | Event reference and snapshot. |
| `categoryName`, `sectionId` | string | Purchased category and physical section. |
| `seats` | array of strings | Seat labels, for example `A01`. |
| `seatDocIds` | array of strings | `EventSeats` document IDs sold by the transaction. |
| `quantity` | number | Must match the allocated event seats. |
| `unitPrice`, `serviceCharge`, `totalAmount` | number | Trusted RM values calculated by the backend. |
| `status` | string | Current secure checkout writes `CONFIRMED`; future cancellation/refund states must be backend-managed. |
| `paymentStatus` | string | Current implementation writes `SIMULATED_PAID`; it is not payment confirmation. |
| `walletAddress` | string | Buyer wallet snapshot at checkout. |
| `createdAt`, `updatedAt` | ISO 8601 string | Audit metadata. |

### `NFTTickets/{ticketId}`

One backend-issued entry credential per `EventSeats` record sold in a booking.

| Field | Type | Notes |
| --- | --- | --- |
| `bookingId`, `eventId`, `eventName` | string | Booking and event linkage/snapshot. |
| `organizerUid` | string | Backend authorization projection. |
| `categoryName`, `sectionId`, `seatId` | string | Ticket placement; `seatId` is the human-facing seat label. |
| `ownerUid`, `walletAddress` | string | Current ownership. |
| `tokenId`, `transactionHash` | string | Reserved for real chain identifiers; currently blank in the simulated implementation. |
| `status` | string | Current flows use `VALID`, `LISTED_FOR_RESALE`, and `USED`. |
| `mintingStatus` | string | Current checkout writes `PENDING`; a real minting integration may write `MINTED` or `FAILED`. |
| `qrData` | string | Current opaque ticket payload. Production scanners must continue to rely on server-side ticket/event/status validation. |
| `usedAt` | ISO 8601 string | Entry-use time, otherwise empty. |
| `transferHistory` | array | Backend-created ownership history. |
| `createdAt`, `updatedAt` | ISO 8601 string | Audit metadata. |

### `ResaleListings/{listingId}`

Official-marketplace records. Listing, repricing, cancellation, suspension, and purchase are backend operations because they change listing and ticket state together.

| Field | Type | Notes |
| --- | --- | --- |
| `ticketId`, `eventId`, `eventName` | string | Ticket/event linkage and snapshot. |
| `organizerUid` | string | Backend authorization projection. |
| `categoryName`, `sectionId`, `seatId` | string | Ticket placement. |
| `sellerUid`, `sellerWallet` | string | Seller at time of listing. |
| `buyerUid`, `buyerWallet` | string | Filled on successful resale purchase. |
| `originalPrice`, `resalePrice`, `maxAllowedPrice` | number | Trusted RM amounts. |
| `status` | string | `ACTIVE`, `SUSPENDED`, `CANCELLED`, or `SOLD`. |
| `paymentStatus` | string | Set to `SIMULATED_PAID` by the current simulated resale purchase. |
| `ruleCompliance`, `riskFlag` | string | Pricing and administrator moderation data. |
| `completedAt`, `createdAt`, `updatedAt` | ISO 8601 string | Audit metadata. |

### `Complaints/{complaintId}`

Support cases submitted by buyers or organizers; only administrators may change their investigation or resolution state.

| Field | Type |
| --- | --- |
| `referenceNumber` | string |
| `complainantUid`, `complainantName`, `complainantRole` | string |
| `category`, `description` | string |
| `relatedBookingId`, `relatedTicketId` | string |
| `evidenceUrls` | At most one Firebase Storage download URL; client-created values are restricted to `https://firebasestorage.googleapis.com/...`. |
| `priority` | string |
| `status` | `OPEN`, `UNDER_INVESTIGATION`, `RESOLVED`, or `REJECTED` |
| `timeline` | array of status/note/actor/timestamp records |
| `resolutionAction`, `resolutionExplanation`, `rejectionReason` | string |
| `createdAt`, `updatedAt` | ISO 8601 string |

### `Notifications/{notificationId}`

Per-user system notifications.

| Field | Type |
| --- | --- |
| `recipientUid`, `message`, `type` | string |
| `relatedEntityType`, `relatedEntityId` | string |
| `read` | boolean |
| `createdAt` | ISO 8601 string |

Recipients may mark only their own notifications as read or delete them. Administrators and the trusted backend create notifications.

### `AuditLogs/{logId}`

Immutable backend audit trail. The browser cannot create, change, or delete these records; administrators can read them.

| Field | Type | Notes |
| --- | --- | --- |
| `action`, `entityType`, `entityId` | string | Action and affected record. |
| `actorUid`, `actorEmail`, `actorRole` | string | Server-derived caller snapshot. |
| `details` | map | Non-sensitive workflow context. |
| `result` | string | Current Functions write `success`. |
| `timestamp` | ISO 8601 string | Backend operation time. |

The callable Functions write audit records for inventory reservation/release, checkout, transfer, resale lifecycle changes, and ticket scanning in the same trusted workflow as the associated mutation.

### `BlockchainTransactions/{transactionId}`

Backend-owned blockchain-operation ledger. The collection records intended mint, transfer, or resale operations; it is not writable from the browser and is readable only by administrators.

| Field | Type | Notes |
| --- | --- | --- |
| `transactionHash` | string | Blank in the current simulation; a real provider-confirmed hash belongs here. |
| `walletAddress` | string | Wallet associated with the operation. |
| `transactionType` | string | Current Functions use `MINT`, `TRANSFER`, or `RESALE`. |
| `ticketId` | string | Affected ticket. |
| `relatedEntityType`, `relatedEntityId` | string | Related booking, ticket, or resale listing. |
| `status` | string | Current simulation writes `PENDING`. |
| `network` | string | Current simulation labels this as no chain submission. |
| `failureReason` | string | Empty unless a real integration records an error. |
| `timestamp` | ISO 8601 string | Backend operation time. |

`BlockchainTransactions` is intentionally created by the backend together with the relevant trusted workflow. A simulated `PENDING` record is not evidence that an on-chain transaction was submitted or finalized.

## Trusted backend workflows

The callable Functions in `functions/index.js` enforce authenticated, email-verified caller, role/status, event policy, ownership, pricing, and inventory checks. They are deployed to `asia-southeast1`:

| Callable | Responsibility |
| --- | --- |
| `reserveSeats`, `releaseSeatReservation` | Create/release short-lived caller-owned `EventSeats` reservations. |
| `checkout` | Validate the buyer, sales window, allocation, price, wallet, and reservation; atomically sell `EventSeats`, create the booking/tickets, and create notification/audit/simulated-chain records. |
| `transferTicket` | Validate ownership and transfer policy, update ticket ownership/history, and create notification/audit/simulated-chain records. |
| `createResaleListing`, `updateResalePrice`, `cancelResaleListing`, `suspendResaleListing`, `purchaseResale` | Enforce seller/buyer/admin permission and resale rules while keeping listing and ticket state consistent. |
| `scanTicket` | Validate an authorized organizer/admin and ticket/event/status, then atomically mark a valid ticket as `USED`. |
| `syncEmailVerification` | Verify the caller's Firebase Auth ID-token claim and set `Users.emailVerified`; the browser has a Rules-constrained fallback only for Spark-only local demos where this callable is unavailable. |

Deploy `firestore.rules`, `firestore.indexes.json`, and `functions` together whenever one of these permission-sensitive workflows changes. See [README.md](README.md) for deployment and production-readiness requirements.
