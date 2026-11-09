<?php
declare(strict_types=1);
require_once __DIR__ . '/face-policy.php';

/** Neither clients nor scanner operators receive templates or match scores. */
final class TicketFaceService {
    public function __construct(private object $db, private string $key, private $recognize) {
        if (strlen($key) !== 32) face_fail('Face encryption is not configured.', 'unavailable', 503);
    }
    public function session(array $claims): array {
        return $this->db->transaction(function ($tx) use ($claims) {
            $user = $tx->get('Users', (string)$claims['sub']);
            face_actor($user, $claims, true);
            return ['uid' => $claims['sub'], 'role' => $user['role'], 'name' => (string)($user['fullName'] ?? '')];
        });
    }
    private function context(object $tx, array $claims, string $id, bool $staff = false): array {
        $uid = (string)$claims['sub'];
        $user = $tx->get('Users', $uid);
        face_actor($user, $claims, $staff);
        $ticket = $tx->get('NFTTickets', $id);
        if (!$ticket) face_fail('Ticket not found.', 'not-found', 404);
        $event = $tx->get('Events', (string)$ticket['eventId']);
        if (!$staff && ($ticket['ownerUid'] ?? '') !== $uid) face_fail('This ticket is no longer in your account.', 'permission-denied', 403);
        if ($staff && ($user['role'] ?? '') === 'organizer' && ($event['organizerUid'] ?? '') !== $uid) face_fail('You cannot check in tickets for this event.', 'permission-denied', 403);
        $record = $tx->get('TicketFaces', $id);
        $operations = $tx->query('BlockchainTransactions', ['ticketId' => $id]);
        $ticket['_faceChainPending'] = count($operations) === 0;
        foreach ($operations as $operation) {
            if (($operation['status'] ?? '') !== 'CONFIRMED' || ($operation['verificationVersion'] ?? 0) !== 2) $ticket['_faceChainPending'] = true;
        }
        return [$ticket, $event, $record];
    }
    private function rate(object $tx, string $uid): void {
        $id = hash('sha256', $uid);
        $previous = $tx->get('FaceRateLimits', $id);
        $current = intdiv(time(), 60);
        $count = ($previous['window'] ?? 0) === $current ? (int)$previous['count'] : 0;
        if ($count >= 12) face_fail('Too many face requests. Wait a minute before trying again.', 'resource-exhausted', 429);
        $row = ['window' => $current, 'count' => $count + 1];
        if ($previous === null) $tx->create('FaceRateLimits', $id, $row);
        else $tx->update('FaceRateLimits', $id, $row);
    }
    private function binding(string $id, array $record): string {
        return $id . ':' . $record['revision'] . ':' . $record['version'];
    }
    public function status(array $claims, string $id): array {
        return $this->db->transaction(function ($tx) use ($claims, $id) {
            [$ticket, $event, $record] = $this->context($tx, $claims, $id);
            $registered = face_registered($record, $ticket);
            $eligible = ($ticket['status'] ?? '') === 'VALID' && ($event['status'] ?? '') === 'PUBLISHED' && face_chain_ready($ticket);
            return ['registered' => $registered, 'eligible' => $eligible,
                'qr' => $eligible && $registered ? face_qr($id, $ticket, $record, $this->key) : null,
                'message' => $registered ? 'Face registered. Show your QR and verify your face at entry.'
                    : ($eligible ? 'Register your face to unlock the entry QR.' : 'A valid ticket and confirmed current-owner NFT are required before registration.')];
        });
    }
    public function enroll(array $claims, string $id, array $frames, bool $consent): array {
        if (!$consent) face_fail('Confirm your consent before face registration.', 'invalid-argument', 400);
        $before = $this->db->transaction(function ($tx) use ($claims, $id) {
            [$ticket, $event, $record] = $this->context($tx, $claims, $id);
            face_entry_eligible($ticket, $event);
            if (face_registered($record, $ticket)) face_fail('This ticket already has a face registration.');
            $this->rate($tx, (string)$claims['sub']);
            return face_revision($ticket);
        });
        $vectors = face_vectors(($this->recognize)($frames));
        $version = bin2hex(random_bytes(16));
        $record = ['ownerUid' => $claims['sub'], 'revision' => $before, 'version' => $version,
            'model' => FACE_MODEL, 'consentVersion' => 'fyp-face-v1', 'registeredAt' => gmdate('c')];
        $record += face_encrypt($vectors, $this->key, $this->binding($id, $record));
        return $this->db->transaction(function ($tx) use ($claims, $id, $record, $before) {
            [$ticket, $event, $existing] = $this->context($tx, $claims, $id);
            face_entry_eligible($ticket, $event);
            if (face_revision($ticket) !== $before || face_registered($existing, $ticket)) face_fail('The ticket changed. Reload before registering.');
            if ($existing === null) $tx->create('TicketFaces', $id, $record);
            else $tx->update('TicketFaces', $id, $record);
            $tx->update('NFTTickets', $id, ['faceRegistrationStatus' => 'REGISTERED']);
            return ['registered' => true];
        });
    }
    public function remove(array $claims, string $id): array {
        return $this->db->transaction(function ($tx) use ($claims, $id) {
            $this->context($tx, $claims, $id);
            $tx->delete('TicketFaces', $id);
            $tx->update('NFTTickets', $id, ['faceRegistrationStatus' => 'REQUIRED']);
            return ['registered' => false];
        });
    }
    public function begin(array $claims, string $qr): array {
        $parsed = face_parse_qr($qr);
        return $this->db->transaction(function ($tx) use ($claims, $parsed) {
            $id = $parsed['ticketId'];
            [$ticket, $event, $record] = $this->context($tx, $claims, $id, true);
            face_entry_eligible($ticket, $event);
            if (!face_registered($record, $ticket) || !hash_equals(face_qr($id, $ticket, $record, $this->key), $parsed['payload'])) {
                face_fail('This QR is invalid or belongs to an earlier registration. Ask the owner to open My Tickets.');
            }
            $this->rate($tx, (string)$claims['sub']);
            $challenge = bin2hex(random_bytes(24));
            $tx->create('FaceChallenges', $challenge, ['scannerUid' => $claims['sub'], 'ticketId' => $id,
                'revision' => face_revision($ticket), 'version' => $record['version'], 'expiresAt' => time() + 90, 'used' => false]);
            return ['challengeId' => $challenge, 'expiresIn' => 90, 'eventName' => $event['name'] ?? 'Event',
                'seat' => $ticket['seatId'] ?? '', 'ticketId' => $id, 'message' => 'QR accepted. Face verification is still required.'];
        });
    }
    public function complete(array $claims, string $challengeId, array $frames, bool $admit = true): array {
        // Claim once BEFORE costly inference. A failed match consumes the challenge too.
        $snapshot = $this->db->transaction(function ($tx) use ($claims, $challengeId) {
            $challenge = $tx->get('FaceChallenges', $challengeId);
            if (!$challenge || ($challenge['scannerUid'] ?? '') !== $claims['sub'] || ($challenge['used'] ?? true)
                || ($challenge['expiresAt'] ?? 0) < time()) face_fail('This check-in request expired or was already used. Scan the QR again.');
            [$ticket, $event, $record] = $this->context($tx, $claims, $challenge['ticketId'], true);
            face_entry_eligible($ticket, $event);
            if (!face_registered($record, $ticket) || $challenge['revision'] !== face_revision($ticket) || $challenge['version'] !== $record['version']) {
                face_fail('Ticket ownership or face registration changed. Scan the current QR again.');
            }
            $tx->update('FaceChallenges', $challengeId, ['used' => true]);
            return [$challenge, $record];
        });
        [$challenge, $record] = $snapshot;
        $reference = face_decrypt($record, $this->key, $this->binding($challenge['ticketId'], $record));
        $capture = face_vectors(($this->recognize)($frames));
        if (!face_matches($reference, $capture)) return ['valid' => false, 'reason' => 'Face does not match the registered ticket owner. Entry denied.'];
        return $this->db->transaction(function ($tx) use ($claims, $challenge, $challengeId, $record, $admit) {
            [$ticket, $event, $current] = $this->context($tx, $claims, $challenge['ticketId'], true);
            face_entry_eligible($ticket, $event);
            if ($challenge['expiresAt'] < time() || !face_registered($current, $ticket) || $current['version'] !== $record['version']
                || $challenge['revision'] !== face_revision($ticket)) face_fail('The ticket or registration changed during verification. Scan again.');
            if (!$admit) {
                $tx->delete('FaceChallenges', $challengeId);
                return ['valid' => true, 'testOnly' => true, 'reason' => 'Face matched. Test successful; the ticket is still unused.', 'ticketId' => $challenge['ticketId']];
            }
            // Use the current owner's profile, including after a transfer/resale.
            $owner = $tx->get('Users', (string)$ticket['ownerUid']);
            $timestamp = gmdate('c');
            $tx->update('NFTTickets', $challenge['ticketId'], ['status' => 'USED', 'usedAt' => $timestamp,
                'updatedAt' => $timestamp, 'faceRegistrationStatus' => 'CONSUMED']);
            // Delete the biometric template after successful entry: it has served its purpose.
            $tx->delete('TicketFaces', $challenge['ticketId']);
            $tx->delete('FaceChallenges', $challengeId);
            $tx->create('AuditLogs', bin2hex(random_bytes(16)), ['action' => 'ticket_face_verified', 'entityType' => 'ticket',
                'entityId' => $challenge['ticketId'], 'actorUid' => $claims['sub'], 'eventId' => $ticket['eventId'],
                'timestamp' => $timestamp, 'result' => 'SUCCESS']);
            return ['valid' => true, 'reason' => 'Identity verified. Entry allowed.', 'ticketId' => $challenge['ticketId'], 'usedAt' => $timestamp,
                'eventName' => (string)($event['name'] ?? ''), 'attendeeName' => (string)($owner['fullName'] ?? ''),
                'categoryName' => (string)($ticket['categoryName'] ?? ''), 'section' => (string)($ticket['sectionId'] ?? ''),
                'seat' => (string)($ticket['seatId'] ?? ''), 'ticketStatus' => 'USED'];
        });
    }
}
