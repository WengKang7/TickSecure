# TickSecure UI/UX Design Specification (`design.md`)

> **Product:** TickSecure — Anti-Scalper Ticketing Platform  
> **Design direction:** Premium, high-class, clean, white-first interface  
> **Primary platforms:** Responsive web application for Buyer, Event Organizer and Administrator, plus a focused event-entry verification interface  
> **Design status:** Development-ready working specification based on the documented Chapter 2–3 requirements and the latest design decisions confirmed during the current class/UI design discussion.

---

## 1. Product Design Intent

TickSecure should feel like a premium ticketing and event-management platform rather than a blockchain application. The user should experience a familiar, trustworthy ticket-purchasing flow while NFT ownership, wallet signatures, blockchain transactions, resale enforcement and QR verification operate behind the scenes.

The interface should communicate four qualities immediately:

1. **Trust** — users must feel that payments, ticket ownership and event access are legitimate and traceable.
2. **Clarity** — the interface must make event status, seat assignment, payment status, ticket status and resale restrictions easy to understand.
3. **Premium quality** — the design should use generous spacing, strong typography, subtle borders, restrained accent colours and high-quality event imagery.
4. **Technical simplicity** — blockchain information should be available when needed, but should not dominate normal buyer flows.

The visual language should be approximately **75% white / off-white surfaces, 20% dark neutral typography and structure, and 5% restrained accent/status colour**.

---

## 2. Requirement Alignment and Current Design Decisions

### 2.1 Source-derived core roles

TickSecure has three main platform roles:

- **Administrator**
- **Event Organizer**
- **Buyer**

An additional focused interface is required for **Authorized Event Personnel** to scan and verify QR tickets at venue entry.

### 2.2 Functional coverage

The UI must cover the documented functional areas:

**Administrator functions**
- User and role management
- Organizer registration approval/rejection
- Event oversight and approval
- System monitoring and audit
- Complaint/dispute management
- Resale monitoring and enforcement

**Event Organizer functions**
- Event creation and management
- Ticket category/configuration
- Ticket sales and resale rules
- Sales and revenue dashboard
- NFT ticket distribution/ownership monitoring
- Attendee management
- Secondary-market monitoring

**Buyer functions**
- Concert browsing/search/filtering
- Ticket booking
- Digital NFT ticket management
- Wallet integration
- Booking history
- Notifications
- Ticket transfer
- Ticket resale and resale marketplace
- Complaint/dispute submission and tracking

### 2.3 Latest confirmed design decisions that refine the original Chapter 3 flow

The development UI should follow these latest decisions:

1. **Automatic seat assignment**  
   The Buyer selects a ticket category such as `VIP1`, `VIP2`, `CAT1`, etc. The Buyer does **not** manually pick an individual seat. TickSecure automatically assigns the first available seat in the category according to a predefined assignment order.

2. **Venue blueprint processing**  
   Administrator creates/manages a venue and uploads a seating blueprint. A backend processing technique analyses the blueprint, identifies physical venue sections, and presents the detected sections for Administrator review.

3. **Physical section vs event category separation**  
   Administrator confirms physical venue sections and seat counts. Event Organizer later maps an event-specific ticket category such as `VIP1` or `CAT1` to a physical venue section. This allows the same venue section to use different ticket-category names for different concerts.

4. **Organizer profile**  
   Event Organizer inherits common User fields such as full name and email, while maintaining organization-specific profile information such as organization name, description, phone and address.

5. **Event status history and audit visibility**  
   Administrator can access complete audit/system information. Event Organizer can see event-specific history for their own events. Buyer only sees relevant current status and user-facing notifications.

> **Documentation note:** The original Chapter 3 seat-selection wording should later be updated to reflect automatic seat assignment so the report and implementation remain consistent.

---

## 3. Design Personality

### 3.1 Keywords

Use these words as the visual and interaction benchmark:

- Premium
- Minimal
- Secure
- Calm
- Precise
- Modern
- White-first
- Professional
- Trustworthy
- Event-focused

### 3.2 Avoid

Do not make the interface look like:

- A crypto exchange
- A gaming NFT marketplace
- A highly saturated ticket marketplace
- A generic Bootstrap admin template
- A black-background “Web3” dashboard
- A UI filled with gradients, glow effects or neon colours

Blockchain is a security mechanism, not the main visual identity.

---

## 4. Visual Design System

## 4.1 Colour Palette

### Core surfaces

| Token | Colour | Usage |
|---|---|---|
| `--bg-page` | `#F7F8FA` | Main page background |
| `--bg-surface` | `#FFFFFF` | Cards, modals, panels |
| `--bg-subtle` | `#F2F4F7` | Secondary sections, disabled areas |
| `--bg-hover` | `#F8F9FB` | Table row/card hover |
| `--border-default` | `#E5E7EB` | Standard borders |
| `--border-strong` | `#D0D5DD` | Input hover/focus support |

### Typography

| Token | Colour | Usage |
|---|---|---|
| `--text-primary` | `#101828` | Main headings/body |
| `--text-secondary` | `#475467` | Supporting text |
| `--text-tertiary` | `#667085` | Meta labels/hints |
| `--text-disabled` | `#98A2B3` | Disabled text |

### Premium brand accent

Use a restrained champagne/gold accent. It should never dominate the interface.

| Token | Colour | Usage |
|---|---|---|
| `--brand-900` | `#2A2118` | Premium dark accent |
| `--brand-600` | `#9A7445` | Primary accent for selected premium elements |
| `--brand-100` | `#F5EEE5` | Soft accent background |

Primary CTAs may use **near-black** rather than gold for a more premium look:

- Primary button: `#101828`
- Primary button hover: `#1D2939`
- Gold should be used for highlight lines, badges, premium ticket details or selected states.

### Status colours

| State | Text/Icon | Background |
|---|---|---|
| Success | `#027A48` | `#ECFDF3` |
| Warning | `#B54708` | `#FFFAEB` |
| Error | `#B42318` | `#FEF3F2` |
| Info | `#175CD3` | `#EFF8FF` |
| Blockchain/Pending | `#6941C6` | `#F4F3FF` |

Never use status colour as the only information channel; always pair it with text/icon.

---

## 4.2 Typography

Recommended font: **Inter**.

If a more editorial event feel is wanted, headings may use **Manrope**, but one-font Inter is preferred for implementation consistency.

### Type scale

| Style | Size | Weight | Line Height |
|---|---:|---:|---:|
| Display XL | 48px | 650–700 | 56px |
| Display L | 40px | 650–700 | 48px |
| H1 | 32px | 650–700 | 40px |
| H2 | 26px | 650 | 34px |
| H3 | 22px | 650 | 30px |
| H4 | 18px | 600 | 26px |
| Body L | 16px | 400 | 24px |
| Body M | 14px | 400 | 20px |
| Body S | 13px | 400 | 18px |
| Label | 12px | 500–600 | 16px |

Use sentence case, not ALL CAPS, except tiny technical labels where necessary.

---

## 4.3 Spacing

Use an 8px base grid.

Recommended spacing tokens:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`

Rules:

- Card internal padding: 20–24px
- Page section gap: 32–40px
- Form field gap: 16px
- Form group gap: 24–32px
- Dashboard widget gap: 16–24px
- Main page horizontal padding: 32px desktop, 20px tablet, 16px mobile

---

## 4.4 Radius and Shadows

### Border radius

- Small input/chip: 8px
- Buttons: 10px
- Cards: 14–16px
- Modals/drawers: 18px
- Hero/event imagery: 20px

### Shadows

Keep shadows extremely subtle.

Standard card:

```css
box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
border: 1px solid #E5E7EB;
```

Floating modal:

```css
box-shadow: 0 20px 40px rgba(16, 24, 40, 0.12);
```

Do not place large shadows on every card.

---

## 4.5 Iconography

Use one consistent outline icon set, such as Lucide-style icons.

Rules:

- Default icon size: 18–20px
- Sidebar icon: 20px
- Hero actions: 20–22px
- Do not mix filled and outline icons unnecessarily
- Use icons with labels for important actions

---

## 5. Global Layout Architecture

## 5.1 Public / Buyer-facing layout

Desktop structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ TickSecure     Events   Resale   My Tickets   Help     User │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    Main Page Content                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Top navigation height: **72px**.

Header behaviour:

- Sticky at top after scrolling
- White with bottom border
- TickSecure wordmark on left
- Search can expand in navigation on event listing pages
- Right area contains notifications, wallet status and profile

Buyer account menu:

- My Tickets
- Booking History
- My Resale Listings
- Complaints
- Profile
- Logout

---

## 5.2 Organizer / Admin application shell

Use left sidebar + top header.

```text
┌──────────────┬───────────────────────────────────────────────┐
│ TickSecure   │ Page title                    Alerts/Profile │
│              ├───────────────────────────────────────────────┤
│ Dashboard    │                                               │
│ Events       │                                               │
│ Tickets      │              Main content                     │
│ Sales        │                                               │
│ ...          │                                               │
│              │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

Desktop sidebar:

- Width: 248px
- White background
- Right border `#EAECF0`
- Section labels in small muted text
- Active item uses light brand tint + dark text + subtle left indicator

Top header:

- Height: 72px
- Breadcrumb + page title left
- Search/action controls centre/right
- Notification icon + role badge + profile avatar right

Content max-width: 1440px.

---

## 6. Shared Component Library

## 6.1 Buttons

### Primary

Dark solid button.

Examples:
- `Book Tickets`
- `Submit Event`
- `Confirm Configuration`
- `Approve Organizer`
- `Proceed to Payment`

### Secondary

White surface, dark border.

Examples:
- `Save Draft`
- `Preview`
- `Export`
- `View Details`

### Tertiary / Text

No container until hover.

Examples:
- `Cancel`
- `Learn more`
- `View blockchain details`

### Destructive

Red text/border or red solid for final confirmed destructive action.

Examples:
- `Suspend Account`
- `Cancel Event`
- `Reject Ticket`

Button states:

- Default
- Hover
- Pressed
- Loading spinner
- Disabled

Never allow double-submission on payment, wallet or blockchain actions.

---

## 6.2 Form Fields

Input height: 44–48px.

Components:

- Text input
- Password field
- Textarea
- Date picker
- Time picker
- Date-time picker
- Select/dropdown
- Searchable select
- Currency input
- Numeric quantity control
- File uploader/dropzone
- Toggle switch
- Checkbox
- Radio group

Every field should have:

1. Visible label
2. Optional helper text
3. Validation state
4. Clear error message below field

Do not rely on placeholder-only labels.

---

## 6.3 Status Chips

Use compact pill-shaped chips.

### Event statuses

- Draft — neutral
- Pending Approval — warning
- Approved — success
- Published — success/info
- Rejected — error
- Suspended — error/warning
- Cancelled — neutral/error

### Booking

- Pending
- Confirmed
- Cancelled
- Refunded
- Completed

### NFT/Blockchain

- Pending
- Confirmed
- Failed

### Complaint

- Open
- Under Investigation
- Awaiting Information
- Resolved
- Rejected

### Seat

- Available
- Reserved
- Sold
- Unavailable

---

## 6.4 Cards

Card types:

- Event card
- KPI/stat card
- Ticket card
- Booking card
- Activity/audit card
- Wallet card
- Empty state card
- Alert card

Cards should use border + white surface, not strong shadows.

---

## 6.5 Tables

Tables are heavily used in Admin and Organizer portals.

Required features:

- Sticky table header for long lists
- Search/filter bar above table
- Sortable columns where useful
- Pagination
- Row hover
- Status chip
- Right-aligned action menu (`...`)
- Bulk action only when genuinely useful
- Empty state with next action

On mobile, convert complex tables into stacked list cards.

---

## 6.6 Modals and Drawers

Use modal for short decisions:

- Confirm approval
- Reject with reason
- Cancel listing
- Suspend account
- Confirm transaction

Use right-side drawer for detail preview without leaving the list:

- User detail
- Event review summary
- Blockchain transaction detail
- Complaint quick view
- Resale activity detail

---

## 6.7 Stepper

Use a horizontal/vertical stepper for multi-step tasks:

- Organizer registration
- Event creation
- Ticket configuration
- Venue blueprint processing
- Booking/checkout
- Resale listing

Example event creation stepper:

`Basic Info → Venue → Media → Ticket Setup → Sales Rules → Preview → Submit`

---

## 7. Authentication and Account UI

## 7.1 Login Page

### Layout

Use split-screen desktop layout:

Left 45%:
- Premium event image or subtle venue imagery
- TickSecure wordmark
- Short trust statement such as “Verified ownership. Fairer ticketing.”

Right 55%:
- White login form
- Email
- Password
- Remember session (optional)
- Forgot Password
- Sign In button
- Register link

Role routing is automatic after login.

### Error states

- Invalid credentials
- Email not verified
- Account suspended
- Organizer application pending
- Organizer application rejected
- Account temporarily locked after repeated failed attempts

Do not expose whether an email exists when it creates a security risk.

---

## 7.2 Registration

Initial role choice:

```text
Create your TickSecure account

[ Ticket Buyer ]    [ Event Organizer ]
```

### Buyer registration fields

- Full Name
- Email
- Password
- Confirm Password
- Terms/privacy acceptance

### Organizer registration fields

Shared user fields:
- Full Name
- Email
- Password
- Confirm Password

Organization profile fields:
- Organization Name
- Organization Description
- Organization Phone
- Organization Address

After submission:

```text
Application submitted
Your organizer account is pending administrator review.
```

Show expected next steps, not blockchain information.

---

## 7.3 Email Verification

Simple centred card:

- Mail icon
- “Verify your email”
- Masked email address
- Resend verification link
- Return to login

---

## 7.4 Forgot / Reset Password

Screens:

1. Enter registered email
2. Confirmation message
3. Reset link page
4. New password + confirm password
5. Password-strength rules
6. Success → return to login

---

## 8. Buyer Experience

# 8.1 Buyer Home Page

The Buyer Home page should feel like a premium event discovery platform.

### Header

- TickSecure logo
- Events
- Resale Marketplace
- Search
- My Tickets
- Notification bell
- Wallet indicator
- Profile

### Hero

Large clean hero with one featured event:

```text
[Event metadata]
Artist/Event Name
Date • Venue • City
Short description

[View Event] [Browse All]
                           [Large event artwork]
```

Do not place multiple promotional banners above the fold.

### Sections

1. Featured Events
2. Upcoming Events
3. Recently Added
4. Verified Resale Tickets
5. “Why TickSecure” trust strip

Trust strip:

- Verified ticket ownership
- Controlled resale prices
- Single-use QR validation
- Secure transaction tracking

---

# 8.2 Event Listing Page

Desktop structure:

```text
Events
[Search__________________________________]

[Date] [Venue] [Category] [Price] [Availability]

[Event Card] [Event Card] [Event Card]
[Event Card] [Event Card] [Event Card]
```

Event card contains:

- Poster
- Event name
- Date/time
- Venue
- Organizer
- Starting price
- Availability status
- `View Event`

Only approved/published events should appear to buyers.

---

# 8.3 Event Detail Page

### Top section

Left:
- Event poster

Right:
- Event name
- Organizer
- Date/time
- Venue
- Event category
- Starting price
- Availability
- `Book Tickets`

### Content tabs/sections

- Overview
- Venue
- Ticket Categories
- Policies

### Ticket category preview

```text
VIP1
RM 688
20 tickets allocated
Section A
[Available]

CAT1
RM 488
40 tickets allocated
Section B
[Limited]
```

Do not show individual seat selection.

Add clear note:

> “Seats are assigned automatically based on the next available seat within your selected category.”

---

# 8.4 Ticket Booking — Category Selection

This is a key conversion screen.

### Layout

Left 65%:
- Event summary
- Category cards

Right 35% sticky order summary:
- Selected category
- Quantity
- Price
- Service charge
- Total

Category card:

```text
VIP1                         RM688
Section A
Next available seat assignment
18 seats remaining

[-] 1 [+]
```

Rules:

- Quantity cannot exceed event purchase limit
- Quantity cannot exceed available inventory
- Show `Sold Out` when unavailable
- Display resale/transfer rule summary before checkout

CTA: `Continue`

---

# 8.5 Automatic Seat Assignment Screen

After category and quantity are confirmed:

```text
Assigning your seats…
```

Use short skeleton/loading state.

When completed:

```text
Seats reserved for you

Category: VIP1
Section: A
Seats: A06, A07
Reservation expires in: 09:42

[Continue to Payment]
```

Important:

- Reservation timer must remain visible during checkout
- If reservation expires, show modal and return seats to inventory
- Do not silently change assigned seats

---

# 8.6 Wallet Connection

Wallet should be treated as a security step, not the main product experience.

### Compact wallet card

```text
Wallet required for NFT ticket ownership

MetaMask
Not connected
[Connect Wallet]
```

After connection:

```text
MetaMask
0x12A4...8F92
Ethereum-compatible network ✓
[Disconnect]
```

If wrong network:

```text
Unsupported network
Switch to [Supported Network]
[Switch Network]
```

Do not expose private-key concepts or request private keys.

---

# 8.7 Checkout / Payment

Desktop two-column layout.

### Left

Payment method panel:
- Payment method
- Payment information
- Secure payment notice

### Right sticky summary

- Event
- Category
- Assigned seat(s)
- Ticket subtotal
- Service charge
- Total
- Reservation countdown

CTA:

`Pay RM 1,416.00`

Processing states:

1. Processing payment
2. Payment confirmed
3. Creating booking
4. Initiating NFT ticket issuance

Do not show raw blockchain transaction details during the critical payment path.

---

# 8.8 Booking Confirmation

Premium success screen.

```text
✓ Booking confirmed

Booking #TS20260001
BLACKPINK World Tour
VIP1 • Seats A06, A07
RM 1,416.00

Your NFT tickets are being issued.
```

Actions:

- `View Booking`
- `View My Tickets`
- `Back to Events`

Blockchain section collapsed by default:

`Technical transaction details ▾`

Inside:
- transaction hash
- network
- status
- smart-contract information when available

---

# 8.9 My Tickets

Card-based ticket wallet.

Filters:
- Active
- Listed for Resale
- Transferred
- Used
- Cancelled/Expired

Ticket card:

- Event artwork thumbnail
- Event name
- Date/time
- Venue
- Category
- Seat
- Ticket status
- `View Ticket`

---

# 8.10 Digital Ticket Detail

This is a premium “digital pass” page.

Main ticket panel:

```text
TICKSECURE VERIFIED TICKET

Event Name
Venue
Date • Time
VIP1
Seat A06

[QR CODE]

Status: Valid
Current owner: 0x12A4...8F92
```

Actions:

- Transfer Ticket
- List for Resale
- View Ownership History
- View Blockchain Details

Security notes:

- QR should only be shown for a valid usable ticket
- Used/transferred/cancelled tickets should clearly disable QR usage

---

# 8.11 Ticket Transfer

Step flow:

1. Select ticket
2. Enter recipient wallet address
3. Review transfer eligibility/rules
4. Wallet approval
5. Transaction pending
6. Success/failure

Confirmation page clearly states ownership changes are blockchain-backed.

---

# 8.12 Resale Marketplace

White marketplace grid/list.

Filters:
- Event
- Date
- Venue
- Ticket Category
- Price

Resale card:

- Event
- Category
- Seat
- Original price
- Resale price
- Price-rule indicator
- Seller address abbreviated
- `View Resale Ticket`

Example pricing display:

```text
Original price    RM500
Resale price      RM530
Maximum allowed   RM550 ✓
```

---

# 8.13 Create Resale Listing

Step 1 — Choose eligible ticket  
Step 2 — Display organizer resale rules  
Step 3 — Enter resale price  
Step 4 — Validate against maximum  
Step 5 — Wallet approval  
Step 6 — Listing confirmation

If resale is disabled or outside the allowed period, explain why instead of simply disabling the button.

---

# 8.14 My Resale Listings

Tabs:

- Active
- Sold
- Cancelled
- Suspended

Each row/card:

- Ticket
- Event
- Original price
- Listing price
- Listing date
- Status
- Edit Price
- Cancel Listing

---

# 8.15 Booking History

Search:
- Booking number
- Event name

Filters:
- Upcoming
- Completed
- Cancelled
- Refunded

Booking detail contains:

- Booking number
- Event
- Category
- Assigned seat(s)
- Booking date
- Payment amount
- Payment status
- Booking status
- NFT ticket links

Blockchain details remain optional/collapsible.

---

# 8.16 Notifications

Notification centre drawer + full page.

Groups:

- Today
- Earlier

Notification types:

- Booking confirmed
- NFT issued
- Event reminder
- Event date/time/venue changed
- Event postponed/cancelled
- Ticket transfer completed/failed
- Resale completed
- Blockchain transaction failed
- Complaint status changed

Allow read/unread state.

---

# 8.17 Buyer Complaint / Dispute

### Complaint list

- Reference number
- Category
- Submitted date
- Priority
- Status
- Last updated

### New complaint form

- Complaint Category
- Description
- Related booking (optional/selectable)
- Related ticket (optional/selectable)
- Evidence upload

Evidence uploader supports file-type/size validation.

### Complaint detail

Timeline:

```text
Submitted
   ↓
Open
   ↓
Under Investigation
   ↓
Awaiting Information
   ↓
Resolved
```

If more information is requested, display a clear action panel.

---

# 8.18 Buyer Profile

Sections:

- Personal Information
- Email Verification
- Password & Security
- Connected Wallet
- Account Status

Keep wallet address separate from personal identity fields visually.

---

## 9. Event Organizer Experience

# 9.1 Organizer Sidebar

Recommended navigation:

**Overview**
- Dashboard

**Event Management**
- My Events
- Create Event

**Sales**
- Sales & Revenue
- NFT Tickets
- Attendees
- Secondary Market

**Support**
- Complaints
- Notifications

**Account**
- Organization Profile

---

# 9.2 Organizer Dashboard

Top:

`Good afternoon, [Organizer Name]`

KPI cards:

- Active Events
- Tickets Sold
- Revenue
- Pending NFT Transactions
- Verified Attendees
- Active Resale Listings

Main widgets:

1. Sales trend
2. Upcoming events
3. Event status overview
4. Recent transactions
5. Notifications/action required

Keep dashboard visualisations clean; avoid more than 2–3 charts visible at once.

---

# 9.3 Organization Profile

Fields:

Shared identity (read/edit where permitted):
- Full Name
- Email

Organization-specific:
- Organization Name
- Organization Description
- Organization Phone
- Organization Address
- Approval Status

Approval status appears as a chip and is not directly editable.

---

# 9.4 My Events

Table/cards:

- Event
- Venue
- Event Date
- Ticket Sales Period
- Event Status
- Tickets Sold
- Last Updated
- Actions

Filters:
- Draft
- Pending Approval
- Approved/Published
- Rejected
- Suspended
- Cancelled

Primary CTA: `Create Event`

---

# 9.5 Create/Edit Event

Use a multi-step wizard.

### Step 1 — Basic Information

- Event Name
- Event Description
- Event Category
- Date
- Time

### Step 2 — Venue

Search/select from Administrator-managed venues.

Display:

- Venue name
- Address
- Capacity
- Processed layout preview
- Available physical sections

### Step 3 — Promotional Media

- Poster upload
- Image preview
- File validation

### Step 4 — Ticket Categories

Organizer creates categories and maps each category to a physical section.

Example:

```text
Category Name: VIP1
Physical Section: Section A
Ticket Price: RM688
Ticket Quantity: 20
```

Show section capacity and prevent invalid over-allocation.

### Step 5 — Sales & Resale Rules

- Sales Start Date/Time
- Sales Closing Date/Time
- Max Tickets per Buyer
- Allow Transfer toggle
- Allow Resale toggle

If resale enabled:
- Resale Start Date/Time
- Resale Deadline
- Maximum Resale Price

### Step 6 — Review & Preview

Display buyer-style event preview.

Actions:
- Save Draft
- Submit for Approval

---

# 9.6 Event Detail / Management

Header:

- Event name
- Status chip
- Event date
- Venue
- `Preview Public Page`

Tabs:

- Overview
- Ticket Configuration
- Sales Rules
- Status History
- Sales
- NFT Distribution
- Attendees
- Secondary Market

Status History is visible for organizer’s own events only.

Each history entry:

- Previous status → New status
- Reason
- Changed date/time
- Actor type where appropriate

---

# 9.7 Sales & Revenue Dashboard

Top KPIs:

- Available
- Reserved
- Sold
- Resold
- Cancelled
- Total Revenue

Charts:

- Ticket sales over time
- Revenue by ticket category
- Initial sale vs resale

Supporting metrics:

- Successful bookings
- Failed bookings
- Verified attendees
- Unverified attendees

Filters:
- Event
- Date range

Actions:
- Generate Report
- Export

---

# 9.8 NFT Ticket Control

Event-level page.

KPI:

- Total tickets
- Minted
- Pending
- Failed

Table:

- Ticket ID
- Category
- Seat
- Token ID
- Current Wallet Owner
- Minting Status
- Transaction Hash
- Action

Transaction hash should be abbreviated with copy button.

Click row → detail drawer:

- NFT metadata
- Smart contract address
- Ownership history
- Blockchain transactions

---

# 9.9 Attendee Management

Table:

- Buyer Name
- Booking Number
- Ticket ID
- Category
- Seat
- Wallet
- Entry Status

Filters:
- Category
- Verified / Unverified

KPI:
- Verified count
- Unverified count

Event Organizer views the status, while scanning is performed in the Authorized Event Personnel interface.

---

# 9.10 Secondary Market Control

Organizer sees resale activity for their own events.

Table:

- Ticket ID
- Seller
- Category
- Original Price
- Resale Price
- Listing Date
- Status
- Rule Compliance

Violation banner:

```text
Resale rule violation detected
Listing exceeds maximum price by RM120.
```

Action:
- Report Suspicious Listing to Administrator

Organizer does not receive full system enforcement/audit access.

---

# 9.11 Organizer Complaints

Organizer may:

- Submit complaint/dispute
- View own complaint status
- Upload requested information
- View final resolution

Use the same complaint UI pattern as Buyer.

---

## 10. Administrator Experience

# 10.1 Admin Sidebar

Recommended navigation:

**Overview**
- Dashboard

**Management**
- Users
- Organizer Applications
- Events
- Venues & Layouts

**Monitoring**
- Blockchain Transactions
- Resale Monitoring
- Audit Logs

**Support & Governance**
- Complaints
- Reports

**Account**
- Profile

---

# 10.2 Administrator Dashboard

KPI row:

- Registered Users
- Approved Organizers
- Pending Organizer Applications
- Published Events
- NFT Tickets Issued
- Resale Transactions

Risk/attention cards:

- Pending event reviews
- Suspicious resale activities
- Failed blockchain transactions
- Open complaints

Charts:

- System activity trend
- Ticket transaction status

Recent activity:

- Organizer approved
- Event rejected
- NFT transaction failed
- Resale listing flagged
- Complaint escalated

---

# 10.3 User Management

Table:

- User
- Email
- Role
- Account Status
- Email Verified
- Created Date
- Last Activity
- Actions

Filters:
- Role
- Status
- Verification

Actions:
- View
- Suspend
- Reactivate

Use confirmation modal with reason for suspension.

---

# 10.4 Organizer Applications

Default view should prioritise pending applications.

Application card/table:

- Applicant full name
- Organization name
- Email
- Submitted date
- Status

Detail view:

- Full Name
- Email
- Organization Name
- Organization Description
- Phone
- Address
- Submission details

Actions:
- Approve
- Reject

Reject requires reason.

---

# 10.5 Event Oversight

Tabs:

- Pending Review
- All Events
- Suspended
- Cancelled
- Review History

Pending event review uses split layout:

Left:
- Event preview

Right:
- Organizer information
- Venue
- Ticket categories
- Sales/resale rules
- Submission information

Actions:
- Approve
- Reject
- Request Correction

All decisions require confirmation and are recorded.

---

# 10.6 Venue Management

This is a major new Administrator UI.

Venue list:

- Venue Name
- Address
- Capacity
- Layout Status
- Detected Sections
- Last Updated
- Actions

Primary CTA: `Add Venue`

### Add Venue

Fields:
- Venue Name
- Address
- Seating Capacity

After save → `Upload Seating Blueprint`.

---

# 10.7 Blueprint Upload & Processing

Use a focused wizard.

### Step 1 — Upload

Large drag-and-drop area:

```text
Upload venue seating blueprint
PNG, JPG or PDF • Max configured file size

[Choose File]
```

Show preview after upload.

### Step 2 — Processing

Processing panel:

```text
Analysing venue blueprint…

✓ File validated
✓ Image prepared
• Detecting venue sections
• Preparing review layout
```

Use progress state but do not fake exact percentages unless backend provides them.

### Step 3 — Detected Section Review

This should be one of the most polished Admin screens.

Desktop split view:

```text
┌────────────────────────────────┬─────────────────────────────┐
│                                │ Detected Sections           │
│   Processed Blueprint          │                             │
│                                │ Section 1                   │
│   [highlighted boundaries]     │ Name: [Section A_______]    │
│                                │ Seats: [20_____________]    │
│                                │                             │
│                                │ Section 2                   │
│                                │ Name: [Section B_______]    │
│                                │ Seats: [30_____________]    │
└────────────────────────────────┴─────────────────────────────┘
```

When admin selects a section in the right list, highlight its detected boundary on the blueprint.

Admin can:

- Rename detected physical section
- Enter/confirm total seat count
- Mark an invalid detection for removal
- Add a missing section manually if required

Do **not** permanently assign `VIP1`/`CAT1` here. Those are event-level categories configured by Organizer.

### Step 4 — Generate Seat Structure

After section seat counts are confirmed:

```text
Section A — 20 seats
A01 ... A20

Section B — 30 seats
B01 ... B30
```

System establishes assignment order.

Admin can review before activating.

### Step 5 — Activate Layout

Summary:

- Venue
- Total capacity
- Detected/confirmed sections
- Generated seats
- Processing status

CTA: `Activate Seating Layout`

---

# 10.8 Blockchain Transaction Monitoring

Table:

- Transaction Hash
- Wallet
- Transaction Type
- Ticket ID
- Status
- Date/Time

Filters:
- Pending
- Confirmed
- Failed
- Transaction type
- Date

Search by:
- Transaction hash
- Ticket ID
- Wallet address
- Booking number
- Event ID

Detail drawer:

- Full transaction hash
- Network
- Wallet
- Ticket
- Related booking/resale
- Status
- Failure reason
- Timestamp

---

# 10.9 Audit Log

Administrator-only full audit access.

Table:

- Date/Time
- User/System Actor
- Role
- Activity Type
- Related Entity
- Result
- Details

Filters:
- User
- Role
- Activity type
- Date range
- Result/status

Important audit events include:

- Login success/failure
- Registration
- Organizer approval/rejection
- Account suspension/reactivation
- Event creation/approval/rejection/modification/suspension/cancellation
- NFT issuance
- Ownership transfer
- Resale
- QR verification
- Complaint resolution

Audit records should be read-only in the UI.

---

# 10.10 Resale Monitoring

Table:

- Ticket
- Event
- Seller
- Buyer
- Wallet
- Original Price
- Resale Price
- Maximum Allowed
- Listing/Transaction Status
- Risk Flag

Risk indicators:

- Above price limit
- Outside resale period
- Repeated suspicious activity
- Blacklisted wallet/account

Actions:

- View Details
- Suspend Listing
- Blacklist User/Wallet
- Generate Report

Destructive actions require reason + confirmation.

---

# 10.11 Complaint Management

Queue layout.

Tabs:
- Open
- Under Investigation
- Awaiting Information
- Resolved
- Rejected

Complaint detail:

Left:
- Complaint description
- Evidence
- Timeline

Right:
- Complainant
- Related booking
- Payment
- NFT ownership
- Wallet
- Resale information
- Blockchain transaction references

Actions:

- Request More Information
- Mark Under Investigation
- Resolve
- Reject

Resolve modal:

- Resolution Action
- Resolution Explanation

Reject modal:

- Rejection Reason
- Explanation

---

# 10.12 Reports

Report cards:

- System Activity Report
- Blockchain Transaction Report
- Security/Audit Report
- Resale Monitoring Report
- Ticket Sales Report (if Admin has permission)

Each report builder:

- Date range
- Event
- Status/type filters
- Generate
- Export

---

## 11. Authorized Event Personnel Verification Interface

This interface must be extremely fast and simple.

Avoid the full Admin/Organizer sidebar.

### Scanner screen

```text
TickSecure Entry Verification
[Event Name]

┌────────────────────────────┐
│                            │
│       QR Camera Area       │
│                            │
└────────────────────────────┘

Ready to scan
```

### Successful verification

Large green success state:

```text
✓ VALID TICKET

VIP1 • Seat A06
Ticket TS-TK-001
Ownership verified
Not previously used

ENTRY ALLOWED
```

Then automatically reset scanner after a short delay/button.

### Invalid verification

Large red state:

```text
✕ ENTRY DENIED

Reason:
Ticket already used
```

Other possible reasons:

- Invalid QR
- Wrong event
- Ticket cancelled
- Ticket transferred
- Ticket expired
- Ownership mismatch
- Already used

Record verification attempt automatically.

---

## 12. Key End-to-End UX Flows

# 12.1 Buyer Purchase Flow

```text
Browse Events
   ↓
Event Detail
   ↓
Select Ticket Category
   ↓
Select Quantity
   ↓
Automatic Seat Assignment
   ↓
Temporary Reservation + Countdown
   ↓
Connect/Verify Wallet
   ↓
Review Order
   ↓
Payment
   ↓
Booking Confirmed
   ↓
NFT Issuance Pending
   ↓
NFT Confirmed
   ↓
My Tickets
```

Critical rule: if payment fails or reservation expires, release the reserved event seats.

---

# 12.2 Organizer Event Flow

```text
Create Event
   ↓
Select Venue
   ↓
Upload Promotional Media
   ↓
Map Ticket Categories to Venue Sections
   ↓
Configure Prices/Quantities
   ↓
Configure Sales/Transfer/Resale Rules
   ↓
Preview
   ↓
Save Draft OR Submit
   ↓
Pending Approval
   ↓
Approved / Rejected / Correction Requested
```

---

# 12.3 Admin Venue Blueprint Flow

```text
Create Venue
   ↓
Upload Blueprint
   ↓
Backend Processing
   ↓
Detect Physical Sections
   ↓
Admin Reviews Sections
   ↓
Admin Confirms Section Names + Seat Counts
   ↓
Generate Seats + Assignment Order
   ↓
Activate Layout
   ↓
Organizer can use venue for event configuration
```

---

# 12.4 Resale Flow

```text
Buyer selects eligible NFT ticket
   ↓
System checks current ownership
   ↓
System checks organizer resale rules
   ↓
Buyer enters resale price
   ↓
Validate price/deadline
   ↓
Wallet approval
   ↓
Listing active
   ↓
Another buyer purchases
   ↓
Payment success
   ↓
NFT ownership transfer
   ↓
Listing completed
```

---

# 12.5 Event Entry Flow

```text
Attendee opens digital ticket
   ↓
Shows QR
   ↓
Authorized personnel scans QR
   ↓
Verify ticket authenticity
   ↓
Verify current blockchain owner
   ↓
Verify correct event
   ↓
Verify ticket status
   ↓
Verify not previously used
   ↓
Valid → mark used → entry allowed
Invalid → display reason → entry denied
```

---

## 13. Loading, Empty, Error and Success States

Every major page must define these states before implementation is considered complete.

### Loading

Use skeletons for:

- Event cards
- Dashboard KPI cards
- Tables
- Ticket cards

Use spinners only for short isolated actions.

Blockchain operations may take longer; show a clear pending state with safe-to-leave guidance when appropriate.

### Empty state

Examples:

**No Events**
> No events yet. Create your first event to begin ticket configuration.

**No Tickets**
> You do not have any active tickets yet.

**No Complaints**
> No complaints match the selected filters.

### Error state

Use clear user language:

Bad:
> Transaction reverted: RPC error 32603

Good:
> The blockchain transaction could not be completed. Check your wallet/network and try again.

Technical details may be placed under `View technical details`.

### Success feedback

Use toast for minor actions:
- Profile updated
- Notification marked as read
- Report generated

Use full confirmation state for major actions:
- Booking confirmed
- Event submitted
- Organizer approved
- Resale completed

---

## 14. Blockchain UX Rules

1. Never show blockchain terminology unless it helps the current task.
2. Use plain-language status first: `Ticket issued`, `Transfer pending`, `Transfer failed`.
3. Put transaction hash, contract address, network and gas information in an expandable technical section.
4. Never ask for or display a wallet private key.
5. Use abbreviated wallet addresses in common views: `0x12A4...8F92`.
6. Provide one-click copy for full wallet/transaction values.
7. Pending transactions should show what the user can safely do next.
8. Wallet rejection is not a generic “system error”; say `You rejected the wallet request.`

---

## 15. Security UX

UI should reinforce system security without becoming alarming.

### Account

- Password strength guidance
- Failed-login lockout message
- Session expiry notice with sign-in action
- Suspended account explanation

### Sensitive actions

Require confirmation for:

- Organizer approval/rejection
- Event suspension/cancellation
- Account suspension
- Wallet/NFT transfer
- Resale listing
- Complaint resolution

### Audit-sensitive actions

After success, display a non-intrusive note:

> “This action has been recorded for audit purposes.”

Use primarily in Admin portal, not repeatedly in Buyer UI.

---

## 16. Responsive Design

### Breakpoints

- Mobile: `< 768px`
- Tablet: `768–1023px`
- Desktop: `1024–1439px`
- Large desktop: `≥ 1440px`

### Buyer mobile

- Top navigation becomes compact header + menu
- Ticket/order summary becomes bottom/sticky summary card
- Event grids become 1 column
- Filters open in bottom sheet
- Digital ticket QR remains large and scannable

### Admin/Organizer tablet/mobile

- Sidebar collapses into drawer
- Tables convert to scrollable table or stacked cards depending on complexity
- Primary action remains visible near page heading
- Avoid more than two columns below 1024px

### Blueprint review

This workflow should be desktop/tablet-first because detailed section review is difficult on small mobile screens.

On mobile, provide view-only or simplified edit controls and recommend larger-screen review.

---

## 17. Accessibility

Minimum requirements:

- WCAG AA text contrast
- Full keyboard navigation
- Visible focus rings
- Every icon-only button has accessible label
- Inputs have labels and linked error text
- Status does not rely only on colour
- Modal focus trapping
- Escape closes non-destructive modal
- Tables have semantic headers
- QR result uses icon + colour + text
- Click targets minimum ~44px where possible

---

## 18. Motion and Micro-interactions

Motion should be subtle.

Recommended duration:

- Hover: 120–160ms
- Dropdown/drawer: 180–220ms
- Modal: 180–220ms
- Page skeleton fade: 200ms

Use motion for:

- Button hover
- Sidebar active transition
- Drawer/modal entry
- Status change feedback
- Blueprint section highlight
- Seat-assignment completion

Do not use bouncing/glowing blockchain animations.

---

## 19. Suggested Route Structure

### Public/Auth

```text
/
/events
/events/:eventId
/resale
/resale/:listingId
/login
/register
/verify-email
/forgot-password
/reset-password
```

### Buyer

```text
/buyer/dashboard
/buyer/tickets
/buyer/tickets/:ticketId
/buyer/bookings
/buyer/bookings/:bookingId
/buyer/resale
/buyer/resale/new/:ticketId
/buyer/notifications
/buyer/complaints
/buyer/complaints/new
/buyer/complaints/:complaintId
/buyer/profile
```

### Organizer

```text
/organizer/dashboard
/organizer/events
/organizer/events/new
/organizer/events/:eventId
/organizer/events/:eventId/configuration
/organizer/events/:eventId/sales
/organizer/events/:eventId/nft
/organizer/events/:eventId/attendees
/organizer/events/:eventId/secondary-market
/organizer/complaints
/organizer/profile
```

### Administrator

```text
/admin/dashboard
/admin/users
/admin/users/:userId
/admin/organizers/pending
/admin/organizers/:organizerId
/admin/events
/admin/events/:eventId
/admin/venues
/admin/venues/new
/admin/venues/:venueId
/admin/venues/:venueId/layout
/admin/blockchain
/admin/audit
/admin/resale
/admin/complaints
/admin/complaints/:complaintId
/admin/reports
/admin/profile
```

### Event Verification

```text
/verify/:eventId
```

---

## 20. UI Component Inventory for Development

Create reusable components instead of page-specific duplicates.

### Foundation

- `AppShell`
- `PublicHeader`
- `DashboardSidebar`
- `DashboardHeader`
- `PageHeader`
- `Breadcrumbs`

### Actions

- `Button`
- `IconButton`
- `DropdownMenu`
- `ConfirmDialog`

### Forms

- `TextField`
- `PasswordField`
- `TextArea`
- `SelectField`
- `SearchSelect`
- `DatePicker`
- `TimePicker`
- `DateTimePicker`
- `CurrencyField`
- `QuantitySelector`
- `Toggle`
- `Checkbox`
- `FileDropzone`

### Feedback

- `StatusChip`
- `AlertBanner`
- `Toast`
- `EmptyState`
- `Skeleton`
- `ProgressStepper`

### Data

- `DataTable`
- `Pagination`
- `FilterBar`
- `KpiCard`
- `Timeline`
- `DetailDrawer`

### Event/Ticket

- `EventCard`
- `EventHero`
- `TicketCategoryCard`
- `OrderSummary`
- `ReservationTimer`
- `DigitalTicketCard`
- `QRCodePanel`
- `WalletCard`
- `BlockchainDetailAccordion`

### Venue

- `VenueCard`
- `BlueprintUploader`
- `BlueprintViewer`
- `DetectedSectionOverlay`
- `SectionEditorPanel`
- `SeatGenerationSummary`

### Monitoring

- `TransactionTable`
- `AuditLogTable`
- `ComplaintTimeline`
- `RiskFlag`

---

## 21. Recommended Page Hierarchy Priorities for Development

### Phase 1 — Foundation and authentication

1. Design tokens/theme
2. Shared layouts
3. Login
4. Buyer registration
5. Organizer registration
6. Email verification
7. Password reset
8. Profile

### Phase 2 — Event discovery and organizer event setup

1. Buyer event listing
2. Event detail
3. Organizer dashboard
4. Organizer event list
5. Create/edit event
6. Ticket category configuration
7. Sales/resale rules

### Phase 3 — Venue and booking

1. Admin venue management
2. Blueprint upload
3. Blueprint processing/review
4. Venue sections/seats
5. Buyer category selection
6. Automatic seat assignment
7. Ticket reservation countdown
8. Payment
9. Booking confirmation

### Phase 4 — Blockchain/NFT

1. Wallet connection
2. NFT issuance status
3. My Tickets
4. Ticket detail/QR
5. Ownership history
6. Transfer

### Phase 5 — Resale, verification and governance

1. Resale listing
2. Resale marketplace
3. Organizer secondary-market monitoring
4. Admin resale monitoring
5. QR verification
6. Attendee list
7. Complaint management
8. Audit logs
9. Reports

---

## 22. UI Acceptance Checklist

Before considering a screen complete, verify:

### Visual

- [ ] White-first premium visual direction is maintained
- [ ] No unnecessary gradients/neon styling
- [ ] Typography hierarchy is consistent
- [ ] Spacing follows 8px grid
- [ ] Card borders/radii are consistent
- [ ] Status colours follow tokens

### Functional

- [ ] Role permissions are reflected in visible actions
- [ ] Loading state exists
- [ ] Empty state exists
- [ ] Error state exists
- [ ] Success state exists
- [ ] Destructive actions require confirmation
- [ ] Validation messages are specific

### Buyer booking

- [ ] Buyer selects category, not individual seat
- [ ] Auto-assigned seat is shown before payment
- [ ] Reservation countdown is visible
- [ ] Seat is released after expiry/failure
- [ ] Wallet state is clear
- [ ] Booking is confirmed only after payment success

### Venue blueprint

- [ ] Admin can upload blueprint
- [ ] Processing state is visible
- [ ] Detected sections are visually highlighted
- [ ] Admin can confirm section name and seat count
- [ ] Generated seat assignment order is reviewable
- [ ] Layout activation is explicit

### Blockchain

- [ ] Technical details hidden from primary flow by default
- [ ] Transaction pending/confirmed/failed states are distinct
- [ ] Wallet address is abbreviated in normal views
- [ ] No private-key field exists anywhere

### Responsive/accessibility

- [ ] Mobile buyer flow is usable
- [ ] Sidebar collapses correctly
- [ ] Keyboard focus is visible
- [ ] Colour is not the only status indicator
- [ ] QR code remains large enough for scanning

---

## 23. Final Design Principle

Every TickSecure screen should answer three questions immediately:

1. **Where am I?** — clear page title, navigation and current context.
2. **What is the current status?** — event, booking, payment, NFT, resale or complaint status must be obvious.
3. **What should I do next?** — each page should have one clear primary action.

The premium quality of TickSecure should come from **clarity, spacing, typography, trust and restraint**, not visual decoration. The buyer should feel that TickSecure is a high-end ticket platform first and a blockchain-backed security system second.
