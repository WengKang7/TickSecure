<?php
declare(strict_types=1);

const FACE_MODEL = 'sface-2021dec-yunet-2023mar-v1';
const FACE_THRESHOLD = 0.5; // Conservative demo starting point; not a certified FAR.

function face_fail(string $message, string $code = 'failed-precondition', int $status = 412): never {
    throw new FirebaseBackendException($status, $message, $code);
}
function face_id(mixed $value): string {
    if (!is_string($value) || !preg_match('/^[A-Za-z0-9_-]{1,160}$/D', $value)) face_fail('Invalid ticket or request reference.', 'invalid-argument', 400);
    return $value;
}
function face_actor(?array $user, array $claims, bool $staff = false): void {
    $roles = $staff ? ['admin', 'organizer'] : ['buyer'];
    if (!$user || ($user['status'] ?? '') !== 'active' || !in_array($user['role'] ?? '', $roles, true)
        || (($user['role'] ?? '') !== 'admin' && (($claims['email_verified'] ?? false) !== true || ($claims['email'] ?? '') !== ($user['email'] ?? '')))) {
        face_fail('This account cannot perform this action.', 'permission-denied', 403);
    }
}
function face_revision(array $ticket): string {
    // Includes the handover history so a transfer away and back cannot revive an old enrollment.
    return hash('sha256', json_encode([$ticket['ownerUid'] ?? '', strtolower($ticket['walletAddress'] ?? ''),
        $ticket['transferHistory'] ?? []], JSON_THROW_ON_ERROR));
}
function face_chain_ready(array $ticket): bool {
    return empty($ticket['_faceChainPending']) && ($ticket['mintingStatus'] ?? '') === 'MINTED' && ($ticket['blockchainStatus'] ?? '') === 'CONFIRMED'
        && ($ticket['chainId'] ?? 0) === 11155111
        && preg_match('/^0x[0-9a-fA-F]{64}$/D', $ticket['transactionHash'] ?? '') === 1
        && preg_match('/^0x[0-9a-fA-F]{40}$/D', $ticket['walletAddress'] ?? '') === 1
        && strtolower($ticket['walletAddress']) === strtolower($ticket['blockchainWalletAddress'] ?? '');
}
function face_entry_eligible(?array $ticket, ?array $event): void {
    if (!$ticket || !$event || ($event['status'] ?? '') !== 'PUBLISHED' || ($ticket['status'] ?? '') !== 'VALID') {
        face_fail('This ticket is used, unavailable, or not valid for entry.');
    }
    if (!face_chain_ready($ticket)) face_fail('Complete the current owner’s NFT transaction before face registration or entry.');
}
function face_registered(?array $record, array $ticket): bool {
    return $record !== null && ($record['ownerUid'] ?? '') === ($ticket['ownerUid'] ?? '')
        && ($record['revision'] ?? '') === face_revision($ticket) && ($record['model'] ?? '') === FACE_MODEL
        && !empty($record['ciphertext']) && !empty($record['version']);
}
function face_vectors(mixed $vectors): array {
    if (!is_array($vectors) || count($vectors) !== 3) face_fail('Face data is invalid. Capture again.');
    foreach ($vectors as $vector) {
        if (!is_array($vector) || count($vector) !== 128) face_fail('Face data is invalid. Capture again.');
        $norm = 0;
        foreach ($vector as $value) {
            if ((!is_float($value) && !is_int($value)) || !is_finite((float)$value)) face_fail('Face data is invalid.');
            $norm += $value * $value;
        }
        if (abs($norm - 1) > 0.02) face_fail('Face data is invalid.');
    }
    return $vectors;
}
function face_matches(array $reference, array $capture): bool {
    $reference = face_vectors($reference); $capture = face_vectors($capture);
    // All three fresh captures must match at least one enrollment sample.
    foreach ($capture as $sample) {
        $best = -1.0;
        foreach ($reference as $saved) {
            $score = 0.0;
            foreach ($sample as $i => $value) $score += $value * $saved[$i];
            $best = max($best, $score);
        }
        if ($best < FACE_THRESHOLD) return false;
    }
    return true;
}
function face_encrypt(array $vectors, string $key, string $binding): array {
    $iv = random_bytes(12); $tag = '';
    $ciphertext = openssl_encrypt(json_encode(face_vectors($vectors), JSON_THROW_ON_ERROR), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, $binding);
    if ($ciphertext === false) face_fail('Face data could not be secured.', 'unavailable', 503);
    return ['ciphertext' => base64_encode($ciphertext), 'iv' => base64_encode($iv), 'tag' => base64_encode($tag)];
}
function face_decrypt(array $record, string $key, string $binding): array {
    $raw = openssl_decrypt(base64_decode($record['ciphertext'], true), 'aes-256-gcm', $key, OPENSSL_RAW_DATA,
        base64_decode($record['iv'], true), base64_decode($record['tag'], true), $binding);
    if ($raw === false) face_fail('Face registration could not be verified. Contact the organizer.', 'unavailable', 503);
    return face_vectors(json_decode($raw, true, 16, JSON_THROW_ON_ERROR));
}
function face_qr(string $id, array $ticket, array $record, string $key): string {
    $prefix = 'TKSECURE2:' . $id . ':' . $ticket['eventId'] . ':' . $record['version'];
    $signature = hash_hmac('sha256', $prefix . ':' . face_revision($ticket), $key);
    return $prefix . ':' . $signature;
}
function face_parse_qr(mixed $qr): array {
    if (!is_string($qr) || strlen($qr) > 512) face_fail('Invalid ticket QR code.', 'invalid-argument', 400);
    $parts = explode(':', $qr);
    if (count($parts) !== 5 || $parts[0] !== 'TKSECURE2' || !preg_match('/^[a-f0-9]{64}$/D', $parts[4])) {
        face_fail('Use the new QR from My Tickets after completing face registration. Old QR codes cannot check in.', 'invalid-argument', 400);
    }
    face_id($parts[1]); face_id($parts[2]); face_id($parts[3]);
    return ['ticketId' => $parts[1], 'eventId' => $parts[2], 'version' => $parts[3], 'payload' => $qr];
}
