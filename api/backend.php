<?php
declare(strict_types=1);

/**
 * Local XAMPP replacement for the callable Firebase Functions used by the
 * ticketing workflows. It is intentionally opt-in and loopback-only. The
 * browser authenticates with a Firebase ID token; this endpoint verifies that
 * token and then uses a service account kept outside htdocs for atomic
 * Firestore transactions.
 *
 * This is suitable for an FYP/local demonstration, not an internet-facing
 * production server. Use the deployed Functions or Emulator Suite there.
 */

require_once __DIR__ . '/firebase-admin.php';

const BACKEND_SERVICE_CHARGE = 20;
const BACKEND_MAX_REQUEST_BYTES = 131072;

/** @param array<string,mixed> $payload */
function backend_respond(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, max-age=0');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function backend_is_loopback_request(): bool
{
    $remoteAddress = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    if ($remoteAddress === '::1' || $remoteAddress === '::ffff:127.0.0.1') {
        return true;
    }

    return filter_var($remoteAddress, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false
        && str_starts_with($remoteAddress, '127.');
}

function backend_is_enabled(): bool
{
    return getenv('TICKSECURE_PHP_BACKEND') === '1' && backend_is_loopback_request();
}

function backend_fail(int $status, string $message, string $code): never
{
    throw new FirebaseBackendException($status, $message, $code);
}

function backend_now(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\\TH:i:s.v\\Z');
}

function backend_require_id(mixed $value, string $label): string
{
    if (!is_string($value) || !preg_match('/^[A-Za-z0-9_-]{1,160}$/', $value)) {
        backend_fail(400, $label . ' is invalid.', 'invalid-argument');
    }
    return $value;
}

/** @return list<string> */
function backend_optional_seat_ids(mixed $value): array
{
    if ($value === null) {
        return [];
    }
    if (!is_array($value) || $value === [] || count($value) > 20) {
        backend_fail(400, 'Seat selection is invalid.', 'invalid-argument');
    }

    $ids = [];
    foreach ($value as $seatId) {
        $ids[] = backend_require_id($seatId, 'Seat ID');
    }
    if (count(array_unique($ids)) !== count($ids)) {
        backend_fail(400, 'Seat selection contains duplicates.', 'invalid-argument');
    }
    return $ids;
}

function backend_require_positive_integer(mixed $value, string $label, int $maximum = 20): int
{
    if (!is_int($value) && !is_float($value) && !is_string($value)) {
        backend_fail(400, $label . " must be between 1 and {$maximum}.", 'invalid-argument');
    }
    if (!is_numeric($value)) {
        backend_fail(400, $label . " must be between 1 and {$maximum}.", 'invalid-argument');
    }
    $number = (float)$value;
    if (floor($number) !== $number || $number < 1 || $number > $maximum) {
        backend_fail(400, $label . " must be between 1 and {$maximum}.", 'invalid-argument');
    }
    return (int)$number;
}

function backend_number(mixed $value, float $fallback = 0.0): float
{
    return (is_int($value) || is_float($value) || (is_string($value) && is_numeric($value)))
        ? (float)$value
        : $fallback;
}

function backend_money(float $value): float
{
    return round($value, 2, PHP_ROUND_HALF_UP);
}

function backend_require_price(mixed $value): float
{
    if (!is_int($value) && !is_float($value) && !is_string($value)) {
        backend_fail(400, 'Resale price is invalid.', 'invalid-argument');
    }
    $price = backend_number($value, NAN);
    if (!is_finite($price) || $price <= 0 || $price > 1000000) {
        backend_fail(400, 'Resale price is invalid.', 'invalid-argument');
    }
    return backend_money($price);
}

function backend_require_wallet_address(
    mixed $value,
    string $message = 'Connect a valid Ethereum wallet before continuing.'
): string {
    $walletAddress = is_string($value) ? trim($value) : '';
    if (!preg_match('/^0x[a-fA-F0-9]{40}$/', $walletAddress)) {
        backend_fail(412, $message, 'failed-precondition');
    }
    return $walletAddress;
}

function backend_require_text(mixed $value, string $label, int $minimum, int $maximum): string
{
    if (!is_string($value)) {
        backend_fail(400, $label . ' is invalid.', 'invalid-argument');
    }
    $text = trim($value);
    if (strlen($text) < $minimum || strlen($text) > $maximum) {
        backend_fail(400, $label . ' is invalid.', 'invalid-argument');
    }
    return $text;
}

/** @param array<string,mixed>|mixed $categories @return array<string,mixed>|null */
function backend_category_for_section(mixed $categories, string $sectionId): ?array
{
    if (!is_array($categories)) {
        return null;
    }

    if (array_is_list($categories)) {
        foreach ($categories as $category) {
            if (!is_array($category)) {
                continue;
            }
            $candidate = (string)($category['sectionId'] ?? $category['section'] ?? $category['id'] ?? '');
            if ($candidate === $sectionId) {
                return ['sectionId' => $sectionId] + $category;
            }
        }
        return null;
    }

    $category = $categories[$sectionId] ?? null;
    return is_array($category) ? ['sectionId' => $sectionId] + $category : null;
}

function backend_policy_date_timestamp(mixed $value, bool $endOfDay = false): ?float
{
    $raw = is_string($value) ? trim($value) : '';
    if ($raw === '') {
        return null;
    }
    try {
        $date = preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $raw)
            ? new DateTimeImmutable($raw . ($endOfDay ? 'T23:59:59.999+08:00' : 'T00:00:00+08:00'))
            : new DateTimeImmutable($raw);
        return (float)$date->format('U.u');
    } catch (Throwable) {
        return null;
    }
}

function backend_policy_window_is_open(mixed $startValue, mixed $endValue): bool
{
    $current = microtime(true);
    if (is_string($startValue) && trim($startValue) !== '') {
        $start = backend_policy_date_timestamp($startValue);
        if ($start === null || $start > $current) {
            return false;
        }
    }
    if (is_string($endValue) && trim($endValue) !== '') {
        $end = backend_policy_date_timestamp($endValue, true);
        if ($end === null || $end < $current) {
            return false;
        }
    }
    return true;
}

/** @param array<string,mixed> $event */
function backend_sales_are_open(array $event): bool
{
    return ($event['status'] ?? '') === 'PUBLISHED'
        && backend_policy_window_is_open($event['salesStartDate'] ?? '', $event['salesEndDate'] ?? '');
}

/** @param array<string,mixed> $event */
function backend_resale_is_open(array $event): bool
{
    return ($event['status'] ?? '') === 'PUBLISHED'
        && ($event['resaleEnabled'] ?? false) === true
        && backend_policy_window_is_open($event['resaleStartDate'] ?? '', $event['resaleDeadline'] ?? '');
}

/** @param array<string,mixed> $seat */
function backend_reservation_is_active(array $seat): bool
{
    $expiry = strtotime((string)($seat['reservationExpiry'] ?? ''));
    return $expiry !== false && $expiry > time();
}

function backend_new_document_id(): string
{
    return rtrim(strtr(base64_encode(random_bytes(15)), '+/', '-_'), '=');
}

function backend_booking_number(): string
{
    $timePart = strtoupper(base_convert((string)(int)floor(microtime(true) * 1000), 10, 36));
    return 'TS' . $timePart . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));
}

/** @param array<string,mixed> $profile @return array<string,mixed> */
function backend_actor_from_profile(string $uid, array $profile): array
{
    $profile['uid'] = $uid;
    return $profile;
}

/** @return array<string,mixed> */
function backend_get_actor(FirebaseFirestoreTransaction $transaction, string $uid): array
{
    $profile = $transaction->get('Users', $uid);
    if ($profile === null) {
        backend_fail(403, 'Your user profile was not found.', 'permission-denied');
    }
    return backend_actor_from_profile($uid, $profile);
}

/** @return array<string,mixed> */
function backend_get_current_actor(FirebaseAdminRest $firebase, string $uid): array
{
    $profile = $firebase->getDocument('Users', $uid);
    if ($profile === null) {
        backend_fail(403, 'Your user profile was not found.', 'permission-denied');
    }
    return backend_actor_from_profile($uid, $profile);
}

/** @param array<string,mixed> $actor */
function backend_assert_active_buyer(array $actor): void
{
    if (($actor['role'] ?? '') !== 'buyer'
        || ($actor['status'] ?? '') !== 'active'
        || ($actor['emailVerified'] ?? false) !== true) {
        backend_fail(403, 'An active, verified buyer account is required.', 'permission-denied');
    }
}

/** @param array<string,mixed> $actor */
function backend_assert_active_admin(array $actor): void
{
    if (($actor['role'] ?? '') !== 'admin'
        || ($actor['status'] ?? '') !== 'active'
        || ($actor['emailVerified'] ?? false) !== true) {
        backend_fail(403, 'Only administrators can perform this action.', 'permission-denied');
    }
}

/** @param array<string,mixed> $actor */
function backend_assert_active_account(array $actor): void
{
    if (($actor['status'] ?? '') !== 'active' || ($actor['emailVerified'] ?? false) !== true) {
        backend_fail(403, 'An active, verified account is required.', 'permission-denied');
    }
}

function backend_owned_ticket_count(FirebaseFirestoreTransaction $transaction, string $eventId, string $ownerUid): int
{
    return count($transaction->query('NFTTickets', ['eventId' => $eventId, 'ownerUid' => $ownerUid]));
}

/** @param array<string,mixed> $actor @param array<string,mixed> $details @return array<string,mixed> */
function backend_audit_doc(string $action, string $entityType, string $entityId, array $actor, array $details = []): array
{
    return [
        'action' => $action,
        'entityType' => $entityType,
        'entityId' => $entityId,
        'actorUid' => (string)($actor['uid'] ?? ''),
        'actorEmail' => (string)($actor['email'] ?? ''),
        'actorRole' => (string)($actor['role'] ?? ''),
        'details' => $details,
        'result' => 'success',
        'timestamp' => backend_now(),
    ];
}

/** @return array<string,mixed> */
function backend_notification(string $recipientUid, string $message, string $type, string $relatedType, string $relatedId): array
{
    return [
        'recipientUid' => $recipientUid,
        'message' => $message,
        'type' => $type,
        'relatedEntityType' => $relatedType,
        'relatedEntityId' => $relatedId,
        'read' => false,
        'createdAt' => backend_now(),
    ];
}

/** @return array<string,mixed> */
function backend_simulated_blockchain_record(
    string $transactionType,
    string $ticketId,
    string $walletAddress,
    string $relatedEntityType,
    string $relatedEntityId,
    string $timestamp
): array {
    return [
        'transactionHash' => '',
        'walletAddress' => $walletAddress,
        'transactionType' => $transactionType,
        'ticketId' => $ticketId,
        'relatedEntityType' => $relatedEntityType,
        'relatedEntityId' => $relatedEntityId,
        'status' => 'PENDING',
        'network' => 'SIMULATED - no chain submission',
        'failureReason' => '',
        'timestamp' => $timestamp,
    ];
}

/** @param array<string,mixed> $event */
function backend_max_tickets_per_buyer(array $event): int
{
    $configured = (int)floor(backend_number($event['maxTicketsPerBuyer'] ?? 0));
    return $configured > 0 ? $configured : 4;
}

/** @param array<string,mixed> $ticket @return list<mixed> */
function backend_transfer_history(array $ticket): array
{
    $history = $ticket['transferHistory'] ?? [];
    return is_array($history) && array_is_list($history) ? $history : [];
}

/**
 * Lazily creates the event-specific inventory. Every create has an existence
 * precondition and is performed in short transactions, so an existing sold or
 * reserved EventSeat is never reset by a later first-use request.
 *
 * @param array<string,mixed> $event
 */
function backend_ensure_event_inventory(FirebaseAdminRest $firebase, array $event): void
{
    $eventId = backend_require_id($event['id'] ?? null, 'Event ID');
    $venueId = backend_require_id($event['venueId'] ?? null, 'Venue ID');
    $rawCategories = $event['categories'] ?? [];
    if (!is_array($rawCategories)) {
        backend_fail(412, 'This event has no ticket inventory configured.', 'failed-precondition');
    }

    $categoryEntries = [];
    if (array_is_list($rawCategories)) {
        foreach ($rawCategories as $category) {
            if (!is_array($category)) {
                continue;
            }
            $sectionId = trim((string)($category['sectionId'] ?? $category['section'] ?? $category['id'] ?? ''));
            $quantity = max(0, (int)floor(backend_number($category['quantity'] ?? $category['available'] ?? 0)));
            if ($sectionId !== '' && $quantity > 0) {
                $categoryEntries[$sectionId] = $quantity;
            }
        }
    } else {
        foreach ($rawCategories as $sectionId => $category) {
            if (!is_array($category)) {
                continue;
            }
            $sectionId = trim((string)$sectionId);
            $quantity = max(0, (int)floor(backend_number($category['quantity'] ?? $category['available'] ?? 0)));
            if ($sectionId !== '' && $quantity > 0) {
                $categoryEntries[$sectionId] = $quantity;
            }
        }
    }
    if ($categoryEntries === []) {
        backend_fail(412, 'This event has no ticket inventory configured.', 'failed-precondition');
    }

    $physicalSeats = $firebase->queryDocuments('Seats', ['venueId' => $venueId]);
    $physicalBySection = [];
    foreach ($physicalSeats as $seat) {
        $sectionId = trim((string)($seat['sectionId'] ?? ''));
        $seatLabel = trim((string)($seat['seatLabel'] ?? ''));
        if ($sectionId === '' || $seatLabel === '') {
            continue;
        }
        $physicalBySection[$sectionId] ??= [];
        $physicalBySection[$sectionId][] = $seat;
    }

    $desired = [];
    $timestamp = backend_now();
    foreach ($categoryEntries as $sectionId => $quantity) {
        $sectionId = backend_require_id($sectionId, 'Section ID');
        $sectionSeats = $physicalBySection[$sectionId] ?? [];
        usort($sectionSeats, static fn (array $left, array $right): int =>
            strcmp((string)($left['seatLabel'] ?? ''), (string)($right['seatLabel'] ?? ''))
        );
        if (count($sectionSeats) < $quantity) {
            backend_fail(
                412,
                "The {$sectionId} allocation exceeds the venue's physical seats.",
                'failed-precondition'
            );
        }

        foreach (array_slice($sectionSeats, 0, $quantity) as $sourceSeat) {
            $sourceSeatId = backend_require_id($sourceSeat['id'] ?? null, 'Physical seat ID');
            $eventSeatId = backend_require_id($eventId . '_' . $sourceSeatId, 'Event seat ID');
            $desired[$eventSeatId] = [
                'id' => $eventSeatId,
                'data' => [
                    'eventId' => $eventId,
                    'venueId' => $venueId,
                    'sourceSeatId' => $sourceSeatId,
                    'sectionId' => $sectionId,
                    'seatLabel' => (string)$sourceSeat['seatLabel'],
                    'status' => 'AVAILABLE',
                    'reservedBy' => '',
                    'reservedAt' => '',
                    'reservationExpiry' => '',
                    'reservationEventId' => '',
                    'bookingId' => '',
                    'createdAt' => $timestamp,
                    'updatedAt' => $timestamp,
                ],
            ];
        }
    }

    foreach (array_chunk(array_values($desired), 200) as $seatChunk) {
        $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use ($seatChunk): void {
            $ids = array_map(static fn (array $seat): string => $seat['id'], $seatChunk);
            $existing = $transaction->getMany('EventSeats', $ids);
            foreach ($seatChunk as $seat) {
                if (($existing[$seat['id']] ?? null) === null) {
                    $transaction->create('EventSeats', $seat['id'], $seat['data']);
                }
            }
        });
    }
}

function backend_ensure_purchasable_event_inventory(FirebaseAdminRest $firebase, string $eventId, string $uid): void
{
    backend_assert_active_buyer(backend_get_current_actor($firebase, $uid));
    $event = $firebase->getDocument('Events', $eventId);
    if ($event === null) {
        backend_fail(404, 'Event not found.', 'not-found');
    }
    if (!backend_sales_are_open($event)) {
        backend_fail(412, 'Ticket sales are not open for this event.', 'failed-precondition');
    }
    backend_ensure_event_inventory($firebase, $event);
}

/** @param array<string,mixed> $data @return array<string,mixed> */
function backend_checkout(FirebaseAdminRest $firebase, string $uid, array $data): array
{
    $eventId = backend_require_id($data['eventId'] ?? null, 'Event ID');
    $sectionId = backend_require_id($data['sectionId'] ?? null, 'Section ID');
    $requestedSeatIds = backend_optional_seat_ids($data['seatDocIds'] ?? null);
    $quantityInput = $data['quantity'] ?? $data['qty'] ?? count($requestedSeatIds);
    $quantity = backend_require_positive_integer($quantityInput, 'Quantity');
    if ($requestedSeatIds !== [] && count($requestedSeatIds) !== $quantity) {
        backend_fail(400, 'Seat selection does not match the requested quantity.', 'invalid-argument');
    }

    backend_ensure_purchasable_event_inventory($firebase, $eventId, $uid);

    return $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use (
        $uid,
        $eventId,
        $sectionId,
        $requestedSeatIds,
        $quantity
    ): array {
        $buyer = backend_get_actor($transaction, $uid);
        backend_assert_active_buyer($buyer);
        $walletAddress = backend_require_wallet_address(
            $buyer['walletAddress'] ?? '',
            'Connect a valid wallet before checkout.'
        );
        $event = $transaction->get('Events', $eventId);
        if ($event === null) {
            backend_fail(404, 'Event not found.', 'not-found');
        }
        if (!backend_sales_are_open($event)) {
            backend_fail(412, 'Ticket sales are not open for this event.', 'failed-precondition');
        }
        $category = backend_category_for_section($event['categories'] ?? [], $sectionId);
        if ($category === null
            || !is_string($category['name'] ?? null)
            || !is_finite(backend_number($category['price'] ?? null, NAN))) {
            backend_fail(412, 'This ticket category is not available.', 'failed-precondition');
        }
        $maxPerBuyer = backend_max_tickets_per_buyer($event);
        if ($quantity > $maxPerBuyer) {
            backend_fail(400, "A maximum of {$maxPerBuyer} tickets is allowed.", 'invalid-argument');
        }
        $alreadyHeld = backend_owned_ticket_count($transaction, $eventId, $uid);
        if ($alreadyHeld + $quantity > $maxPerBuyer) {
            $remaining = max(0, $maxPerBuyer - $alreadyHeld);
            backend_fail(412, "You may hold {$remaining} more ticket(s) for this event.", 'failed-precondition');
        }

        if ($requestedSeatIds !== []) {
            $seatMap = $transaction->getMany('EventSeats', $requestedSeatIds);
            $selectedSeats = [];
            foreach ($requestedSeatIds as $seatId) {
                $seat = $seatMap[$seatId] ?? null;
                if ($seat === null
                    || ($seat['eventId'] ?? '') !== $eventId
                    || ($seat['venueId'] ?? '') !== ($event['venueId'] ?? '')
                    || ($seat['sectionId'] ?? '') !== $sectionId
                    || ($seat['status'] ?? '') !== 'RESERVED'
                    || ($seat['reservedBy'] ?? '') !== $uid
                    || (($seat['reservationEventId'] ?? '') !== '' && ($seat['reservationEventId'] ?? '') !== $eventId)
                    || !backend_reservation_is_active($seat)) {
                    backend_fail(412, 'Your reservation has expired. Choose seats again.', 'failed-precondition');
                }
                $selectedSeats[] = $seat;
            }
        } else {
            $selectedSeats = $transaction->query(
                'EventSeats',
                [
                    'eventId' => $eventId,
                    'venueId' => (string)($event['venueId'] ?? ''),
                    'sectionId' => $sectionId,
                    'status' => 'AVAILABLE',
                ],
                [['field' => 'seatLabel', 'direction' => 'ASCENDING']],
                $quantity
            );
            if (count($selectedSeats) !== $quantity) {
                backend_fail(412, 'The requested number of seats is no longer available.', 'failed-precondition');
            }
        }

        $seatLabels = array_map(static fn (array $seat): string => (string)($seat['seatLabel'] ?? ''), $selectedSeats);
        $unitPrice = backend_money(backend_number($category['price'] ?? 0));
        $totalAmount = backend_money($unitPrice * $quantity + BACKEND_SERVICE_CHARGE);
        $bookingId = backend_new_document_id();
        $bookingNumber = backend_booking_number();
        $timestamp = backend_now();
        $ticketIds = [];

        $transaction->create('Bookings', $bookingId, [
            'bookingNumber' => $bookingNumber,
            'buyerUid' => $uid,
            'buyerName' => (string)($buyer['fullName'] ?? ''),
            'organizerUid' => (string)($event['organizerUid'] ?? ''),
            'eventId' => $eventId,
            'eventName' => (string)($event['name'] ?? ''),
            'categoryName' => (string)$category['name'],
            'sectionId' => $sectionId,
            'seats' => $seatLabels,
            'seatDocIds' => array_map(static fn (array $seat): string => (string)$seat['id'], $selectedSeats),
            'quantity' => $quantity,
            'unitPrice' => $unitPrice,
            'serviceCharge' => BACKEND_SERVICE_CHARGE,
            'totalAmount' => $totalAmount,
            'status' => 'CONFIRMED',
            'paymentStatus' => 'SIMULATED_PAID',
            'walletAddress' => $walletAddress,
            'createdAt' => $timestamp,
            'updatedAt' => $timestamp,
        ]);

        foreach ($selectedSeats as $seat) {
            $ticketId = backend_new_document_id();
            $ticketIds[] = $ticketId;
            $seatId = (string)$seat['id'];
            $seatLabel = (string)($seat['seatLabel'] ?? '');
            $transaction->update('EventSeats', $seatId, [
                'status' => 'SOLD',
                'bookingId' => $bookingId,
                'reservedBy' => '',
                'reservedAt' => '',
                'reservationExpiry' => '',
                'reservationEventId' => '',
                'updatedAt' => $timestamp,
            ]);
            $transaction->create('NFTTickets', $ticketId, [
                'bookingId' => $bookingId,
                'organizerUid' => (string)($event['organizerUid'] ?? ''),
                'eventId' => $eventId,
                'eventName' => (string)($event['name'] ?? ''),
                'categoryName' => (string)$category['name'],
                'sectionId' => $sectionId,
                'seatId' => $seatLabel,
                'ownerUid' => $uid,
                'walletAddress' => $walletAddress,
                'tokenId' => '',
                'status' => 'VALID',
                'mintingStatus' => 'PENDING',
                'transactionHash' => '',
                'qrData' => "TKSECURE:{$ticketId}:{$eventId}:{$seatLabel}",
                'usedAt' => '',
                'transferHistory' => [],
                'createdAt' => $timestamp,
                'updatedAt' => $timestamp,
            ]);
            $transaction->create('BlockchainTransactions', backend_new_document_id(), backend_simulated_blockchain_record(
                'MINT',
                $ticketId,
                $walletAddress,
                'booking',
                $bookingId,
                $timestamp
            ));
        }

        $transaction->create('Notifications', backend_new_document_id(), backend_notification(
            $uid,
            "Booking confirmed. Your {$quantity} NFT ticket(s) are being issued.",
            'booking_confirmed',
            'booking',
            $bookingId
        ));
        $transaction->create('AuditLogs', backend_new_document_id(), backend_audit_doc(
            'booking_created',
            'booking',
            $bookingId,
            $buyer,
            ['eventId' => $eventId, 'sectionId' => $sectionId, 'quantity' => $quantity]
        ));

        return [
            'id' => $bookingId,
            'bookingNumber' => $bookingNumber,
            'seatLabels' => $seatLabels,
            'ticketIds' => $ticketIds,
            'totalAmount' => $totalAmount,
            'paymentStatus' => 'SIMULATED_PAID',
        ];
    });
}

/** @param array<string,mixed> $data @return array<string,mixed> */
function backend_reserve_seats(FirebaseAdminRest $firebase, string $uid, array $data): array
{
    $eventId = backend_require_id($data['eventId'] ?? null, 'Event ID');
    $venueId = backend_require_id($data['venueId'] ?? null, 'Venue ID');
    $sectionId = backend_require_id($data['sectionId'] ?? null, 'Section ID');
    $quantity = backend_require_positive_integer($data['quantity'] ?? null, 'Quantity');
    $expiryMinutes = backend_require_positive_integer($data['expiryMinutes'] ?? 10, 'Reservation duration', 30);
    backend_ensure_purchasable_event_inventory($firebase, $eventId, $uid);

    return $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use (
        $uid,
        $eventId,
        $venueId,
        $sectionId,
        $quantity,
        $expiryMinutes
    ): array {
        $buyer = backend_get_actor($transaction, $uid);
        backend_assert_active_buyer($buyer);
        $event = $transaction->get('Events', $eventId);
        if ($event === null) {
            backend_fail(404, 'Event not found.', 'not-found');
        }
        if (($event['venueId'] ?? '') !== $venueId || !backend_sales_are_open($event)) {
            backend_fail(412, 'Seat reservations are not available for this event.', 'failed-precondition');
        }
        if (backend_category_for_section($event['categories'] ?? [], $sectionId) === null) {
            backend_fail(412, 'This ticket category is not available.', 'failed-precondition');
        }
        $maxPerBuyer = backend_max_tickets_per_buyer($event);
        if ($quantity > $maxPerBuyer) {
            backend_fail(400, 'The reservation exceeds the per-buyer ticket limit.', 'invalid-argument');
        }

        $reservations = $transaction->query(
            'EventSeats',
            ['eventId' => $eventId, 'venueId' => $venueId, 'sectionId' => $sectionId, 'status' => 'RESERVED'],
            [['field' => 'seatLabel', 'direction' => 'ASCENDING']],
            100
        );
        $available = $transaction->query(
            'EventSeats',
            ['eventId' => $eventId, 'venueId' => $venueId, 'sectionId' => $sectionId, 'status' => 'AVAILABLE'],
            [['field' => 'seatLabel', 'direction' => 'ASCENDING']],
            $quantity
        );
        $ownedReservations = $transaction->query(
            'EventSeats',
            ['eventId' => $eventId, 'reservedBy' => $uid, 'status' => 'RESERVED'],
            [],
            100
        );

        $activeOwnedReservations = array_values(array_filter(
            $ownedReservations,
            static fn (array $seat): bool => backend_reservation_is_active($seat)
        ));
        $ownedInSection = array_values(array_filter(
            $activeOwnedReservations,
            static fn (array $seat): bool => ($seat['venueId'] ?? '') === $venueId
                && ($seat['sectionId'] ?? '') === $sectionId
        ));
        $otherActiveReservationCount = count($activeOwnedReservations) - count($ownedInSection);
        if ($otherActiveReservationCount + $quantity > $maxPerBuyer) {
            backend_fail(
                412,
                'Your active seat reservations already reach the per-buyer ticket limit for this event.',
                'failed-precondition'
            );
        }

        $expired = array_values(array_filter(
            $reservations,
            static fn (array $seat): bool => !backend_reservation_is_active($seat)
        ));
        $retained = array_slice($ownedInSection, 0, $quantity);
        $candidates = array_merge($available, $expired);
        usort($candidates, static fn (array $left, array $right): int =>
            strcmp((string)($left['seatLabel'] ?? ''), (string)($right['seatLabel'] ?? ''))
        );
        $selected = array_merge($retained, array_slice($candidates, 0, $quantity - count($retained)));
        if (count($selected) !== $quantity) {
            backend_fail(412, 'The requested number of seats is no longer available.', 'failed-precondition');
        }

        $selectedIds = array_flip(array_map(static fn (array $seat): string => (string)$seat['id'], $selected));
        $releaseById = [];
        foreach (array_merge(array_slice($ownedInSection, $quantity), $expired) as $seat) {
            $seatId = (string)$seat['id'];
            if (!isset($selectedIds[$seatId])) {
                $releaseById[$seatId] = $seat;
            }
        }

        $timestamp = backend_now();
        $reservationExpiry = (new DateTimeImmutable('@' . (time() + $expiryMinutes * 60)))
            ->setTimezone(new DateTimeZone('UTC'))
            ->format('Y-m-d\\TH:i:s\\Z');
        foreach ($releaseById as $seat) {
            $transaction->update('EventSeats', (string)$seat['id'], [
                'status' => 'AVAILABLE',
                'reservedBy' => '',
                'reservedAt' => '',
                'reservationExpiry' => '',
                'reservationEventId' => '',
                'updatedAt' => $timestamp,
            ]);
        }
        foreach ($selected as $seat) {
            $transaction->update('EventSeats', (string)$seat['id'], [
                'status' => 'RESERVED',
                'reservedBy' => $uid,
                'reservedAt' => $timestamp,
                'reservationExpiry' => $reservationExpiry,
                'reservationEventId' => $eventId,
                'updatedAt' => $timestamp,
            ]);
        }
        $transaction->create('AuditLogs', backend_new_document_id(), backend_audit_doc(
            'seats_reserved',
            'event',
            $eventId,
            $buyer,
            ['sectionId' => $sectionId, 'quantity' => $quantity]
        ));

        return [
            'seats' => array_map(static fn (array $seat): array => [
                'id' => (string)$seat['id'],
                'seatLabel' => (string)($seat['seatLabel'] ?? ''),
                'sectionId' => (string)($seat['sectionId'] ?? ''),
            ], $selected),
            'reservationExpiry' => $reservationExpiry,
        ];
    });
}

/** @param array<string,mixed> $data @return array<string,mixed> */
function backend_release_seat_reservation(FirebaseAdminRest $firebase, string $uid, array $data): array
{
    $eventId = backend_require_id($data['eventId'] ?? null, 'Event ID');
    $seatIds = backend_optional_seat_ids($data['seatDocIds'] ?? null);

    $released = $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use ($uid, $eventId, $seatIds): int {
        $buyer = backend_get_actor($transaction, $uid);
        backend_assert_active_buyer($buyer);
        $seatMap = $transaction->getMany('EventSeats', $seatIds);
        $timestamp = backend_now();
        $releasedCount = 0;
        foreach ($seatIds as $seatId) {
            $seat = $seatMap[$seatId] ?? null;
            if ($seat !== null
                && ($seat['eventId'] ?? '') === $eventId
                && ($seat['status'] ?? '') === 'RESERVED'
                && ($seat['reservedBy'] ?? '') === $uid) {
                $transaction->update('EventSeats', $seatId, [
                    'status' => 'AVAILABLE',
                    'reservedBy' => '',
                    'reservedAt' => '',
                    'reservationExpiry' => '',
                    'reservationEventId' => '',
                    'updatedAt' => $timestamp,
                ]);
                $releasedCount += 1;
            }
        }
        $transaction->create('AuditLogs', backend_new_document_id(), backend_audit_doc(
            'seat_reservation_released',
            'event',
            $eventId,
            $buyer,
            ['seatCount' => count($seatIds)]
        ));
        return $releasedCount;
    });

    return ['released' => $released];
}

/** @param array<string,mixed> $data @return array<string,mixed> */
function backend_transfer_ticket(FirebaseAdminRest $firebase, string $uid, array $data): array
{
    $ticketId = backend_require_id($data['ticketId'] ?? null, 'Ticket ID');
    $recipientWallet = backend_require_wallet_address(
        $data['recipientWallet'] ?? '',
        'Enter a valid recipient wallet address.'
    );

    return $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use ($uid, $ticketId, $recipientWallet): array {
        $actor = backend_get_actor($transaction, $uid);
        backend_assert_active_buyer($actor);
        $recipients = $transaction->query('Users', ['walletAddress' => $recipientWallet], [], 2);
        if (count($recipients) !== 1) {
            backend_fail(
                412,
                'The recipient must be a registered user with this wallet connected.',
                'failed-precondition'
            );
        }
        $recipient = backend_actor_from_profile((string)$recipients[0]['id'], $recipients[0]);
        if ($recipient['uid'] === $uid) {
            backend_fail(412, 'You already own this ticket.', 'failed-precondition');
        }
        backend_assert_active_buyer($recipient);
        $ticket = $transaction->get('NFTTickets', $ticketId);
        if ($ticket === null) {
            backend_fail(404, 'Ticket not found.', 'not-found');
        }
        if (($ticket['ownerUid'] ?? '') !== $uid || ($ticket['status'] ?? '') !== 'VALID') {
            backend_fail(403, 'This ticket cannot be transferred.', 'permission-denied');
        }
        $eventId = (string)($ticket['eventId'] ?? '');
        $event = $eventId !== '' ? $transaction->get('Events', $eventId) : null;
        if ($event === null || ($event['status'] ?? '') !== 'PUBLISHED' || ($event['transferEnabled'] ?? true) === false) {
            backend_fail(412, 'Transfers are not enabled for this event.', 'failed-precondition');
        }
        if (backend_owned_ticket_count($transaction, $eventId, (string)$recipient['uid']) >= backend_max_tickets_per_buyer($event)) {
            backend_fail(412, 'The recipient already holds the maximum number of tickets for this event.', 'failed-precondition');
        }

        $timestamp = backend_now();
        $history = backend_transfer_history($ticket);
        $history[] = [
            'fromUid' => $uid,
            'fromWallet' => (string)($ticket['walletAddress'] ?? ''),
            'toUid' => (string)$recipient['uid'],
            'toWallet' => $recipientWallet,
            'timestamp' => $timestamp,
        ];
        $transaction->update('NFTTickets', $ticketId, [
            'ownerUid' => (string)$recipient['uid'],
            'walletAddress' => $recipientWallet,
            'status' => 'VALID',
            'transferHistory' => $history,
            'updatedAt' => $timestamp,
        ]);
        $transaction->create('Notifications', backend_new_document_id(), backend_notification(
            (string)$recipient['uid'],
            'A ticket for ' . ((string)($ticket['eventName'] ?? '') ?: 'an event') . ' was transferred to your wallet.',
            'ticket_transferred',
            'ticket',
            $ticketId
        ));
        $transaction->create('AuditLogs', backend_new_document_id(), backend_audit_doc(
            'ticket_transferred',
            'ticket',
            $ticketId,
            $actor,
            ['recipientUid' => (string)$recipient['uid']]
        ));
        $transaction->create('BlockchainTransactions', backend_new_document_id(), backend_simulated_blockchain_record(
            'TRANSFER',
            $ticketId,
            $recipientWallet,
            'ticket',
            $ticketId,
            $timestamp
        ));

        return ['ticketId' => $ticketId, 'recipientUid' => (string)$recipient['uid']];
    });
}

/** @param array<string,mixed> $event @param array<string,mixed>|null $category @return array{0:float,1:float} */
function backend_resale_price_limits(array $event, ?array $category, float $fallbackOriginalPrice = 0.0): array
{
    $originalPrice = backend_money(backend_number($category['price'] ?? $fallbackOriginalPrice));
    $configuredCap = backend_number($event['maxResalePrice'] ?? 0);
    $markup = backend_number($event['maxResaleMarkup'] ?? 0);
    $maxAllowedPrice = $configuredCap > 0
        ? backend_money($configuredCap)
        : backend_money($originalPrice * (1 + $markup / 100));
    return [$originalPrice, $maxAllowedPrice];
}

/** @param array<string,mixed> $data @return array<string,mixed> */
function backend_create_resale_listing(FirebaseAdminRest $firebase, string $uid, array $data): array
{
    $ticketId = backend_require_id($data['ticketId'] ?? null, 'Ticket ID');
    $resalePrice = backend_require_price($data['resalePrice'] ?? null);

    return $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use ($uid, $ticketId, $resalePrice): array {
        $seller = backend_get_actor($transaction, $uid);
        backend_assert_active_buyer($seller);
        $sellerWallet = backend_require_wallet_address(
            $seller['walletAddress'] ?? '',
            'Connect a valid wallet before listing a ticket.'
        );
        $ticket = $transaction->get('NFTTickets', $ticketId);
        if ($ticket === null) {
            backend_fail(404, 'Ticket not found.', 'not-found');
        }
        if (($ticket['ownerUid'] ?? '') !== $uid || ($ticket['status'] ?? '') !== 'VALID') {
            backend_fail(403, 'You do not have an eligible ticket to list.', 'permission-denied');
        }
        $eventId = (string)($ticket['eventId'] ?? '');
        $event = $eventId !== '' ? $transaction->get('Events', $eventId) : null;
        if ($event === null) {
            backend_fail(404, 'Event not found.', 'not-found');
        }
        if (!backend_resale_is_open($event)) {
            backend_fail(412, 'Resale is not open for this event.', 'failed-precondition');
        }
        $category = backend_category_for_section($event['categories'] ?? [], (string)($ticket['sectionId'] ?? ''));
        [$originalPrice, $maxAllowedPrice] = backend_resale_price_limits($event, $category);
        if ($resalePrice > $maxAllowedPrice) {
            backend_fail(
                412,
                'The maximum permitted resale price is RM' . number_format($maxAllowedPrice, 2, '.', '') . '.',
                'failed-precondition'
            );
        }

        $listingId = backend_new_document_id();
        $timestamp = backend_now();
        $transaction->create('ResaleListings', $listingId, [
            'ticketId' => $ticketId,
            'organizerUid' => (string)($event['organizerUid'] ?? ''),
            'eventId' => $eventId,
            'eventName' => (string)($ticket['eventName'] ?? $event['name'] ?? ''),
            'categoryName' => (string)($ticket['categoryName'] ?? $category['name'] ?? ''),
            'sectionId' => (string)($ticket['sectionId'] ?? ''),
            'seatId' => (string)($ticket['seatId'] ?? ''),
            'sellerUid' => $uid,
            'sellerWallet' => $sellerWallet,
            'buyerUid' => '',
            'buyerWallet' => '',
            'originalPrice' => $originalPrice,
            'resalePrice' => $resalePrice,
            'maxAllowedPrice' => $maxAllowedPrice,
            'status' => 'ACTIVE',
            'ruleCompliance' => 'COMPLIANT',
            'riskFlag' => '',
            'createdAt' => $timestamp,
            'updatedAt' => $timestamp,
        ]);
        $transaction->update('NFTTickets', $ticketId, ['status' => 'LISTED_FOR_RESALE', 'updatedAt' => $timestamp]);
        $transaction->create('AuditLogs', backend_new_document_id(), backend_audit_doc(
            'resale_listing_created',
            'resale',
            $listingId,
            $seller,
            ['ticketId' => $ticketId, 'resalePrice' => $resalePrice]
        ));
        return ['id' => $listingId, 'maxAllowedPrice' => $maxAllowedPrice, 'originalPrice' => $originalPrice];
    });
}

/** @param array<string,mixed> $data @return array<string,mixed> */
function backend_cancel_resale_listing(FirebaseAdminRest $firebase, string $uid, array $data): array
{
    $listingId = backend_require_id($data['listingId'] ?? null, 'Listing ID');
    $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use ($uid, $listingId): void {
        $seller = backend_get_actor($transaction, $uid);
        backend_assert_active_buyer($seller);
        $listing = $transaction->get('ResaleListings', $listingId);
        if ($listing === null) {
            backend_fail(404, 'Listing not found.', 'not-found');
        }
        if (($listing['sellerUid'] ?? '') !== $uid || ($listing['status'] ?? '') !== 'ACTIVE') {
            backend_fail(403, 'This listing cannot be cancelled.', 'permission-denied');
        }
        $timestamp = backend_now();
        $ticketId = (string)($listing['ticketId'] ?? '');
        $transaction->update('ResaleListings', $listingId, ['status' => 'CANCELLED', 'updatedAt' => $timestamp]);
        $transaction->update('NFTTickets', $ticketId, ['status' => 'VALID', 'updatedAt' => $timestamp]);
        $transaction->create('AuditLogs', backend_new_document_id(), backend_audit_doc(
            'resale_listing_cancelled',
            'resale',
            $listingId,
            $seller,
            ['ticketId' => $ticketId]
        ));
    });
    return ['listingId' => $listingId, 'status' => 'CANCELLED'];
}

/** @param array<string,mixed> $data @return array<string,mixed> */
function backend_update_resale_price(FirebaseAdminRest $firebase, string $uid, array $data): array
{
    $listingId = backend_require_id($data['listingId'] ?? null, 'Listing ID');
    $resalePrice = backend_require_price($data['resalePrice'] ?? null);
    return $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use ($uid, $listingId, $resalePrice): array {
        $seller = backend_get_actor($transaction, $uid);
        backend_assert_active_buyer($seller);
        $listing = $transaction->get('ResaleListings', $listingId);
        if ($listing === null) {
            backend_fail(404, 'Listing not found.', 'not-found');
        }
        if (($listing['sellerUid'] ?? '') !== $uid || ($listing['status'] ?? '') !== 'ACTIVE') {
            backend_fail(403, 'This listing cannot be repriced.', 'permission-denied');
        }
        $eventId = (string)($listing['eventId'] ?? '');
        $event = $eventId !== '' ? $transaction->get('Events', $eventId) : null;
        if ($event === null || !backend_resale_is_open($event)) {
            backend_fail(412, 'Resale is not available for this event.', 'failed-precondition');
        }
        $category = backend_category_for_section($event['categories'] ?? [], (string)($listing['sectionId'] ?? ''));
        [$originalPrice, $maxAllowedPrice] = backend_resale_price_limits(
            $event,
            $category,
            backend_number($listing['originalPrice'] ?? 0)
        );
        if ($resalePrice > $maxAllowedPrice) {
            backend_fail(
                412,
                'The maximum permitted resale price is RM' . number_format($maxAllowedPrice, 2, '.', '') . '.',
                'failed-precondition'
            );
        }
        $timestamp = backend_now();
        $transaction->update('ResaleListings', $listingId, [
            'originalPrice' => $originalPrice,
            'resalePrice' => $resalePrice,
            'maxAllowedPrice' => $maxAllowedPrice,
            'ruleCompliance' => 'COMPLIANT',
            'updatedAt' => $timestamp,
        ]);
        $transaction->create('AuditLogs', backend_new_document_id(), backend_audit_doc(
            'resale_price_updated',
            'resale',
            $listingId,
            $seller,
            ['resalePrice' => $resalePrice]
        ));
        return ['listingId' => $listingId, 'resalePrice' => $resalePrice, 'maxAllowedPrice' => $maxAllowedPrice];
    });
}

/** @param array<string,mixed> $data @return array<string,mixed> */
function backend_suspend_resale_listing(FirebaseAdminRest $firebase, string $uid, array $data): array
{
    $listingId = backend_require_id($data['listingId'] ?? null, 'Listing ID');
    $reason = is_string($data['reason'] ?? null) ? trim($data['reason']) : '';
    $reason = substr($reason !== '' ? $reason : 'Suspended by an administrator.', 0, 1000);
    return $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use ($uid, $listingId, $reason): array {
        $admin = backend_get_actor($transaction, $uid);
        backend_assert_active_admin($admin);
        $listing = $transaction->get('ResaleListings', $listingId);
        if ($listing === null) {
            backend_fail(404, 'Listing not found.', 'not-found');
        }
        if (($listing['status'] ?? '') !== 'ACTIVE') {
            backend_fail(412, 'Only active listings can be suspended.', 'failed-precondition');
        }
        $timestamp = backend_now();
        $ticketId = (string)($listing['ticketId'] ?? '');
        $transaction->update('ResaleListings', $listingId, [
            'status' => 'SUSPENDED',
            'riskFlag' => $reason,
            'updatedAt' => $timestamp,
        ]);
        $transaction->update('NFTTickets', $ticketId, ['status' => 'VALID', 'updatedAt' => $timestamp]);
        $sellerUid = (string)($listing['sellerUid'] ?? '');
        if ($sellerUid !== '') {
            $transaction->create('Notifications', backend_new_document_id(), backend_notification(
                $sellerUid,
                'Your resale listing was suspended: ' . $reason,
                'resale_suspended',
                'resale',
                $listingId
            ));
        }
        $transaction->create('AuditLogs', backend_new_document_id(), backend_audit_doc(
            'resale_listing_suspended',
            'resale',
            $listingId,
            $admin,
            ['reason' => $reason]
        ));
        return ['listingId' => $listingId, 'status' => 'SUSPENDED'];
    });
}

/** @param array<string,mixed> $data @return array<string,mixed> */
function backend_purchase_resale(FirebaseAdminRest $firebase, string $uid, array $data): array
{
    $listingId = backend_require_id($data['listingId'] ?? null, 'Listing ID');
    return $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use ($uid, $listingId): array {
        $buyer = backend_get_actor($transaction, $uid);
        backend_assert_active_buyer($buyer);
        $buyerWallet = backend_require_wallet_address(
            $buyer['walletAddress'] ?? '',
            'Connect a valid wallet before purchasing.'
        );
        $listing = $transaction->get('ResaleListings', $listingId);
        if ($listing === null) {
            backend_fail(404, 'Listing not found.', 'not-found');
        }
        if (($listing['status'] ?? '') !== 'ACTIVE' || ($listing['sellerUid'] ?? '') === $uid) {
            backend_fail(412, 'This listing is no longer available.', 'failed-precondition');
        }
        $eventId = (string)($listing['eventId'] ?? '');
        $event = $eventId !== '' ? $transaction->get('Events', $eventId) : null;
        if ($event === null || !backend_resale_is_open($event)) {
            backend_fail(412, 'Resale is not available for this event.', 'failed-precondition');
        }
        if (backend_owned_ticket_count($transaction, $eventId, $uid) >= backend_max_tickets_per_buyer($event)) {
            backend_fail(412, 'You already hold the maximum number of tickets for this event.', 'failed-precondition');
        }
        $ticketId = (string)($listing['ticketId'] ?? '');
        $ticket = $ticketId !== '' ? $transaction->get('NFTTickets', $ticketId) : null;
        if ($ticket === null || ($ticket['status'] ?? '') !== 'LISTED_FOR_RESALE') {
            backend_fail(412, 'The ticket is no longer available.', 'failed-precondition');
        }

        $timestamp = backend_now();
        $history = backend_transfer_history($ticket);
        $history[] = [
            'fromUid' => (string)($listing['sellerUid'] ?? ''),
            'fromWallet' => (string)($listing['sellerWallet'] ?? ''),
            'toUid' => $uid,
            'toWallet' => $buyerWallet,
            'timestamp' => $timestamp,
            'type' => 'RESALE',
        ];
        $transaction->update('ResaleListings', $listingId, [
            'status' => 'SOLD',
            'buyerUid' => $uid,
            'buyerWallet' => $buyerWallet,
            'completedAt' => $timestamp,
            'paymentStatus' => 'SIMULATED_PAID',
            'updatedAt' => $timestamp,
        ]);
        $transaction->update('NFTTickets', $ticketId, [
            'ownerUid' => $uid,
            'walletAddress' => $buyerWallet,
            'status' => 'VALID',
            'transferHistory' => $history,
            'updatedAt' => $timestamp,
        ]);
        $sellerUid = (string)($listing['sellerUid'] ?? '');
        if ($sellerUid !== '') {
            $transaction->create('Notifications', backend_new_document_id(), backend_notification(
                $sellerUid,
                'Your resale listing has been sold.',
                'resale_sold',
                'resale',
                $listingId
            ));
        }
        $transaction->create('Notifications', backend_new_document_id(), backend_notification(
            $uid,
            'Your resale ticket purchase is complete.',
            'resale_purchased',
            'resale',
            $listingId
        ));
        $transaction->create('AuditLogs', backend_new_document_id(), backend_audit_doc(
            'resale_completed',
            'resale',
            $listingId,
            $buyer,
            ['ticketId' => $ticketId]
        ));
        $transaction->create('BlockchainTransactions', backend_new_document_id(), backend_simulated_blockchain_record(
            'RESALE',
            $ticketId,
            $buyerWallet,
            'resale',
            $listingId,
            $timestamp
        ));
        return [
            'listingId' => $listingId,
            'ticketId' => $ticketId,
            'totalAmount' => backend_money(backend_number($listing['resalePrice'] ?? 0) + BACKEND_SERVICE_CHARGE),
        ];
    });
}

/** @param array<string,mixed> $data @return array<string,mixed> */
function backend_scan_ticket(FirebaseAdminRest $firebase, string $uid, array $data): array
{
    $ticketId = backend_require_id($data['ticketId'] ?? null, 'Ticket ID');
    $eventId = backend_require_id($data['eventId'] ?? null, 'Event ID');
    return $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use ($uid, $ticketId, $eventId): array {
        $actor = backend_get_actor($transaction, $uid);
        if (!in_array($actor['role'] ?? '', ['admin', 'organizer'], true)
            || ($actor['status'] ?? '') !== 'active'
            || ($actor['emailVerified'] ?? false) !== true) {
            backend_fail(403, 'Only authorized event personnel can scan tickets.', 'permission-denied');
        }
        $event = $transaction->get('Events', $eventId);
        if ($event === null) {
            backend_fail(404, 'Event not found.', 'not-found');
        }
        if (($event['status'] ?? '') !== 'PUBLISHED') {
            backend_fail(412, 'Entry scanning is disabled for this event.', 'failed-precondition');
        }
        if (($actor['role'] ?? '') === 'organizer' && ($event['organizerUid'] ?? '') !== $uid) {
            backend_fail(403, 'You are not authorized for this event.', 'permission-denied');
        }
        $ticket = $transaction->get('NFTTickets', $ticketId);
        if ($ticket === null || ($ticket['eventId'] ?? '') !== $eventId) {
            return ['valid' => false, 'reason' => 'Ticket is not valid for this event.'];
        }
        if (($ticket['status'] ?? '') !== 'VALID') {
            return ['valid' => false, 'reason' => 'Ticket is no longer valid for entry.'];
        }
        $timestamp = backend_now();
        $transaction->update('NFTTickets', $ticketId, ['status' => 'USED', 'usedAt' => $timestamp, 'updatedAt' => $timestamp]);
        $transaction->create('AuditLogs', backend_new_document_id(), backend_audit_doc(
            'ticket_verified',
            'ticket',
            $ticketId,
            $actor,
            ['eventId' => $eventId]
        ));
        $ticket['status'] = 'USED';
        $ticket['usedAt'] = $timestamp;
        return ['valid' => true, 'reason' => 'ENTRY ALLOWED', 'ticket' => $ticket];
    });
}

/** @param array<string,mixed> $claims @return array<string,mixed> */
function backend_sync_email_verification(FirebaseAdminRest $firebase, string $uid, array $claims): array
{
    if (($claims['email_verified'] ?? false) !== true) {
        backend_fail(412, 'Verify your email address before syncing this status.', 'failed-precondition');
    }
    $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use ($uid): void {
        $user = backend_get_actor($transaction, $uid);
        $transaction->update('Users', $uid, ['emailVerified' => true, 'updatedAt' => backend_now()]);
        $transaction->create('AuditLogs', backend_new_document_id(), backend_audit_doc(
            'email_verified',
            'user',
            $uid,
            $user
        ));
    });
    return ['emailVerified' => true];
}

function backend_local_evidence_path(mixed $value): string
{
    if ($value === null || $value === '') {
        return '';
    }
    if (!is_string($value)
        || !preg_match('#^uploads/local/\\d{4}/\\d{2}/[a-f0-9]{40}\\.(?:jpg|png|pdf)$#D', $value)) {
        backend_fail(400, 'The uploaded evidence path is invalid.', 'invalid-argument');
    }
    $projectRoot = realpath(dirname(__DIR__));
    $uploadsRoot = $projectRoot === false ? false : realpath($projectRoot . '/uploads/local');
    $candidate = $projectRoot === false ? false : realpath($projectRoot . '/' . $value);
    $normalizedRoot = $uploadsRoot === false ? '' : rtrim(str_replace('\\', '/', strtolower($uploadsRoot)), '/') . '/';
    $normalizedCandidate = $candidate === false ? '' : str_replace('\\', '/', strtolower($candidate));
    if ($uploadsRoot === false || $candidate === false || !is_file($candidate)
        || !str_starts_with($normalizedCandidate, $normalizedRoot)) {
        backend_fail(412, 'The uploaded evidence file is not available.', 'failed-precondition');
    }
    return $value;
}

/** @param array<string,mixed> $data @return array<string,mixed> */
function backend_create_complaint(FirebaseAdminRest $firebase, string $uid, array $data): array
{
    $category = backend_require_text($data['category'] ?? null, 'Complaint category', 1, 120);
    $description = backend_require_text($data['description'] ?? null, 'Complaint description', 1, 10000);
    $relatedBookingId = is_string($data['relatedBookingId'] ?? null) ? substr(trim($data['relatedBookingId']), 0, 160) : '';
    $relatedTicketId = is_string($data['relatedTicketId'] ?? null) ? substr(trim($data['relatedTicketId']), 0, 160) : '';
    $evidencePath = backend_local_evidence_path($data['evidencePath'] ?? null);
    return $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use (
        $uid,
        $category,
        $description,
        $relatedBookingId,
        $relatedTicketId,
        $evidencePath
    ): array {
        $actor = backend_get_actor($transaction, $uid);
        backend_assert_active_account($actor);
        $complaintId = backend_new_document_id();
        $referenceNumber = 'CMP-' . strtoupper(base_convert((string)time(), 10, 36)) . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        $timestamp = backend_now();
        $transaction->create('Complaints', $complaintId, [
            'referenceNumber' => $referenceNumber,
            'complainantUid' => $uid,
            'complainantName' => (string)($actor['fullName'] ?? ''),
            'complainantRole' => (string)($actor['role'] ?? ''),
            'category' => $category,
            'description' => $description,
            'relatedBookingId' => $relatedBookingId,
            'relatedTicketId' => $relatedTicketId,
            'evidenceUrls' => $evidencePath === '' ? [] : [$evidencePath],
            'status' => 'OPEN',
            'createdAt' => $timestamp,
            'updatedAt' => $timestamp,
        ]);
        $transaction->create('AuditLogs', backend_new_document_id(), backend_audit_doc(
            'complaint_created',
            'complaint',
            $complaintId,
            $actor,
            ['referenceNumber' => $referenceNumber, 'category' => $category]
        ));
        return ['id' => $complaintId, 'referenceNumber' => $referenceNumber];
    });
}

function backend_close_active_event_resales(FirebaseAdminRest $firebase, string $eventId, string $eventStatus): int
{
    $closed = 0;
    for ($round = 0; $round < 50; $round += 1) {
        $count = $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use ($eventId, $eventStatus): int {
            $event = $transaction->get('Events', $eventId);
            if ($event === null || !in_array($event['status'] ?? '', ['SUSPENDED', 'CANCELLED'], true)) {
                return 0;
            }
            $listings = $transaction->query('ResaleListings', ['eventId' => $eventId, 'status' => 'ACTIVE'], [], 100);
            if ($listings === []) {
                return 0;
            }
            $ticketIds = array_values(array_filter(array_map(
                static fn (array $listing): string => trim((string)($listing['ticketId'] ?? '')),
                $listings
            ), static fn (string $ticketId): bool => $ticketId !== ''));
            $tickets = $transaction->getMany('NFTTickets', $ticketIds);
            $timestamp = backend_now();
            $reason = 'Event ' . strtolower($eventStatus) . '; resale is unavailable.';
            $systemActor = ['uid' => 'system', 'email' => '', 'role' => 'system'];
            foreach ($listings as $listing) {
                $listingId = (string)$listing['id'];
                $ticketId = (string)($listing['ticketId'] ?? '');
                $transaction->update('ResaleListings', $listingId, [
                    'status' => 'SUSPENDED',
                    'riskFlag' => $reason,
                    'updatedAt' => $timestamp,
                ]);
                if ($ticketId !== '' && ($tickets[$ticketId] ?? null) !== null) {
                    $transaction->update('NFTTickets', $ticketId, ['status' => 'VALID', 'updatedAt' => $timestamp]);
                }
                $sellerUid = (string)($listing['sellerUid'] ?? '');
                if ($sellerUid !== '') {
                    $transaction->create('Notifications', backend_new_document_id(), backend_notification(
                        $sellerUid,
                        'Your resale listing was closed because the event is ' . strtolower($eventStatus) . '.',
                        'resale_closed_event_inactive',
                        'event',
                        $eventId
                    ));
                }
                $transaction->create('AuditLogs', backend_new_document_id(), backend_audit_doc(
                    'resale_closed_event_inactive',
                    'resale',
                    $listingId,
                    $systemActor,
                    ['eventId' => $eventId, 'eventStatus' => $eventStatus]
                ));
            }
            return count($listings);
        });
        $closed += $count;
        if ($count === 0) {
            break;
        }
    }
    return $closed;
}

/** @param array<string,mixed> $data @return array<string,mixed> */
function backend_moderate_event(FirebaseAdminRest $firebase, string $uid, array $data): array
{
    $eventId = backend_require_id($data['eventId'] ?? null, 'Event ID');
    $status = strtoupper(backend_require_text($data['status'] ?? null, 'Event status', 1, 32));
    $reason = is_string($data['reason'] ?? null) ? substr(trim($data['reason']), 0, 1000) : '';
    $allowedTransitions = [
        'PUBLISHED' => ['PENDING_REVIEW'],
        'REJECTED' => ['PENDING_REVIEW'],
        'SUSPENDED' => ['PUBLISHED'],
        'CANCELLED' => ['PUBLISHED', 'SUSPENDED'],
    ];
    if (!isset($allowedTransitions[$status])) {
        backend_fail(400, 'The event status is invalid.', 'invalid-argument');
    }

    $result = $firebase->transaction(static function (FirebaseFirestoreTransaction $transaction) use (
        $uid,
        $eventId,
        $status,
        $reason,
        $allowedTransitions
    ): array {
        $admin = backend_get_actor($transaction, $uid);
        backend_assert_active_admin($admin);
        $event = $transaction->get('Events', $eventId);
        if ($event === null) {
            backend_fail(404, 'Event not found.', 'not-found');
        }
        $previousStatus = (string)($event['status'] ?? '');
        if (!in_array($previousStatus, $allowedTransitions[$status], true)) {
            backend_fail(412, 'This event cannot make that status transition.', 'failed-precondition');
        }
        $history = $event['statusHistory'] ?? [];
        $history = is_array($history) && array_is_list($history) ? $history : [];
        $timestamp = backend_now();
        $historyEntry = ['from' => $previousStatus, 'to' => $status, 'changedBy' => $uid, 'timestamp' => $timestamp];
        if ($reason !== '') {
            $historyEntry['reason'] = $reason;
        }
        $history[] = $historyEntry;
        $updates = ['status' => $status, 'statusHistory' => $history, 'updatedAt' => $timestamp];
        if ($status === 'REJECTED') {
            $updates['rejectReason'] = $reason;
        }
        $transaction->update('Events', $eventId, $updates);
        $action = [
            'PUBLISHED' => 'event_approved',
            'REJECTED' => 'event_rejected',
            'SUSPENDED' => 'event_suspended',
            'CANCELLED' => 'event_cancelled',
        ][$status];
        $transaction->create('AuditLogs', backend_new_document_id(), backend_audit_doc(
            $action,
            'event',
            $eventId,
            $admin,
            $reason === '' ? [] : ['reason' => $reason]
        ));
        $organizerUid = (string)($event['organizerUid'] ?? '');
        if ($organizerUid !== '') {
            $message = match ($status) {
                'PUBLISHED' => 'Your event "' . (string)($event['name'] ?? '') . '" has been approved and published!',
                'REJECTED' => 'Your event "' . (string)($event['name'] ?? '') . '" was rejected: ' . $reason,
                'SUSPENDED' => 'Your event "' . (string)($event['name'] ?? '') . '" has been suspended: ' . $reason,
                default => 'Your event "' . (string)($event['name'] ?? '') . '" has been cancelled: ' . $reason,
            };
            $transaction->create('Notifications', backend_new_document_id(), backend_notification(
                $organizerUid,
                $message,
                $action,
                'event',
                $eventId
            ));
        }
        return ['eventId' => $eventId, 'status' => $status];
    });

    if (in_array($status, ['SUSPENDED', 'CANCELLED'], true)) {
        $result['closedResales'] = backend_close_active_event_resales($firebase, $eventId, $status);
    }
    return $result;
}

function backend_authorization_header(): string
{
    $value = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if ($value !== '') {
        return $value;
    }
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $headerValue) {
            if (strcasecmp((string)$name, 'Authorization') === 0) {
                return (string)$headerValue;
            }
        }
    }
    return '';
}

if (!backend_is_enabled()) {
    backend_respond(410, [
        'error' => [
            'code' => 'php_backend_disabled',
            'message' => 'The local PHP backend is disabled. Enable it only for a loopback XAMPP demonstration.',
        ],
    ]);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    backend_respond(405, ['error' => ['code' => 'method_not_allowed', 'message' => 'Only POST requests are accepted.']]);
}

try {
    $rawRequest = file_get_contents('php://input');
    if (!is_string($rawRequest) || $rawRequest === '' || strlen($rawRequest) > BACKEND_MAX_REQUEST_BYTES) {
        backend_fail(400, 'The backend request is invalid.', 'invalid-argument');
    }
    $request = json_decode($rawRequest, true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($request)) {
        backend_fail(400, 'The backend request is invalid.', 'invalid-argument');
    }
    $action = backend_require_id($request['action'] ?? null, 'Action');
    $data = $request['data'] ?? [];
    if (!is_array($data)) {
        backend_fail(400, 'The backend request data is invalid.', 'invalid-argument');
    }

    $authorization = backend_authorization_header();
    if (!preg_match('/^Bearer\\s+(.+)$/i', $authorization, $matches)) {
        backend_fail(401, 'Sign in before using this action.', 'unauthenticated');
    }
    $firebase = new FirebaseAdminRest(firebase_backend_config());
    $claims = $firebase->verifyIdToken(trim($matches[1]));
    $uid = is_string($claims['user_id'] ?? null) && $claims['user_id'] !== ''
        ? $claims['user_id']
        : (is_string($claims['sub'] ?? null) ? $claims['sub'] : '');
    if ($uid === '') {
        backend_fail(401, 'The authentication token is invalid.', 'unauthenticated');
    }

    $handlers = [
        'checkout' => static fn (): array => backend_checkout($firebase, $uid, $data),
        'reserveSeats' => static fn (): array => backend_reserve_seats($firebase, $uid, $data),
        'releaseSeatReservation' => static fn (): array => backend_release_seat_reservation($firebase, $uid, $data),
        'transferTicket' => static fn (): array => backend_transfer_ticket($firebase, $uid, $data),
        'createResaleListing' => static fn (): array => backend_create_resale_listing($firebase, $uid, $data),
        'cancelResaleListing' => static fn (): array => backend_cancel_resale_listing($firebase, $uid, $data),
        'updateResalePrice' => static fn (): array => backend_update_resale_price($firebase, $uid, $data),
        'suspendResaleListing' => static fn (): array => backend_suspend_resale_listing($firebase, $uid, $data),
        'purchaseResale' => static fn (): array => backend_purchase_resale($firebase, $uid, $data),
        'scanTicket' => static fn (): array => backend_scan_ticket($firebase, $uid, $data),
        'syncEmailVerification' => static fn (): array => backend_sync_email_verification($firebase, $uid, $claims),
        'createComplaint' => static fn (): array => backend_create_complaint($firebase, $uid, $data),
        'moderateEvent' => static fn (): array => backend_moderate_event($firebase, $uid, $data),
    ];
    if (!isset($handlers[$action])) {
        backend_fail(404, 'This local backend action is not available.', 'not-found');
    }
    backend_respond(200, ['data' => $handlers[$action]()]);
} catch (FirebaseBackendException $error) {
    backend_respond($error->httpStatus, ['error' => ['code' => $error->errorCode, 'message' => $error->getMessage()]]);
} catch (JsonException) {
    backend_respond(400, ['error' => ['code' => 'invalid-argument', 'message' => 'The backend request must be valid JSON.']]);
} catch (Throwable $error) {
    error_log('TickSecure local PHP backend error: ' . $error->getMessage());
    backend_respond(500, ['error' => ['code' => 'internal', 'message' => 'The local backend could not complete this request.']]);
}
