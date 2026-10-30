# Added role CRUD and resale actions

These additions use the existing Firebase project, authentication, service
objects and role restrictions. Existing venue layout, seat selection,
reservation, initial checkout, ticket transfer and scanning implementations
are retained.

## Administrator

- **User Management → Create account** provisions a buyer or pending organizer.
  Firebase enforces the existing password policy. A separate, memory-only Auth
  instance keeps the administrator signed in. New accounts must verify their
  email; organizers still require the existing approval action.
- **User details → Edit / archive account** edits the name and organization
  fields. Credential email, role and verification are not editable here.
- **Archive account** is a logical deletion: `Users.status = deleted` removes
  access while preserving linked ticket, booking, event and complaint history.
  It does not delete Firebase Auth credentials. Archived accounts appear under
  the Archived filter. Self-archiving and archiving administrators are blocked.
  Resale purchase rejects listings whose seller is no longer active.

## Organizer and buyer

- An organizer's rejected event now has **Revise** in My Events. It returns the
  event to draft without changing its details. The existing editor and approval
  process then apply.
- Organizer complaint references open their details. Buyer complaints have a
  **Manage** action. Owners may update category/description or delete a complaint
  only while it remains OPEN. Investigation, evidence and resolution fields
  remain protected. A concurrent administrator status change prevents the save
  or deletion.
- Buyer and organizer notifications now have a Delete action, using the existing
  recipient-only notification service and rules.

## Resale

- **Create Listing** works with or without `ticketId`: choose a currently owned,
  valid ticket, review the event's current resale window/cap and connect a
  wallet before listing. Fixed caps below face value are supported.
- Existing seller repricing/cancellation and administrator suspension use the
  authenticated backend. Cancellation/repricing recheck ownership and ticket
  status. Suspension never restores a used ticket or another owner's ticket.
- Purchase rechecks the current event, seller, ticket ownership/event/section,
  buyer holding limit, current cap and the price the buyer confirmed. Two buyers
  cannot purchase the same listing. Retrying a completed purchase returns its
  receipt without issuing another transfer.
- **My resale purchases** shows completed purchases and receipts. Buyers may
  read their own completed listings under the added rules.
- Payment and blockchain operations retain the project's existing simulation;
  these additions do not accept real payments or submit blockchain transactions.

## Activate and verify

Deploy the updated Firestore rules for complaint editing/deletion, rejected-event
revision and resale purchase history:

```sh
firebase deploy --only firestore:rules
```

XAMPP's `.htaccess` enables the separate, loopback-only
`TICKSECURE_PHP_RESALE=1` route. Localhost automatically routes only the five
resale actions to PHP when Emulator mode is off. It uses the existing private
`api/firebase-config.local.php` service-account configuration. Other backend
actions keep their existing opt-ins. PHP's development server ignores
`.htaccess`; set `TICKSECURE_PHP_RESALE=1` in its environment when using it.

For deployed Firebase Functions, deploy the five changed resale functions:

```sh
firebase deploy --only functions:createResaleListing,functions:updateResalePrice,functions:cancelResaleListing,functions:suspendResaleListing,functions:purchaseResale
```

Restart the Functions emulator instead when using the Emulator Suite. No cloud
deployment is performed by these code changes.

```sh
node --test tests/*.test.cjs
```

The added tests execute the actual Firebase/PHP resale transaction code against
in-memory fixtures, including 22 parity cases, concurrent purchases and retry
behavior. Role CRUD tests cover provisioning/session preservation, rollback,
ownership, investigation locks and rejected-event revision. These tests do not
replace authenticated integration checks against deployed Firestore rules.
