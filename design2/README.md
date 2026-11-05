# TickSecure DESIGN2 — interactive visual concept

Open **http://localhost/ticksecure-ui/design2/** with XAMPP Apache running.

The existing TickSecure application is **DESIGN1**. This separate folder is **DESIGN2**; its styles and scripts do not change DESIGN1.

## Explore

- Home, featured-event slideshow controls, event discovery, search, genre/location/month filters, saved events and price sorting.
- Event details with a DESIGN1-inspired venue-plan/category-card layout, quantity, directly selectable numbered seats, simulated checkout and booking confirmation.
- Digital tickets, NFT ownership presentation, sample ticket transfers and resale listing/purchase previews.
- Buyer profile, account dropdown and a preview-only connected wallet state.
- Organizer studio: event list, sales, NFT tickets, blockchain setup/funding, attendees, resale monitoring and organization profile.
- Administration: buyer/organizer separation, pending applications, event availability, venues and monthly/yearly report controls with a downloadable sample CSV.
- Mobile navigation, keyboard navigation, focus indicators, native dialogs and reduced-motion support.

Use **Demo sign-in** to enter a sample email. The saved account identifies its role automatically: `admin@example.com`, `frequency@example.com`, `northbound@example.com`, `alex@example.com` or `jamie@example.com`. No role dropdown is shown. “Create Account” registers buyers; “Apply as an organizer” opens a separate organization application. Email verification uses a floating dialog. Ordinary navigation and direct page URLs respect that preview role. Administrator and organizer workspaces use sidebar branding and navigation without the public top navigator. The buyer top navigator omits My Bookings; booking history remains available through booking confirmations and existing routes. The buyer wallet connection page has no demo-gas panel. Buyer sign-in lands on event discovery; staff sign-in opens the matching dashboard. The organizer wizard, administrator review queues, buyer bookings, resale ownership and filtered reports now share one set of in-memory records.

See [ALIGNMENT.md](ALIGNMENT.md) for the role-by-role DESIGN1 comparison, complete page/workflow coverage and verification notes.

## Scope

All events, performers, account details, availability, sales figures, wallet details and blockchain states are illustrative. Sample interactions are held in browser memory and reset on reload. There is no Firebase integration, actual account creation, payment, MetaMask request, blockchain transaction, email or live event mutation. Seat selection is a representative schematic, not a replacement for the approved venue blueprint. QR artwork is decorative and not valid for entry. The venue workflow includes a sample location picker, local file preview, sample detection, editable section boundaries/counts and activation. It does not upload files, run OCR or call geocoding APIs. Sample password inputs are discarded.

## Visual direction

White backgrounds, black action buttons, fine grey borders and consistent 10px component corners. Available, selected and unavailable seat controls have distinct states. Space Grotesk display typography with DM Sans functional text. Large editorial headlines and full-colour concert photography provide festival energy. Typography/images are loaded from Google Fonts and Unsplash; internet access is needed for those assets. Core UI falls back to local system fonts.

The illustrative 165-seat curved plan uses one model on the event page and checkout. Clicking an available seat highlights its category and updates the price. Quantity limits, held/sold seats and incomplete selections are validated. Selected seat numbers carry into checkout and the sample ticket. Mobile users can scroll/zoom the plan or use the seat-number dropdown. This remains a mockup; it does not read or reserve DESIGN1 inventory.

The default **3D view** reuses DESIGN1's original `seat-view-model.js`, `seat-view-people.js` and `seat-view-3d.js` directly. It supports drag rotation, zoom, chair selection, keyboard controls (arrows, Enter, V, Escape), the view toward the stage from a focused seat, and optional seated people with pause/resume animation. The original model's chair/status colours remain visible within the white/black DESIGN2 controls. Switching to the **2D plan** preserves the same seat selection. Canvas-unavailable browsers fall back to the 2D selector. The renderer is retained across selection updates to preserve its camera and is disposed when leaving the seating flow. DESIGN2 requests the existing optional white-background setting; DESIGN1's default rendering remains unchanged.

Design references: the locally reviewed Apple and Airbnb design analyses in `C:/xampp/htdocs/awesome-design-md`. Patterns are adapted to TickSecure; no brand assets or proprietary fonts are copied.

Photography sources: Unsplash, including https://unsplash.com/photos/77mKE6x7J28 and https://unsplash.com/photos/b_dcQG-XSGs. Other illustrative images use Unsplash image endpoints. Images illustrate the concept events and do not represent actual named performers or venues.
