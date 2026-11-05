# TickSecure DESIGN2 — Design System & Interface Reference

**Product:** Web-based music festival ticketing platform  
**Version:** DESIGN2, current implemented mockup  
**Updated:** 5 November 2026  
**Preview:** `http://localhost/ticksecure-ui/design2/`  
**Scope:** Public website, Buyer, Event Organizer and Administrator

This document describes DESIGN2 as it currently exists. DESIGN1 remains the reference for system responsibilities and user journeys; DESIGN2 supplies the new presentation and interaction design. The project-level `../design.md` is preserved separately.

## 1. Design direction

DESIGN2 presents TickSecure as a premium music festival ticketing service: spacious, editorial, clear and professional. The interface combines a restrained black-and-white structure with the energy of full-colour concert photography.

The visual identity rests on:

- White page backgrounds and white interface surfaces.
- Black headings, primary controls and important information.
- Grey secondary text, fine borders and restrained data indicators.
- Bold sans-serif headlines and generous space between sections.
- Consistent **10px corner radii** across interface components.
- Colour photography shown continuously, including before hover.
- Familiar ticket purchasing steps, with technical details disclosed when relevant.

Avoid grey page fills, greyscale photo treatments, hover-only colour reveals, neon effects, ornamental gradients and excessive decoration. Dark overlays over photographs are permitted where they make white captions readable.

## 2. Current sources of truth

| File | Responsibility |
| --- | --- |
| [index.html](index.html) | Document shell, font loading, stylesheets and script order |
| [design2.css](design2.css) | Core visual system, public pages, seating components, motion and responsive rules |
| [alignment.css](alignment.css) | Current role layouts, additional forms, sidebar branding and venue preview styling |
| [design2.js](design2.js) | Editorial pages, discovery, event presentation and original seating UI integration |
| [alignment-ui.js](alignment-ui.js) | Current role navigation, authentication dialogs and connected interface journeys |
| [alignment-model.js](alignment-model.js) | In-memory sample records, role checks and workflow state |
| [seating-model.js](seating-model.js) | Representative 165-seat venue geometry |
| [seat-3d.js](seat-3d.js) | Adapter to DESIGN1's original 3D seating renderer |
| [ALIGNMENT.md](ALIGNMENT.md) | Detailed DESIGN1-to-DESIGN2 module and workflow comparison |

`alignment.css` loads after `design2.css`; its later rules take precedence. Some core stylesheet selectors retain historical names such as `.btn.white` and `.btn.secondary`, but the current enabled button treatment is black.

## 3. Brand identity

### Wordmark

- Display the brand as **ticksecure** in a bold, compact lowercase wordmark.
- Pair it with the existing four-bar waveform mark.
- Keep the mark and wordmark together as one home link.
- Use black branding on white surfaces.

### Placement

| Context | Brand location |
| --- | --- |
| Public website and Buyer pages | Left side of the top navigation |
| Administrator workspace | Top of the left sidebar |
| Organizer workspace | Top of the left sidebar |
| Mobile staff workspace | Top of the sidebar area, beside its Menu control |

Staff workspace pages do not display the public top navigator, concept bar or public footer. Public pages visited by staff retain the public website layout.

## 4. Colour system

| Token / colour | Current value | Use |
| --- | --- | --- |
| `--paper` | `#FFFFFF` | Page background |
| `--wash` | `#FFFFFF` | Supporting surfaces; no grey wash |
| `--ink` | `#111111` | Primary text and structural emphasis |
| Action black | `#000000` | Enabled action buttons and icon buttons |
| `--muted` | `#686868` | Supporting descriptions and secondary labels |
| `--line` | `#E5E5E5` | Card borders, dividers and table separation |
| Supporting border | `#DDDDDD` | Inputs, dialogs and disabled controls |
| Disabled text | `#777777` | Unavailable control labels |
| White | `#FFFFFF` | Button text and interface surfaces |

Grey remains useful for text, outlines, chart tracks and unavailable-seat indicators. It should not become the dominant page or card background.

The seating viewer is a deliberate exception to the neutral interface palette: it retains DESIGN1's chair, selection and availability colours. Explain these colours with a legend and textual status. Do not remove seat-state distinctions to make the viewer monochrome.

## 5. Typography

### Font families

| Purpose | Family | Fallback |
| --- | --- | --- |
| Headlines and brand | Space Grotesk | Arial, sans-serif |
| Body text, labels and controls | DM Sans | Arial, sans-serif |

Fonts are loaded from Google Fonts. The interface remains usable with local fallback fonts.

### Hierarchy

| Element | Implemented reference |
| --- | --- |
| Homepage hero headline | `clamp(64px, 7.7vw, 118px)` on larger screens |
| General large heading | `clamp(46px, 6vw, 84px)` before page-specific overrides |
| Aligned page heading | `clamp(32px, 5vw, 62px)` |
| Staff dashboard heading | Approximately `42px` |
| Major section heading | `clamp(30px, 3.4vw, 48px)` |
| Standard card heading | Approximately `20–24px` |
| Dialog heading | Approximately `30px`, reduced on smaller screens |
| Default body | `15px` desktop; `14px` in the narrow public layout |
| Standard button label | `13px` |
| Staff sidebar link | `13px` |
| Supporting labels | Generally `10–12px`, depending on component |

Display headings use tight tracking and compact line heights. Body text uses more relaxed spacing for scanning. Small uppercase eyebrow labels introduce sections; they must remain subordinate to the actual heading.

## 6. Layout, spacing and shape

### Public layouts

- Centre content within a maximum width of **1380px**.
- The desktop `.wrap` uses `min(1380px, calc(100% - 112px))`.
- Public side margins reduce at tablet and mobile breakpoints.
- Use clear section boundaries through whitespace and fine dividers.
- Desktop event cards use a three-column grid with approximately `30px` gaps.
- Event details place the venue viewer beside a `350px` category/summary panel; the panel narrows before the layout stacks.

### Staff layouts

- Use a **245px** desktop sidebar and a flexible main content area.
- Keep the sidebar at the top of the viewport with full-viewport height.
- Allow internal sidebar scrolling when necessary; do not clip navigation.
- Place branding above the role label and navigation links.
- Keep account identity and logout controls in the sidebar's lower area.
- Use main content headings, metric groups, panels and tables instead of a public navigation bar.

### Component spacing

| Reference | Typical value |
| --- | --- |
| Standard panel padding | `26px` |
| Compact panel padding | `18–21px` |
| Form grid gap | `18px` |
| Related panel spacing | `24px` |
| Primary button padding | `13px 22px` |
| Primary button minimum height | `48px` |
| Small button minimum height | `37px` |
| Standard icon button | `42px × 42px` |
| Standard dialog padding | `32px`, reduced on smaller screens |
| Component corner radius | **`10px`** |

These values describe the existing implementation, not a requirement to make every component identical in size.

## 7. Photography and visual media

- Use high-quality concert, crowd, stage and live-performance imagery.
- Show original image colours in normal, hovered and focused states.
- Preserve the existing gentle image scale effect on event-card hover.
- Use `object-fit: cover` for image cards and event banners.
- Keep photograph crops focused on the performance or crowd rather than empty space.
- For uploaded seating plans, use a contained, uncropped preview where possible.
- Use restrained overlays behind photographic captions, not over the entire site.

Current illustrative photography is loaded from Unsplash. Images do not represent actual named performers, venues or live events in the sample data.

## 8. Navigation by role

### Public and Buyer

Public navigation exposes event discovery and authentication. After Buyer sign-in, the main navigation contains:

- Events
- Resale
- My Tickets
- Help

**My Bookings is intentionally absent from the top navigator.** Booking records and their routes remain available through confirmation and booking-detail links.

Buyer account controls provide Profile, Collections (NFT), My blockchain, My listings, Sent & received and Logout. Wallet and notification controls sit alongside the account control; the mobile menu exposes the corresponding destinations.

### Event Organizer

The sidebar contains Dashboard, My Events, Create Event, Sales & Revenue, NFT Tickets, Blockchain Transactions, Attendees, Resale Monitoring, Complaints, Notifications and Organization Profile.

All event, sales, attendee, NFT and resale records are scoped to the signed-in organizer. Each organizer has a separate contract and funding preview.

### Administrator

The sidebar contains Dashboard, Users, Organizers, Organizer Applications, Events, Venues & Layouts, Reports and Profile. Notifications, public-site access and Logout remain accessible in the sidebar.

Buyers, active organizers and pending organizer applications have separate views. Audit and complaint pages remain available through their existing guarded routes without being added back to the sidebar. Administrator pages do not expose organizer contract-deployment or resale-monitoring controls.

## 9. Authentication and verification

### Sign-in

- Use a floating dialog with email, password and Sign In controls.
- Do not show a role or account dropdown.
- Determine the destination from the account associated with the entered email.
- Show concise error messages for unknown, inactive, unverified or pending accounts.
- Keep demo email examples in an optional expandable help section.

### Registration

- Create Account registers a Buyer by default.
- Offer a separate **Apply as an organizer** form.
- The organizer application collects organization name, description, phone and address in addition to account details.
- Neither registration form has a role selector.
- Organizer applications remain pending until reviewed by an administrator.

### Email verification

Use the same floating-dialog system as sign-in and registration, over a dimmed page background. Include the email address, I verified my email, Resend verification email and Return to Sign In. Do not turn verification into a standalone full-page form.

In DESIGN2, authentication and verification are simulated; sample password inputs are discarded.

## 10. Component patterns

### Buttons and links

- Enabled filled action buttons use black backgrounds and white labels.
- Differentiate secondary actions through placement, wording and size rather than a competing colour theme.
- Use text links for supporting navigation.
- Hover can lift a button slightly; it must remain recognisable without hover.
- Disabled controls use white surfaces, grey borders/text and a non-interactive state.
- Use specific action labels such as Save account, Approve Organizer and Open Seating Layout.

### Cards and panels

Use white backgrounds, a fine border, `10px` corners and generous padding. Separate headings, descriptions and actions clearly. Limit shadows to layered elements where depth conveys meaning.

### Forms

- Place visible labels above fields.
- Use two-column grids when space permits; stack on narrow screens.
- Keep descriptive textareas and related field groups full width where appropriate.
- Validate before submitting and keep errors close to the current task.
- Retain relevant values when moving between wizard steps.

Administrator Buyer account details show buyer identity/contact fields, account controls, wallet/ticket summary and activity. **Organization name, organization address and organization description appear only for Organizer accounts.** Changing the account role updates the organization field group immediately.

### Tables and metrics

- Use compact uppercase table headings and subtle row dividers.
- Make long tables horizontally scrollable within their container.
- Display wallet addresses and hashes in wrapping code-style text.
- Use labelled metric groups for totals and counts.
- Reports must recalculate from the selected sample records; CSV output must match the filters.
- Present money consistently in Malaysian Ringgit, such as `RM288.00`.

### Status and feedback

Use explicit labels such as Published, Pending, Unavailable, Minted, Confirmed and Inactive. Status must not depend on colour alone. Use persistent inline notices for task context and short toasts for completed actions.

### Dialogs

Standard dialogs use a white surface, a thin border, `10px` corners, a close control, a restrained shadow and a dimmed/blurred backdrop. The normal maximum width is `600px`; longer content scrolls inside the dialog.

The venue-layout preview can expand to `1000px` while respecting viewport margins. Its contents are read-only: the selected venue's plan, venue name and supporting section labels. It must not open the upload/detection wizard or show editing controls.

## 11. Event discovery and ticket purchase

The public experience follows:

**Home → Discover events → Event details → Category and seats → Wallet/reservation → Simulated payment → Booking confirmation → Ticket and NFT setup**

### Event details

- Start with event imagery and a clear event title.
- Present date/time, venue, organizer and starting price as a compact facts group.
- Put the venue layout and ticket categories together so location and price are easy to compare.
- Keep quantity, selected seats, service charge and total visible in the purchase summary.
- Show event rules and description below the main booking area.

### Seating

The current representative layout contains **165 numbered seats** in curved rows, with the stage at the bottom.

- Default to the original DESIGN1-based 3D viewer.
- Provide a 2D plan and a seat-number dropdown as alternatives.
- Support rotation, zoom, reset, focused-seat stage preview and optional illustrative people.
- Preserve selection while switching 2D and 3D views.
- Distinguish available, selected and unavailable seats with both state styling and labels.
- Offer Find seats for me for automatic selection.
- Validate exact quantity, category, limits and availability before checkout.

The viewer has a white surrounding background. Physical model materials and seat-state colours remain intact. If the 3D canvas cannot run, the interface falls back to the 2D selector.

### Checkout and NFT setup

- Carry the selected category, seats and price through the whole flow.
- Display the reservation period and provide a way to change tickets or release the hold.
- Show simulated-payment consent and a successful/declined demo outcome.
- Start the NFT approval preview after a confirmed booking.
- Make navigation non-interactive while the approval result is being processed.
- Retain the booking if NFT setup is cancelled.
- Once operations are complete, show NFT details instead of continuing to offer minting.

The Buyer wallet connection page contains wallet status, address, network and connection/continuation controls. It **does not show Automatic buyer demo gas**. The organizer's separate funding preview remains in the organizer workspace.

## 12. Tickets, transfers and resale

### Digital tickets

Use a clear pass layout with event information, category, seat, entry status, decorative QR, ownership information and history. Separate the entry pass from technical blockchain details without separating them into conflicting records.

### Transfer

Follow Recipient → Review → Complete. Validate the recipient and ticket eligibility, then show the ownership handover and its associated NFT operation. The previous owner retains a receipt rather than continued access to the transferred ticket.

### Resale

- Show verified seller, ticket/category, price and event information.
- Apply the organizer's resale window and price cap.
- Provide Active, Sold, Cancelled and Suspended listing views.
- Allow eligible sellers to edit price or cancel an active listing.
- Transfer the existing ticket/NFT to the purchasing Buyer; do not create a second NFT for the same ticket.
- Remove sold listings from the purchasable market.

## 13. Staff workflow presentation

### Organizer event wizard

Use six clear steps: **Basic Info → Venue → Media → Tickets → Rules → Review**. Keep Save Draft available, support revision of draft/rejected events, and show a complete summary before submission. A submitted event remains unavailable to buyers until administrator approval.

The event-detail interface separates Overview, Ticket Configuration, Sales Rules, Status History and Sales. Public event previews show **FOR VIEWING ONLY** and disable the preview's controls.

### Administrator review and account management

Keep review decisions next to the relevant records. Require reasons where the workflow calls for rejection or unavailability. Preserve history when disabling an account or making an event unavailable.

### Venue management

- Add Venue provides location search/pin preview and editable name/address/coordinates.
- Do not ask for seating capacity on the Add Venue form; derive it from reviewed sections.
- The blueprint workflow covers file choice, sample detection, section/boundary review, acknowledgement and activation.
- **Open Seating Layout** in venue details shows only that venue's read-only layout.
- Editing remains a separate path through **Edit Venue → Edit Seating Layout**.
- Keep saved blueprint previews attached to their venue; do not reuse another venue's current upload.

## 14. Motion and interaction

| Interaction | Current reference |
| --- | --- |
| Standard button transition | Approximately `0.2s` |
| Event photo zoom | Approximately `0.65s` |
| Page entrance | Approximately `0.45s`, subtle fade/vertical movement |
| Supporting reveal | Approximately `0.8s` |
| Hero image entrance | Approximately `1.4s`, gentle scale |
| Easing token | `cubic-bezier(.2,.7,.3,1)` |

Motion should communicate response and continuity. It must not hide information, change a photograph from grey to colour, or delay a necessary action. Respect `prefers-reduced-motion`; the current stylesheet disables transitions/animations and smooth scrolling when that preference is active.

## 15. Responsive behaviour

| Width / context | Layout behaviour |
| --- | --- |
| Wide desktop | Spacious public container, three event columns, side-by-side event/booking content |
| Around `1150px` and below | Tighter public margins, gaps and dashboard layouts |
| Around `1100px` and below | Narrower event category panel and two-column event facts |
| Staff at `900px` and below | Sidebar becomes a compact brand-and-Menu area with collapsible links |
| Around `850px` and below | Two-column event grid; checkout and event workspace stack |
| Around `620px` and below | Mobile public navigation, single-column content/forms, shorter banners and adjusted headings |
| Small seating or table area | Scroll within the component rather than widening the whole page |

These are the current component breakpoints; the implementation does not use one universal breakpoint for every screen.

On mobile, keep staff branding visible even when navigation is collapsed. Keep role links, Profile and Logout reachable. Preserve labelled form fields, clear totals and an accessible seat-number alternative.

## 16. Accessibility and usability

- Provide a skip-to-content link and visible focus indicators.
- Use semantic links, buttons, labelled form controls and native dialogs.
- Maintain readable contrast and an ordered heading hierarchy.
- Keep selected, disabled, expanded and current states explicit.
- Provide keyboard alternatives for seating and menu interactions.
- Use text alongside status colours and icons.
- Make long addresses, emails and hashes wrap without breaking the layout.
- Support reduced motion and avoid relying on hover for information.
- Keep destructive or consequential preview actions behind a clear review/confirmation step.

These describe implemented patterns and continuing design requirements; they are not a claim of an independent accessibility certification.

## 17. Mockup boundaries

DESIGN2 is a browser-only interactive concept. Its sample records reset on reload. It does not connect to Firebase, authenticate real users, send email, collect payment, request MetaMask signatures or spend SepoliaETH.

The venue location picker uses sample locations, not a live map API. Blueprint files are locally previewed; the mockup does not OCR arbitrary uploads. The 165-seat schematic illustrates the interface and is not a surveyed seating model. QR artwork, token IDs and transaction hashes are illustrative, and preview QR downloads are not valid for entry.

Do not describe a preview action as a completed live payment, email, upload or blockchain transaction. Production functionality and trusted access enforcement remain in DESIGN1 until separately implemented.

## 18. Design review checklist

- [ ] Page, card and navigation backgrounds are white.
- [ ] Enabled action buttons are black with white labels.
- [ ] Component corners follow the 10px system.
- [ ] Concert photos display full colour without requiring hover.
- [ ] Public/Buyer navigation and staff sidebar layouts remain distinct.
- [ ] Staff branding sits above sidebar links, with no public top navigator on workspace pages.
- [ ] Sign-in uses email, and neither registration path has a role selector.
- [ ] Email verification is a floating dialog.
- [ ] Buyer top navigation omits My Bookings.
- [ ] Buyer wallet connection omits the demo-gas panel.
- [ ] Buyer account details omit organization-only fields.
- [ ] Open Seating Layout is scoped to its venue and read-only.
- [ ] Seating, filters, forms, dialogs and workflow states remain usable with keyboard and mobile layouts.
- [ ] Selection, pricing, ownership and status remain consistent across connected pages.
- [ ] Sample actions are clearly distinguished from live backend operations.

For detailed page coverage and workflow validation, see [ALIGNMENT.md](ALIGNMENT.md).
