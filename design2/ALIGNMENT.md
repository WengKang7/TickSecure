# DESIGN1 → DESIGN2 alignment review

Reference: `C:/Users/ongwe/Downloads/DESIGN1_DESIGN2_Alignment_Requirements.md`.

DESIGN1 PHP pages, shared navigation and the associated browser scripts were reviewed by role. DESIGN2 preserves its white backgrounds, black buttons, 10px corners, colour photography and original 3D seat renderer. This is an **interactive mockup**, not a migration of the production backend.

## Corrections made

- Replaced unrestricted role switching through ordinary navigation with explicit sample sign-in and role checks for direct routes and actions.
- Matched buyer, organizer and administrator navigation to DESIGN1. Buyers land on event discovery; staff land on their respective dashboards.
- Added the missing organizer Create Event, Complaints and Notifications modules and the corresponding subpages.
- Replaced disconnected confirmation toasts with shared sample records. Event reviews, availability, account status, listings, ownership, transactions and reports update across affected views.
- Corrected organizer ownership: each organizer sees only their own events, NFT activity, attendees, reports, resale monitoring and contract/funding state. Administrators do not connect wallets or deploy contracts.
- Separated active organizers from pending applications and buyers. Approval moves an application into the active organizer list.
- Kept Audit Logs and Complaints out of the administrator sidebar, matching the commented DESIGN1 links. Their administrator-only direct preview routes remain available; notifications can link to complaint details.
- Hid unpublished/unavailable events from discovery and resale; direct buyer event URLs show an unavailable state. Unpublished organizer drafts stay out of the administrator’s submitted-event list.
- Made staff event previews inert with a visible **FOR VIEWING ONLY** banner.
- Restored the seat → reservation → wallet → simulated payment → confirmation → NFT approval sequence. Chosen seats, quantities, prices and service charges stay consistent. Changing seats replaces the old reservation; expired reservations cannot complete.
- Preserved one NFT through resale. A resale purchase creates an ownership handover operation, not a second mint. Sold listings cannot be purchased twice.
- Added real filtering and aggregation of sample report records, including matching CSV exports and an account print view.

## Interface coverage

Paths below are appended to `http://localhost/ticksecure-ui/design2/#/`.

| Role / module | DESIGN1 reference | DESIGN2 interface and flow |
| --- | --- | --- |
| Public home | `index.php` | `/` — editorial home, colour photos, featured slides, event links |
| Public discovery | `public/events.php` | `events` — search, genre, city, month, sorting and buyer saved events; only published events |
| Event details | `public/event-detail.php` | `event/:eventId` — event facts, organizer, prices, rules, categories and interactive seating |
| Authentication | `auth/login.php`, `register.php`, `verify-email.php` | Email-based sign-in dialog without a role selector; buyer registration and a separate organizer application; organizer profile fields; floating email verification; pending approval and inactive-account states |
| Password reset | `auth/forgot-password.php`, `reset-password.php` | Reset instruction and new-password dialogs; sample inputs discarded |
| Buyer seat choice | `buyer/booking-category.php`, `seat-picker.php`, `seat-assignment.php` | Event selector — quantity, 2D/3D, seat-number dropdown, zoom, view from seat, audience, automatic selection, sold/held seats and exact-quantity checks |
| Buyer reservation / wallet | `buyer/wallet.php`, `seat-picker.php` | `wallet`, `checkout/:eventId` — connection/verification preview, ten-minute hold, release/change tickets and expiry |
| Buyer payment | `buyer/checkout.php` | `checkout/:eventId` — consent, successful/declined demo outcomes, RM20 service charge, no card form |
| Booking confirmation | `buyer/booking-confirmation.php` | `confirmation/:bookingId` — saved booking, automatic NFT setup prompt, per-ticket approval, navigation inert while confirming; cancelling setup retains tickets |
| Booking history / detail | `buyer/bookings.php`, `booking-detail.php` | `bookings`, `booking/:bookingId` — owned records only, exact seats, payment summary, current tickets and NFT progress; completed mints become “NFT details” |
| Ticket collection / pass | `buyer/tickets.php`, `ticket-detail.php` | `tickets`, `ticket/:ticketId` — Active, Listed, Used and Cancelled/Expired tabs, decorative QR download, wallet/token fields, ownership history and transaction detail |
| Buyer NFT operations | `buyer/blockchain.php` | `blockchain` — own mint/transfer/resale operations, submitting/receiving wallets, search, hash recovery, two sample confirmations and duplicate-operation protection |
| Transfers | `buyer/ticket-transfer.php`, `ticket-transfers.php` | Transfer dialog → review → confirmation → `transfers`; recipient must be another verified active buyer; original owner loses ticket access; sender submits NFT transfer |
| Resale market / purchase | `public/resale.php`, `resale-detail.php`, `buyer/resale-purchases.php` | `resale`, `resale-detail/:listingId`, `resale-purchases` — eligible listings, seller/price/seat details, service charge, ownership handover and pending buyer NFT approval |
| Seller listing management | `buyer/resale-new.php`, `resale.php` | `resale-new`, `my-listings` — owned minted tickets, organizer cap and window, price edit, cancellation and Active/Sold/Cancelled/Suspended views |
| Buyer support | `buyer/complaints.php`, `complaint-new.php`, `complaint-detail.php`, `complaint-manage.php` | `complaints`, `complaint/new`, `complaint/:id` — category, related booking, description, evidence filename, progress, open-request editing/deletion |
| Buyer profile / notifications | `buyer/profile.php`, `notifications.php` | `profile`, `notifications` — profile/security, wallet link, read/delete notifications; account dropdown includes profile, collections and logout |
| Organizer dashboard | `organizer/dashboard.php` | `organizer` — own-event metrics, sales, pending work, event overview and workspace links |
| Organizer event list / detail | `organizer/events.php`, `event-detail.php` | `organizer/events`, `organizer/event/:id` — search/status/venue filters; Overview, Ticket Configuration, Sales Rules, Status History and Sales tabs; edit/revise and draft deletion |
| Organizer event creation | `organizer/event-new.php`, `configuration.php` | `organizer/create`, `organizer/create/:id` — Basic Info → Venue → Media → Tickets → Rules → Review; save draft, local poster preview, approved venue, category add/remove and seat-range allocation, prices, sales/resale dates, limits, transfer/resale switches, submit for review |
| Organizer public preview | `public/event-detail.php?preview=1` | `preview/:eventId` — inert controls, banner and return-to-event link |
| Organizer sales | `organizer/sales.php` | `organizer/sales` — scoped report filters, totals, chart, tables and CSV |
| Organizer NFTs / attendees | `organizer/nft.php`, `attendees.php` | `organizer/nft`, `organizer/attendees` — NFT statuses/details and search; current owners, seats, entry state and attendee CSV |
| Organizer contract / funding | `organizer/blockchain.php` | `organizer/blockchain` — own setup wallet, deploy, hash recovery, two confirmations, verify/register, dedicated funding wallet, grant and daily-budget states; no admin contract controls |
| Organizer resale monitoring | `organizer/secondary-market.php` | `organizer/resale` — own listings, search/status/risk query, active/flagged/suspended counts and suspension confirmation |
| Organizer support / notifications / profile | `organizer/complaints.php`, `complaint-manage.php`, `notifications.php`, `profile.php` | Matching organizer routes; own support records, organization fields and notifications |
| Admin dashboard | `admin/dashboard.php` | `admin` — platform metrics, review queue, recent activity and submitted events |
| Admin buyers / active organizers | `admin/users.php`, `organizer-list.php`, `user-detail.php`, `account-edit.php` | `admin/users`, `admin/organizers`, `admin/account/:id`, `admin/account/new` — separated lists, search, CSV/print, account information, role/email edit, new sample password, inactivate/reactivate and delete-as-disable; history retained |
| Admin organizer review | `admin/organizers.php`, `organizer-detail.php` | `admin/applications`, `admin/application/:id` — pending only, applicant and organization information, approval, required rejection reason and audit record |
| Admin event review | `admin/events.php`, `event-review.php` | `admin/events`, `admin/event/:id` — submitted/pending/unavailable/cancelled/history views, search/venue/status filters, full details, approval/rejection, reversible availability and retained history |
| Admin venue management | `admin/venues.php`, `venue-new.php`, `venue-detail.php` | `admin/venues`, `admin/venue/:id`, Add/Edit Venue dialog — place search, pin/name/address/coordinates preview, autofill, physical sections and derived capacity; no capacity input on Add Venue |
| Admin blueprint review | `admin/venue-layout.php` | `admin/layout/:id` — local file choice, sample detection, original image preview, section names/counts/boundaries, identifiers, add/remove section, review acknowledgement, draft, final review and activation |
| Admin reports | `admin/reports.php` | `admin/reports` — year, all twelve months, organizer, date range, event, sale source, monthly/yearly grouping, filtered chart/tables and CSV |
| Admin profile / notification access | `admin/profile.php`, `shared/ui.php` | `admin/profile`, `admin/notifications` — own profile, reset dialog and review notifications |
| Admin hidden legacy modules | `admin/audit.php`, `complaints.php`, `complaint-detail.php` | `admin/audit`, `admin/complaints`, `admin/complaint/:id` — direct role-guarded pages, sample audit export and complaint investigation decisions; no sidebar links |
| Removed admin responsibilities | `admin/blockchain.php`, `admin/resale.php` redirects | Organizer modules only. Guessed administrator blockchain/resale routes do not expose organizer controls. |

## Scope and review notes

- “Functional alignment” here means matching interface responsibilities, sequences, fields, validation and connected **sample** states. Production enforcement remains in DESIGN1’s trusted backend and Firebase rules.
- A reload resets the preview data and sign-in. No persistent credentials, passwords, user records, uploads, payments, emails, signatures, faucet requests or blockchain calls are made.
- The sample clock is 1 March 2027; fictional event dates are used for sales/resale-window examples. Reserve/transfer/resale limits are validated against sample records.
- The shared 165-seat model demonstrates category allocation and availability. Arbitrary uploaded blueprints are **not OCR-processed** in DESIGN2. Detection deliberately uses the labelled sample plan; custom section boundaries and capacity edits represent the review interface.
- The location picker uses sample locations and coordinates, with editable name/address fields. It does **not** query Google Maps or Nominatim.
- One organizer starts with a sample registered contract. Other/new organizers can demonstrate setup independently. Deploy/recover/approve/confirm buttons simulate results and never spend SepoliaETH.
- NFT hashes, token IDs and QR artwork are illustrative. QR downloads are marked preview artwork and are not valid for entry.
- Existing passwords cannot be retrieved. New-password controls accept sample input only and discard it, matching secure password handling rather than exposing original credentials.

## Validation

- 44 automated checks cover role/ownership boundaries, every assigned role module’s rendering, account/application status, event review/availability, sales windows, seat allocation and reservation expiry, declined payment, minting, transfer, resale, filtered reports and existing 3D behavior.
- Browser-checked: role sign-in, organizer approval/list movement, venue create/review/activation, six-step event submission, inert staff preview, 3D seat selection → checkout, automatic NFT setup, resale → ownership → two-confirmation handover, report filtering and matching CSV download.
- Responsive checks include a 390px viewport and horizontally scrollable staff navigation/tables. No page-wide horizontal overflow was found in the report view.

Use **Demo sign-in** and enter a sample email to open its saved role automatically. Example emails: `admin@example.com`, `frequency@example.com`, `northbound@example.com`, `alex@example.com`, `jamie@example.com`. Staff can sign out from the sidebar. Sample actions affect the current tab only.

## Navigation and authentication refinements

- Administrator and organizer dashboard pages have no public top navigator, concept bar or public footer. Their brand sits above sidebar navigation. A compact sidebar Menu keeps all links accessible on mobile.
- Sign-in looks up the sample account by email. There is no account/role dropdown. Password input remains a mockup field; no live authentication occurs.
- Create Account registers a buyer. A separate “Apply as an organizer” form collects organization information and creates a pending application, with no role dropdown.
- Email verification opens in the same floating dialog as sign-in and registration. It is no longer a full-page verification section.
- My Bookings is removed from the buyer’s top navigator, while existing booking records and confirmation links are retained.
- Automatic buyer demo gas is removed from the buyer wallet connection page. The organizer contract/funding preview is unchanged.

## Buyer account and venue preview refinements

- Admin buyer account details contain buyer identity, contact, access controls, wallet/ticket summary and activity. Organization name, address and description appear only when the account role is Organizer; changing the role updates those fields immediately.
- Open Seating Layout in venue details opens a read-only dialog for that venue. It does not enter the upload/detection/activation wizard. Existing saved blueprint previews remain attached to their venue rather than shared between venues.
- Seating layout editing remains available through Edit Venue → Edit Seating Layout. New venue setup continues to use the existing review wizard.
