# TickSecure Firestore Database Schema

This document outlines the NoSQL structure used in Cloud Firestore.

## Collections

### 1. `Users`
Stores authentication profile data for all users.
- `uid` (Document ID)
- `email`: string
- `fullName`: string
- `role`: string (`"buyer"`, `"organizer"`, `"admin"`)
- `status`: string (`"active"`, `"pending"`, `"suspended"`)
- `createdAt`: ISO 8601 Timestamp

### 2. `OrganizerProfiles`
Extended data for users with the `"organizer"` role.
- `uid` (Document ID, matches User ID)
- `organizationName`: string
- `organizationDescription`: string
- `organizationPhone`: string
- `organizationAddress`: string

### 3. `Venues`
Physical venues managed by the Administrator.
- `venueId` (Document ID)
- `name`: string
- `location`: string
- `capacity`: number
- `layoutStatus`: string (`"DRAFT"`, `"ACTIVE"`)
- `sections`: Array of objects
  - `sectionId`: string (e.g., "A")
  - `name`: string
  - `seatCount`: number
  - `geometry`: { `left`: number, `top`: number, `width`: number, `height`: number }

### 4. `Events`
Concerts and experiences created by Organizers.
- `eventId` (Document ID)
- `name`: string
- `date`: string
- `venueId`: reference string
- `status`: string (`"DRAFT"`, `"PENDING_REVIEW"`, `"PUBLISHED"`)
- `categories`: Object map of venue sections to commercial ticket categories
  - Example: `"A": { "name": "VIP1", "price": "RM688" }`

### 5. `Bookings`
Records of purchased seats.
- `bookingId` (Document ID)
- `buyerUid`: string
- `eventId`: string
- `categoryId`: string
- `seatId`: string (e.g., "A06")
- `status`: string (`"RESERVED"`, `"CONFIRMED"`)
- `timestamp`: ISO 8601 Timestamp

### 6. `NFTTickets`
The digital ownership records.
- `tokenId` (Document ID)
- `bookingId`: string
- `walletAddress`: string (Ethereum address)
- `status`: string (`"PENDING"`, `"MINTED"`, `"USED"`)
