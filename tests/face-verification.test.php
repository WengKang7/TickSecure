<?php
declare(strict_types=1);
// No credentials, cloud, webcam, or real biometric data. Synthetic unit vectors only.
require_once __DIR__ . '/../api/firebase-admin.php';
require_once __DIR__ . '/../api/face-service.php';
final class FaceMemoryDb {
    public function __construct(public array $rows) {}
    public function transaction(callable $work): mixed {
        $tx = new FaceMemoryTx($this->rows);
        $result = $work($tx); $this->rows = $tx->rows; return $result;
    }
}
final class FaceMemoryTx {
    private bool $writing = false;
    public function __construct(public array $rows) {}
    public function get(string $collection, string $id): ?array {
        if ($this->writing) throw new RuntimeException('Read after write');
        return $this->rows["$collection/$id"] ?? null;
    }
    public function query(string $collection, array $filters): array {
        if ($this->writing) throw new RuntimeException('Read after write');
        return array_values(array_filter($this->rows, function ($row, $key) use ($collection, $filters) {
            if (!str_starts_with($key, "$collection/")) return false;
            foreach ($filters as $field => $value) if (($row[$field] ?? null) !== $value) return false;
            return true;
        }, ARRAY_FILTER_USE_BOTH));
    }
    public function create(string $collection, string $id, array $data): void {
        $this->writing = true;
        if (isset($this->rows["$collection/$id"])) throw new RuntimeException('Already exists');
        $this->rows["$collection/$id"] = $data;
    }
    public function update(string $collection, string $id, array $data): void {
        $this->writing = true;
        if (!isset($this->rows["$collection/$id"])) throw new RuntimeException('Missing update');
        $this->rows["$collection/$id"] = array_replace($this->rows["$collection/$id"], $data);
    }
    public function delete(string $collection, string $id): void { $this->writing = true; unset($this->rows["$collection/$id"]); }
}
function ensure(bool $condition, string $label): void { if (!$condition) throw new RuntimeException($label); }
function claims(string $uid = 'buyer'): array { return ['sub' => $uid, 'email' => "$uid@example.test", 'email_verified' => true]; }
function vectors(int $axis = 0): array { $v = array_fill(0, 128, 0.0); $v[$axis] = 1.0; return [$v, $v, $v]; }
function fixture(?callable $infer = null): array {
    $db = new FaceMemoryDb([
        'Users/buyer' => ['role' => 'buyer', 'status' => 'active', 'email' => 'buyer@example.test'],
        'Users/other' => ['role' => 'buyer', 'status' => 'active', 'email' => 'other@example.test'],
        'Users/organizer' => ['role' => 'organizer', 'status' => 'active', 'email' => 'organizer@example.test'],
        'Users/stranger' => ['role' => 'organizer', 'status' => 'active', 'email' => 'stranger@example.test'],
        'Events/event' => ['name' => 'Test concert', 'status' => 'PUBLISHED', 'organizerUid' => 'organizer'],
        'NFTTickets/ticket' => ['ownerUid' => 'buyer', 'eventId' => 'event', 'status' => 'VALID', 'seatId' => 'A1',
            'walletAddress' => '0x' . str_repeat('a', 40), 'blockchainWalletAddress' => '0x' . str_repeat('a', 40),
            'blockchainStatus' => 'CONFIRMED', 'mintingStatus' => 'MINTED', 'chainId' => 11155111,
            'transactionHash' => '0x' . str_repeat('a', 64), 'transferHistory' => []],
        'BlockchainTransactions/mint' => ['ticketId' => 'ticket', 'status' => 'CONFIRMED', 'verificationVersion' => 2]
    ]);
    $key = str_repeat('k', 32);
    return [$db, new TicketFaceService($db, $key, $infer ?? fn () => vectors()), $key];
}
function enrolled(): array {
    [$db, $service, $key] = fixture(); $service->enroll(claims(), 'ticket', ['mock'], true);
    return [$db, $service, $key, $service->status(claims(), 'ticket')['qr']];
}
function denied(callable $work, string $code = 'failed-precondition'): void {
    try { $work(); } catch (FirebaseBackendException $e) { ensure($e->errorCode === $code, "Expected $code; got {$e->errorCode}"); return; }
    throw new RuntimeException('Expected denial');
}
$tests = [];
$tests['mobile staff session rejects buyers and inactive staff'] = function () {
    [$db, $s] = fixture();
    ensure($s->session(claims('organizer'))['role'] === 'organizer', 'organizer session');
    denied(fn () => $s->session(claims('buyer')), 'permission-denied');
    $db->rows['Users/organizer']['status'] = 'inactive';
    denied(fn () => $s->session(claims('organizer')), 'permission-denied');
};
$tests['enroll encrypts samples and returns only status/QR to owner'] = function () {
    [$db, $s] = fixture(); $before = $s->status(claims(), 'ticket'); ensure(!$before['registered'] && !$before['qr'], 'locked before registration');
    $s->enroll(claims(), 'ticket', ['mock'], true); $record = $db->rows['TicketFaces/ticket'];
    ensure(isset($record['ciphertext']) && !isset($record['vectors']) && !str_contains($record['ciphertext'], '[1'), 'encrypted');
    $status = $s->status(claims(), 'ticket'); ensure($status['registered'] && str_starts_with($status['qr'], 'TKSECURE2:'), 'new QR');
    ensure(!str_contains(json_encode($status), 'ciphertext'), 'no biometric data returned');
};
$tests['registration requires consent, owner, active and verified buyer'] = function () {
    [$db, $s] = fixture();
    denied(fn () => $s->enroll(claims(), 'ticket', [], false), 'invalid-argument');
    denied(fn () => $s->enroll(claims('other'), 'ticket', [], true), 'permission-denied');
    denied(fn () => $s->enroll(array_replace(claims(), ['email_verified' => false]), 'ticket', [], true), 'permission-denied');
    $db->rows['Users/buyer']['status'] = 'inactive'; denied(fn () => $s->status(claims(), 'ticket'), 'permission-denied');
    ensure(!isset($db->rows['TicketFaces/ticket']), 'no enrollment');
};
$tests['NFT mint, receipt verification and every ownership operation must confirm'] = function () {
    foreach (['mint', 'wallet', 'pending', 'missing'] as $mode) {
        [$db, $s] = fixture();
        if ($mode === 'mint') $db->rows['NFTTickets/ticket']['mintingStatus'] = 'PENDING';
        if ($mode === 'wallet') $db->rows['NFTTickets/ticket']['blockchainWalletAddress'] = '0x' . str_repeat('b', 40);
        if ($mode === 'pending') $db->rows['BlockchainTransactions/transfer'] = ['ticketId' => 'ticket', 'status' => 'PENDING'];
        if ($mode === 'missing') unset($db->rows['BlockchainTransactions/mint']);
        denied(fn () => $s->enroll(claims(), 'ticket', [], true));
    }
};
$tests['duplicate registration cannot overwrite identity'] = function () { [$db, $s] = enrolled(); $before = $db->rows['TicketFaces/ticket']; denied(fn () => $s->enroll(claims(), 'ticket', [], true)); ensure($before === $db->rows['TicketFaces/ticket'], 'unchanged'); };
$tests['deleting registration revokes saved QR'] = function () { [$db, $s, , $qr] = enrolled(); $s->remove(claims(), 'ticket'); ensure(!isset($db->rows['TicketFaces/ticket']), 'deleted'); denied(fn () => $s->begin(claims('organizer'), $qr)); };
$tests['old QR format, forged signature and wrong event reject'] = function () {
    [$db, $s, , $qr] = enrolled(); denied(fn () => $s->begin(claims('organizer'), 'TKSECURE:ticket:event:A1'), 'invalid-argument');
    denied(fn () => $s->begin(claims('organizer'), substr($qr, 0, -1) . (str_ends_with($qr, '0') ? '1' : '0')));
    denied(fn () => $s->begin(claims('organizer'), str_replace(':event:', ':another:', $qr)));
};
$tests['QR validation alone does not use ticket; only event staff may scan'] = function () {
    [$db, $s, , $qr] = enrolled(); denied(fn () => $s->begin(claims(), $qr), 'permission-denied'); denied(fn () => $s->begin(claims('stranger'), $qr), 'permission-denied');
    $s->begin(claims('organizer'), $qr); ensure($db->rows['NFTTickets/ticket']['status'] === 'VALID', 'QR alone cannot admit');
};
$tests['matching face consumes ticket and erases biometric template'] = function () {
    [$db, $s, , $qr] = enrolled(); $c = $s->begin(claims('organizer'), $qr);
    $db->rows['Users/buyer']['fullName'] = 'Current owner';
    $db->rows['NFTTickets/ticket']['categoryName'] = 'VIP';
    $db->rows['NFTTickets/ticket']['sectionId'] = 'North';
    $result = $s->complete(claims('organizer'), $c['challengeId'], []);
    ensure($result['valid'] && $db->rows['NFTTickets/ticket']['status'] === 'USED', 'admitted');
    ensure($result['attendeeName'] === 'Current owner' && $result['eventName'] === 'Test concert', 'current owner and event receipt');
    ensure($result['categoryName'] === 'VIP' && $result['section'] === 'North' && $result['seat'] === 'A1', 'ticket seat receipt');
    ensure($result['ticketStatus'] === 'USED' && $result['usedAt'] === $db->rows['NFTTickets/ticket']['usedAt'], 'committed entry timestamp');
    ensure(!str_contains(json_encode($result), 'ciphertext') && !str_contains(json_encode($result), 'buyer@example.test'), 'receipt excludes sensitive records');
    ensure(!isset($db->rows['TicketFaces/ticket']), 'face removed after checkin'); denied(fn () => $s->begin(claims('organizer'), $qr));
};
$tests['wrong face consumes challenge but leaves ticket valid'] = function () {
    [$db, $s, $key, $qr] = enrolled(); $c = $s->begin(claims('organizer'), $qr);
    $mismatch = new TicketFaceService($db, $key, fn () => vectors(1));
    ensure(!$mismatch->complete(claims('organizer'), $c['challengeId'], [])['valid'], 'wrong face denied');
    ensure($db->rows['NFTTickets/ticket']['status'] === 'VALID', 'not consumed'); denied(fn () => $s->complete(claims('organizer'), $c['challengeId'], []));
};
$tests['expired and other-scanner challenges cannot check in'] = function () {
    [$db, $s, , $qr] = enrolled(); $c = $s->begin(claims('organizer'), $qr);
    denied(fn () => $s->complete(claims('stranger'), $c['challengeId'], []));
    $db->rows['FaceChallenges/' . $c['challengeId']]['expiresAt'] = time() - 1; denied(fn () => $s->complete(claims('organizer'), $c['challengeId'], []));
};
$tests['two scanner requests have at most one successful check-in'] = function () {
    [$db, $s, , $qr] = enrolled(); $a = $s->begin(claims('organizer'), $qr); $b = $s->begin(claims('organizer'), $qr);
    ensure($s->complete(claims('organizer'), $a['challengeId'], [])['valid'], 'first accepted');
    denied(fn () => $s->complete(claims('organizer'), $b['challengeId'], []));
};
$tests['ownership changes during inference reject completion'] = function () {
    [$db, $s, $key, $qr] = enrolled(); $c = $s->begin(claims('organizer'), $qr);
    $raced = new TicketFaceService($db, $key, function () use ($db) { $db->rows['NFTTickets/ticket']['ownerUid'] = 'other'; unset($db->rows['TicketFaces/ticket']); return vectors(); });
    denied(fn () => $raced->complete(claims('organizer'), $c['challengeId'], [])); ensure($db->rows['NFTTickets/ticket']['status'] === 'VALID', 'new owner not consumed');
};
$tests['registration erased or event suspended during inference rejects'] = function () {
    foreach (['remove', 'suspend', 'used'] as $mode) {
        [$db, $s, $key, $qr] = enrolled(); $c = $s->begin(claims('organizer'), $qr);
        $raced = new TicketFaceService($db, $key, function () use ($db, $mode) {
            if ($mode === 'remove') unset($db->rows['TicketFaces/ticket']);
            if ($mode === 'suspend') $db->rows['Events/event']['status'] = 'SUSPENDED';
            if ($mode === 'used') $db->rows['NFTTickets/ticket']['status'] = 'USED';
            return vectors();
        });
        denied(fn () => $raced->complete(claims('organizer'), $c['challengeId'], []));
    }
};
$tests['transfer away and back cannot revive a prior registration'] = function () {
    [$db, $s, , $qr] = enrolled(); $db->rows['NFTTickets/ticket']['transferHistory'] = [['fromUid' => 'buyer', 'toUid' => 'other'], ['fromUid' => 'other', 'toUid' => 'buyer']];
    ensure(!$s->status(claims(), 'ticket')['registered'], 'revision revoked'); denied(fn () => $s->begin(claims('organizer'), $qr));
};
$tests['ciphertext is authenticated and bound to this ticket'] = function () {
    [$db, , $key] = enrolled(); $r = $db->rows['TicketFaces/ticket'];
    denied(fn () => face_decrypt($r, $key, 'another-ticket:' . $r['revision'] . ':' . $r['version']), 'unavailable');
};
$tests['rate limit blocks excessive attempts'] = function () { [$db, $s, , $qr] = enrolled(); for ($i = 0; $i < 12; $i++) $s->begin(claims('organizer'), $qr); denied(fn () => $s->begin(claims('organizer'), $qr), 'resource-exhausted'); };
$tests['nonfinite malformed and short feature arrays fail closed'] = function () { denied(fn () => face_vectors([[1]])); $v = vectors(); $v[0][0] = INF; denied(fn () => face_vectors($v)); };
$tests['ticket changed during enrollment cannot retain old owners data'] = function () {
    [$db, , $key] = fixture(); $s = new TicketFaceService($db, $key, function () use ($db) { $db->rows['NFTTickets/ticket']['ownerUid'] = 'other'; return vectors(); });
    denied(fn () => $s->enroll(claims(), 'ticket', [], true), 'permission-denied'); ensure(!isset($db->rows['TicketFaces/ticket']), 'no stale template');
};
$tests['machine face test preserves ticket and registration, consumes request, and can retry'] = function () {
    [$db, $s, , $qr] = enrolled();
    $ticket = $db->rows['NFTTickets/ticket']; $face = $db->rows['TicketFaces/ticket'];
    $c = $s->begin(claims('organizer'), $qr);
    $result = $s->complete(claims('organizer'), $c['challengeId'], [], false);
    ensure($result['valid'] && $result['testOnly'], 'real match with explicit test result');
    ensure($db->rows['NFTTickets/ticket'] === $ticket && $db->rows['TicketFaces/ticket'] === $face, 'no ticket or template change');
    denied(fn () => $s->complete(claims('organizer'), $c['challengeId'], [], false));
    $again = $s->begin(claims('organizer'), $qr);
    ensure($s->complete(claims('organizer'), $again['challengeId'], [], false)['valid'], 'repeat test succeeds');
};
$tests['machine test rejects wrong face and changed ownership'] = function () {
    [$db, $s, $key, $qr] = enrolled(); $c = $s->begin(claims('organizer'), $qr);
    $wrong = new TicketFaceService($db, $key, fn () => vectors(1));
    ensure(!$wrong->complete(claims('organizer'), $c['challengeId'], [], false)['valid'], 'wrong face fails test');
    $c = $s->begin(claims('organizer'), $qr);
    $raced = new TicketFaceService($db, $key, function () use ($db) { $db->rows['NFTTickets/ticket']['ownerUid'] = 'other'; return vectors(); });
    denied(fn () => $raced->complete(claims('organizer'), $c['challengeId'], [], false));
};
foreach ($tests as $name => $run) { $run(); echo "PASS $name\n"; }
echo count($tests) . " face security checks passed.\n";
