# TickSecure UI-Only PHP Codebase

This package is the UI implementation of the TickSecure `design.md` specification.

## Scope

- UI only — no database, authentication processing, payment processing, blockchain calls, file processing, API calls, or form submission logic is implemented yet.
- Every actual screen is a `.php` page.
- Pages are separated by role: `buyer`, `organizer`, `admin`, and `verification`.
- Shared presentation helpers live in `shared/ui.php` and do not contain business/backend processing.
- Shared styling and UI-only interactions are in `assets/css/ticksecure.css` and `assets/js/ui.js`.
- Mock data is included so every screen can be previewed immediately.

## Quick Start

### PHP built-in server

From the project folder:

```bash
php -S localhost:8000
```

Then open:

```text
http://localhost:8000/preview.php
```

### XAMPP

1. Copy the `ticksecure-ui` folder into `htdocs`.
2. Start Apache.
3. Open `http://localhost/ticksecure-ui/preview.php`.

## Folder Structure

```text
ticksecure-ui/
├── index.php                     Public premium landing page
├── preview.php                   Quick links to representative screens
├── design.md                     Source UI/UX design specification
├── README.md
├── assets/
│   ├── css/ticksecure.css        White-first premium design system
│   └── js/ui.js                  UI-only demo interactions
├── shared/
│   └── ui.php                    Presentational layouts/components/icons
├── auth/
│   ├── login.php
│   ├── register.php
│   ├── verify-email.php
│   ├── forgot-password.php
│   └── reset-password.php
├── public/
│   ├── events.php
│   ├── event-detail.php
│   ├── resale.php
│   └── resale-detail.php
├── buyer/
│   ├── dashboard.php
│   ├── booking-category.php
│   ├── seat-assignment.php
│   ├── wallet.php
│   ├── checkout.php
│   ├── booking-confirmation.php
│   ├── tickets.php
│   ├── ticket-detail.php
│   ├── ticket-transfer.php
│   ├── bookings.php
│   ├── booking-detail.php
│   ├── resale.php
│   ├── resale-new.php
│   ├── notifications.php
│   ├── complaints.php
│   ├── complaint-new.php
│   ├── complaint-detail.php
│   └── profile.php
├── organizer/
│   ├── dashboard.php
│   ├── events.php
│   ├── event-new.php
│   ├── event-detail.php
│   ├── configuration.php
│   ├── sales.php
│   ├── nft.php
│   ├── attendees.php
│   ├── secondary-market.php
│   ├── complaints.php
│   ├── notifications.php
│   └── profile.php
├── admin/
│   ├── dashboard.php
│   ├── users.php
│   ├── user-detail.php
│   ├── organizers.php
│   ├── organizer-detail.php
│   ├── events.php
│   ├── event-review.php
│   ├── venues.php
│   ├── venue-new.php
│   ├── venue-detail.php
│   ├── venue-layout.php
│   ├── blockchain.php
│   ├── audit.php
│   ├── resale.php
│   ├── complaints.php
│   ├── complaint-detail.php
│   ├── reports.php
│   └── profile.php
└── verification/
    ├── scanner.php
    ├── valid.php
    └── invalid.php
```

## Important Design Decisions Already Reflected

- Buyer selects a ticket category, not an individual seat.
- TickSecure automatically assigns the next available seat according to seat assignment order.
- Admin manages physical venues and uploads/processes venue blueprints.
- Blueprint review detects physical sections; Admin confirms section names and seat counts.
- Event Organizer maps event-specific categories such as VIP1/CAT1 to physical venue sections.
- Blockchain details are hidden from the primary buyer flow and shown as optional technical details.
- Admin has full audit visibility; Organizer sees only role-relevant event information.
- Authorized Event Personnel use a simplified entry-scanner interface rather than the Admin/Organizer shell.

## UI Interactions Included

These are frontend-only preview behaviours:

- Tabs
- Modal previews
- Toast messages
- Toggle switches
- Quantity controls
- Reservation countdown display
- Blueprint detected-section highlighting
- Accordion disclosure for technical blockchain details
- Basic responsive sidebar behaviour

None of these persist data.

## Validation Performed

- PHP syntax checked for every PHP file.
- All PHP pages were served and returned HTTP 200 during local validation.
- Internal `.php` navigation links were checked for broken targets.
