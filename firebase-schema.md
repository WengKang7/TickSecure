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
2. `Events.categories` maps category allocation IDs to either an exact list of physical seat labels or a legacy physical section and ticket quantity.
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
| `favoriteEventIds` | string[] | Optional event IDs saved by this user. |
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
| `blueprintMimeType` | string, optional | `image/png` or `application/pdf`; older records may infer the format from the filename. |
| `createdBy`, `createdAt`, `updatedAt` | string | Audit metadata. |

`geometry` is optional for older rectangular layouts. OCR maps use
`{ type: "polygon", layout: "ocr", points: [{ x, y }], fill, labelX, labelY,
kind, page, imageWidth, imageHeight, confidence, reviewed, boundarySource }`.
Points use the renderer's `104 x 106` coordinate system. The original aspect ratio
is restored from `imageWidth/imageHeight`. `kind` is `seated` or `standing`.
`boundarySource` is `color-region`, `text-bounds` or `seat-shapes`; all detected regions start
with `reviewed: false`. Optional `decorations` preserve stage/FOH geometry detected
from the source. Existing arena-zones/standing-bowl geometry remains readable.

Optional `seatMarkers` entries are `{ id, label, row, number, x, y, width, height,
rotation, shape, color, labelSource, confidence }`. Legacy markers may contain
only `{ label, x, y, confidence }`. `width/height` share the normalized coordinates;
`rotation` is in source-image degrees and `shape` is `rect` or `circle`. Stable
marker IDs survive draft regrouping; physical seat IDs are created on activation.
`labelSource` is `auto`, `ocr`, `unlabelled`, `grouped` or `manual`. Detected seats automatically receive consecutive numeric labels, left to right within each physical row, then continuing with the next row away from the stage. `row` identifies the detected physical row, including matching row segments across aisles. `geometry.nonSeatAreas` optionally stores OCR annotation exclusion polygons (`{ name, points }`), which are checked alongside stage decorations before numbering; these are not physical seats. Position, dimensions and rotation stay unchanged. `geometry.numbering` stores `{ mode: 'row-by-row', start, stageSource, stagePoint? }`, where `stageSource` is `detected`, `picked` or `top` (top-of-page fallback). Numbering spans sections and pages without duplicates. Review is still required before activation. Drafts support up to 3,000 positioned markers.
Their length determines the proposed seat count. On
activation, their human-facing seat identifier is `{sectionId}-{label}`. Without
individual markers, section capacity starts at zero and must be entered manually;
those seats retain the legacy `{sectionId}{paddedIndex}` format and their positions
within the section are illustrative. Standing capacity does not imply fixed seats.

`blueprintAnalysis` records `{ status, sourceName, sourceSize, sourceHash, engine,
scannedAt, pages, sectionCount, message }` as available. Status is `PENDING`,
`FAILED` or `NEEDS_REVIEW`. Each `pages` entry is `{ page, width, height, sections,
mode, shapes }`, where mode is `seats` or `sections`.
`blueprintHash` holds the original file SHA-256 so a completed scan cannot replace
a newer file's geometry even when its filename and size are identical. New uploads
clear old sections and mark analysis pending. Every OCR section needs a verified
positive capacity and explicit review before activation. OCR never assigns event
prices or ticket categories.

### `Seats/{venueId}_{seatLabel}`

Reusable physical seat records generated from an active venue layout. Example document ID: `merdeka-hall_A01`.

| Field | Type | Notes |
| --- | --- | --- |
| `venueId`, `sectionId`, `seatLabel` | string | Physical placement and stable human-facing label. |
| `status` | string | Currently initialized as `AVAILABLE`; it is layout metadata, not event inventory state. |
| `createdAt`, `updatedAt` | ISO 8601 string | Provisioning metadata. |
| `position` | map, optional | `{ x, y, page, width, height, rotation, shape }` for positioned seats. |
| `rowLabel`, `seatNumber` | string, optional | Reviewed row and number copied from the marker. |

Administrators own this collection. The trusted backend reads it to construct event-specific inventory; it does not reserve or sell this reusable physical record.

### `EventSeats/{eventId}_{sourceSeatId}`

Backend-created event-scoped inventory cloned from `Seats` according to the event's category allocations. This is the authoritative collection for reservation and sale state. `sectionId` is the event category allocation ID; `physicalSectionId` records the physical source section on newly created records. `sourceSeatId` and the unchanged physical `seatLabel` identify the actual chair.

| Field | Type | Notes |
| --- | --- | --- |
| `eventId`, `venueId` | string | Event and source venue. |
| `sourceSeatId` | string | Document ID of the reusable physical `Seats` record. |
| `sectionId`, `seatLabel` | string | Physical section and label copied from the source seat. |
| `position`, `rowLabel`, `seatNumber` | map/string/string, optional | Geometry and row numbering copied from physical seats; older inventory can use locked venue marker geometry as a read fallback. |
| `status` | string | `AVAILABLE`, `RESERVED`, or `SOLD`. |
| `reservedBy` | string | Buyer UID while the seat is temporarily reserved; otherwise empty. |
| `reservedAt`, `reservationExpiry` | ISO 8601 string | Reservation timestamps; an expired reservation can be reclaimed by the secure reservation workflow. |
| `reservationEventId` | string | Event ID recorded with a reservation; otherwise empty. |
| `bookingId` | string | Set after trusted checkout sells the seat. |
| `createdAt`, `updatedAt` | ISO 8601 string | Inventory audit metadata. |

Buyer clients do not read this inventory directly because it contains reservation ownership. The authenticated `getSeatMap` action exposes offered seat IDs, labels, safe geometry and `AVAILABLE`, `MINE`, `HELD`, `SOLD` or `BLOCKED` status. Only `MINE` includes an expiry. It never exposes owners or booking IDs. `holdSelectedSeats` verifies exact event/venue/section membership, the buyer limit and availability in an all-or-nothing ten-minute transaction. Administrators retain inventory read access; the Functions backend or authenticated local PHP bridge performs state changes.

### `ReservationLocks/{sha256(eventId + "|" + buyerUid)}`

Private backend-only `{ eventId, buyerUid, updatedAt }` records serialize the same
buyer's automatic and exact-seat reservation changes, including across sections.
All browser reads and writes are denied. Seat documents themselves enforce
competing buyers' availability through transaction conflicts and retries.

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
| `categories` | map | Keyed by category allocation ID (legacy entries use physical `sectionId`). Each value is `{ name, price, quantity, seatLabels?, color? }`. `seatLabels` lists the exact full physical identifiers; quantity must match its unique entries and categories cannot overlap. Without `seatLabels`, the key selects a physical section using the legacy quantity allocation. |
| `configurationDraft` | map, optional | Draft-only form state. `rules` retains raw input strings (including blanks) and switches; `category` retains unfinished `name`, `sectionId`, `price`, `quantity`, `editingSectionId`, and optional `seatLabels`/`color`. Completed categories stay in `categories`. Removed before submission. |
| `maxTicketsPerBuyer` | number | Maximum tickets a buyer may currently hold for the event; checkout, transfer, resale purchase, and reservations enforce it. |
| `salesStartDate`, `salesEndDate` | string | Sales-window policy. Date-only values use the product's +08:00 business timezone; the end date is inclusive through 23:59:59.999. |
| `transferEnabled`, `resaleEnabled` | boolean | Event policy switches. |
| `resaleStartDate`, `resaleDeadline` | string | Resale-window policy, evaluated with the same +08:00 inclusive end-date behavior. |
| `maxResaleMarkup`, `maxResalePrice` | number | Percentage and absolute resale caps in RM. |
| `statusHistory` | array | Transition records with `from`, `to`, `changedBy`, optional `reason`, and `timestamp`. |
| `rejectReason`, `createdAt`, `updatedAt` | string | Moderation and audit data. |

Each event may use a subset of the venue's physical sections. Category quantity
can be any positive whole number up to that section's physical capacity; it
does not have to fill the section. Unselected sections and unused physical
seats do not become ticket inventory for the event.

Drafts may contain empty event names, descriptions, dates, and venue references.
Save Draft persists current inputs without requiring the rest of the form.
Continue validates basic event and venue details; Review checks the complete
event, category mappings, and rules. Only the final submit action changes the
status to `PENDING_REVIEW`. Changing the venue clears category mappings and
unfinished category input while retaining rule inputs.

### `Bookings/{bookingId}`

Backend-created checkout records. A browser may request checkout but cannot create a confirmed booking directly.

| Field | Type | Notes |
| --- | --- | --- |
| `bookingNumber` | string | Human-facing reference. |
| `buyerUid`, `buyerName` | string | Buyer authorization and display snapshot. |
| `organizerUid` | string | Backend authorization projection from the event. |
| `eventId`, `eventName` | string | Event reference and snapshot. |
| `categoryName`, `sectionId` | string | Purchased category name and event category allocation ID; legacy allocation IDs equal the physical section. |
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
| `tokenId`, `transactionHash` | string | Blank until verified minting; then the Sepolia token ID (hex) and original mint transaction hash. |
| `status` | string | Current flows use `VALID`, `LISTED_FOR_RESALE`, and `USED`. |
| `mintingStatus` | string | Checkout writes `PENDING`; verified Sepolia minting writes `MINTED`. Reverted chain operations do not mark a ticket minted. |
| `chainId`, `contractAddress` | number, string | `11155111` and the verified Sepolia ticket contract after confirmed publication. |
| `blockchainLastTransactionHash`, `blockchainLastOperationId` | string | Latest confirmed mint/transfer/resale hash and blockchain ledger record ID. The original mint hash stays in `transactionHash`. |
| `blockchainStatus`, `blockchainNetwork`, `blockchainWalletAddress` | string | Last confirmed chain state, Sepolia network and last published token owner wallet. Firebase ownership may be ahead while records are queued. |
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

For `ticket_transferred`, `details.recipientUid` identifies the receiver and
`details.transfer` stores a safe receipt snapshot: ticket/event IDs, event name,
event date/time, venue, category, section/seat, sender/receiver display names and
wallets, and transfer time. `transferTicket` returns the audit document ID as
`transferId`. The read-only `getTicketTransfers` backend filters by the caller's
participation and returns an explicit allowlist of receipt fields, never raw
audit records, email addresses or QR data. Older entries without a snapshot
remain readable using ticket history and current profile names. AuditLogs rules
remain unchanged; buyers do not gain direct collection access.

### `BlockchainTransactions/{transactionId}`

Backend-owned blockchain-operation ledger. The collection records intended mint, transfer, or resale operations; it is not writable from the browser and is readable only by administrators.

| Field | Type | Notes |
| --- | --- | --- |
| `transactionHash` | string | Blank while queued. The real wallet-returned hash is saved after backend submission/receipt checks. |
| `walletAddress` | string | Wallet associated with the operation. |
| `transactionType` | string | Current Functions use `MINT`, `TRANSFER`, or `RESALE`. |
| `ticketId` | string | Affected ticket. |
| `relatedEntityType`, `relatedEntityId` | string | Related booking, ticket, or resale listing. |
| `status` | string | `PENDING` queue; `SUBMITTED` after a matching transaction is visible; `CONFIRMED` after two verified confirmations; `FAILED` for a confirmed reverted transaction. |
| `network`, `chainId`, `contractAddress` | string, number, string | Sepolia, `11155111` and the registered contract once submitted/verified. |
| `operationId`, `recordHash`, `tokenId`, `fromWallet` | string | Deterministic operation ID, SHA-256 record commitment, NFT token ID and preceding chain wallet. No QR or profile data is published. |
| `verificationVersion`, `confirmations`, `blockNumber`, `blockHash` | number/string | Verified receipt metadata; version `2` plus confirmed status identifies buyer-authorized operations. |
| `actorUid`, `actorWallet` | string | Backend-recorded responsible buyer: purchaser for mint, sender for transfer, resale buyer for resale. These fields are not accepted from browser input. |
| `lastCheckedAt`, `confirmedAt` | ISO 8601 string | Last verification and confirmed publication times. |
| `failureReason` | string | Empty unless a real integration records an error. |
| `timestamp` | ISO 8601 string | Backend operation time. |

`BlockchainTransactions` is created by the backend together with each ticket workflow. A queued `PENDING` record is not evidence of chain submission. Buyers approve their own queued operations in MetaMask using short-lived backend-signed permissions. The backend verifies exact calldata, buyer, authorization and canonical receipt event through RPC, then atomically saves confirmed chain metadata without changing ticket entry ownership. Application ownership can precede chain synchronization.

### `BlockchainSettings/sepolia`

Backend-only configuration written after verifying deployment of the checked-in
contract bytecode on Sepolia: `chainId`, `network`, `contractAddress`,
`contractVersion: 2`, `operatorAddress` (setup administrator), `signerAddress`
(backend authorization public key), `deploymentHash`, `deploymentBlock`, `configuredBy` and
`configuredAt`. The default deny rule protects this collection; no browser
read/write permission is added. Active admins manage setup without email verification; verified buyers and
organizers receive only public contract settings through the
authenticated `getBlockchainSettings` backend. The registered contract cannot
be replaced through the UI.

### `BlockchainAuthorizations/{calldataHash}`

Backend-only EIP-712 permission snapshots: responsible `actorUid`, recorded
`actorWallet`, blockchain record ID, exact operation and calldata, signer public
address, deadline and creation time. The document ID is a SHA-256 commitment to
the calldata. Multiple authorizations permit expiry/recovery without discarding
an earlier submitted transaction. Default-deny rules keep this collection private.

## Trusted backend workflows

The callable Functions in `functions/index.js` enforce authentication, role/status, event policy, ownership, pricing and inventory checks. Buyers and organizers require verified email; active administrators are exempt. Functions are deployed to `asia-southeast1`:

| Callable | Responsibility |
| --- | --- |
| `reserveSeats`, `releaseSeatReservation` | Create/release short-lived caller-owned `EventSeats` reservations. |
| `checkout` | Validate the buyer, sales window, allocation, price, wallet, and reservation; atomically sell `EventSeats`, create the booking/tickets, and create notification/audit/simulated-chain records. |
| `transferTicket` | Validate ownership and transfer policy, update ticket ownership/history, and create notification/audit/simulated-chain records. |
| `getTicketTransfers` | Return safe sent/received receipts for the active, verified buyer, optionally filtered by ticket or transfer ID. |
| `getBlockchainSettings`, `configureBlockchain` | Public contract details for active roles (buyers/organizers verified); deployment registration restricted to active admins without requiring email verification. |
| `prepareBlockchainOperation`, `verifyBlockchainOperation` | Responsible buyer-only authorization and receipt verification. Admin/organizer wallets cannot perform buyer operations. |
| `getBuyerBlockchainOperations`, `getOrganizerBlockchainOperations` | Safe account-scoped buyer activity or event-scoped organizer monitoring; no direct ledger access or write permission is granted. |
| `createResaleListing`, `updateResalePrice`, `cancelResaleListing`, `suspendResaleListing`, `purchaseResale` | Enforce seller/buyer/admin permission and resale rules while keeping listing and ticket state consistent. |
| `scanTicket` | Validate an authorized organizer/admin and ticket/event/status, then atomically mark a valid ticket as `USED`. |
| `syncEmailVerification` | Verify the caller's Firebase Auth ID-token claim and set `Users.emailVerified`; the browser has a Rules-constrained fallback only for Spark-only local demos where this callable is unavailable. |

Deploy `firestore.rules`, `firestore.indexes.json`, and `functions` together whenever one of these permission-sensitive workflows changes. See [README.md](README.md) for deployment and production-readiness requirements.
