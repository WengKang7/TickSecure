<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/firebase-admin.php';
function check(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
final class EmailTestDb {
    public array $records = [];
    public array $account = ['email' => 'buyer@gmail.com', 'emailVerified' => true, 'displayName' => 'Buyer <One>'];
    public int $lookupCalls = 0;
    public function transaction(callable $callback): mixed {
        $snapshot = $this->records;
        try { return $callback(new EmailTestTx($this)); } catch (Throwable $error) { $this->records = $snapshot; throw $error; }
    }
    public function getAuthUserByUid(string $uid): array { $this->lookupCalls++; return $this->account; }
    public function queryDocuments(string $collection, array $filters, array $order = [], ?int $limit = null): array {
        $out = [];
        foreach ($this->records as $key => $value) if (str_starts_with($key, $collection . '/') && ($value['pending'] ?? null) === $filters['pending']) {
            $out[] = ['id' => substr($key, strlen($collection) + 1)] + $value;
        }
        return array_slice($out, 0, $limit);
    }
}
final class EmailTestTx {
    public function __construct(private EmailTestDb $db) {}
    public function get(string $collection, string $id): ?array { return $this->db->records[$collection . '/' . $id] ?? null; }
    public function update(string $collection, string $id, array $fields): void {
        $key = $collection . '/' . $id; $this->db->records[$key] = array_replace($this->db->records[$key], $fields);
    }
}
$config = ['apiKey' => 'test-key-not-a-real-credential', 'fromEmail' => 'sender@example.com', 'appUrl' => 'https://ticksecure.onrender.com'];
$now = time();
function database(int $now): EmailTestDb {
    $db = new EmailTestDb();
    $db->records['Users/buyer'] = ['role' => 'buyer', 'email' => 'forged-destination@example.com'];
    $db->records['EmailOutbox/n1'] = notification_email_job('n1', ['recipientUid' => 'buyer', 'message' => '<script>test</script> & update',
        'type' => 'booking_confirmed', 'createdAt' => gmdate('c', $now), 'faceImage' => 'must-not-copy', 'qr' => 'must-not-copy']);
    return $db;
}
$tests = [];
$tests['private configuration is optional and rejects web-root secret files'] = static function (): void {
    putenv('NOTIFICATION_EMAIL_ENABLED=0');check(notification_email_config() === null, 'disabled must not configure');
    putenv('NOTIFICATION_EMAIL_ENABLED');
    $path = __DIR__ . '/../tmp/email-config-test-' . bin2hex(random_bytes(4)) . '.env';
    file_put_contents($path, "BREVO_API_KEY=not-a-real-key-123456\nNOTIFICATION_FROM_EMAIL=sender@example.com\n");
    try { putenv('TICKSECURE_NOTIFICATION_EMAIL_ENV=' . $path);check(notification_email_config() === null, 'web-root secret refused'); }
    finally { @unlink($path);putenv('TICKSECURE_NOTIFICATION_EMAIL_ENV'); }
    $private = tempnam(sys_get_temp_dir(), 'ticksecure-mail-config-');
    try {
        file_put_contents($private, "BREVO_API_KEY=not-a-real-key-123456\nNOTIFICATION_FROM_EMAIL=sender@example.com\n");
        putenv('TICKSECURE_NOTIFICATION_EMAIL_ENV=' . $private);
        $config = notification_email_config();
        check($config !== null && $config['fromEmail'] === 'sender@example.com', 'readable private configuration accepted');
    } finally { @unlink($private);putenv('TICKSECURE_NOTIFICATION_EMAIL_ENV'); }
};
$tests['notification and outbox are staged together; disabled mail preserves existing writes'] = static function () use ($config): void {
    putenv('BREVO_API_KEY=' . $config['apiKey']);putenv('NOTIFICATION_FROM_EMAIL=' . $config['fromEmail']);
    $reflection = new ReflectionClass(FirebaseAdminRest::class);$firebase = $reflection->newInstanceWithoutConstructor();
    $reflection->getProperty('projectId')->setValue($firebase, 'test-project');
    $tx = new FirebaseFirestoreTransaction($firebase, 'not-committed');
    $tx->create('Notifications', 'n1', ['recipientUid' => 'buyer', 'message' => 'Booking confirmed', 'type' => 'booking_confirmed']);
    check(count($tx->writes()) === 2 && $tx->hasQueuedEmails(), 'two atomic staged writes');
    check(str_ends_with($tx->writes()[1]['update']['name'], '/EmailOutbox/n1'), 'same deterministic id');
    putenv('NOTIFICATION_EMAIL_ENABLED=0');$disabled = new FirebaseFirestoreTransaction($firebase, 'not-committed');
    $disabled->create('Notifications', 'n2', ['recipientUid' => 'buyer', 'message' => 'Saved']);
    check(count($disabled->writes()) === 1 && !$disabled->hasQueuedEmails(), 'mail off leaves normal notification');
    putenv('NOTIFICATION_EMAIL_ENABLED');putenv('BREVO_API_KEY');putenv('NOTIFICATION_FROM_EMAIL');
};
$tests['mail resolves verified Firebase Auth address and escapes text; duplicate processing cannot resend'] = static function () use ($config, $now): void {
    $db = database($now);$calls = 0;$sent = [];
    $delivery = new NotificationEmailDelivery($db, $config, static function ($c, $payload) use (&$calls, &$sent): array { $calls++;$sent = $payload;return ['status' => 201, 'id' => 'provider-1']; }, static fn () => $now);
    check($delivery->process('n1') === 'ACCEPTED', 'accepted outcome');$delivery->process('n1');
    check($calls === 1, 'one send only');check($sent['to'][0]['email'] === 'buyer@gmail.com', 'Auth destination wins');
    check(str_contains($sent['htmlContent'], '&lt;script&gt;test&lt;/script&gt;') && !str_contains($sent['htmlContent'], '<script>'), 'HTML escaped');
    check(!isset($db->records['EmailOutbox/n1']['notification']['faceImage']) && !isset($db->records['EmailOutbox/n1']['notification']['qr']), 'sensitive unrelated fields omitted');
};
$tests['overlapping workers cannot both deliver one notification'] = static function () use ($config, $now): void {
    $db = database($now);$calls = 0;$secondCalls = 0;
    $second = new NotificationEmailDelivery($db, $config, static function () use (&$secondCalls): array { $secondCalls++;return ['status' => 201, 'id' => 'second']; }, static fn () => $now);
    $first = new NotificationEmailDelivery($db, $config, static function () use (&$calls, $second): array { $calls++;$second->process('n1');return ['status' => 201, 'id' => 'first']; }, static fn () => $now);
    $first->process('n1');check($calls === 1 && $secondCalls === 0, 'lease prevents overlapping send');
};
$tests['unverified accounts and expired offers are skipped without sending'] = static function () use ($config, $now): void {
    $calls = 0;$send = static function () use (&$calls): array { $calls++;return []; };
    $db = database($now);$db->account['emailVerified'] = false;
    check((new NotificationEmailDelivery($db, $config, $send, static fn () => $now))->process('n1') === 'SKIPPED', 'verified address required');
    $db = database($now);$db->records['EmailOutbox/n1']['notification']['emailExpiresAt'] = $now - 1;
    (new NotificationEmailDelivery($db, $config, $send, static fn () => $now))->process('n1');
    check($db->records['EmailOutbox/n1']['status'] === 'EXPIRED' && $calls === 0, 'expired offer never sent');
    $db = database($now);
    $db->records['EmailOutbox/n1']['notification'] += ['emailExpiresAt' => $now + 300, 'relatedEntityType' => 'seat_waitlist', 'relatedEntityId' => 'seat'];
    (new NotificationEmailDelivery($db, $config, $send, static fn () => $now))->process('n1');
    check($db->records['EmailOutbox/n1']['status'] === 'SKIPPED' && $calls === 0, 'claimed or declined offer never sent as current');
    $db = database($now);
    $db->records['EmailOutbox/n1']['notification'] = array_replace($db->records['EmailOutbox/n1']['notification'], ['type' => 'seat_waitlist', 'eventId' => 'event', 'sectionId' => 'VIP', 'emailExpiresAt' => $now + 300, 'relatedEntityType' => 'seat_waitlist', 'relatedEntityId' => 'seat']);
    $db->records['SeatWaitlists/seat'] = ['offerUid' => 'buyer', 'offerExpiry' => gmdate('c', $now + 300)];
    $sent = [];
    $deliver = new NotificationEmailDelivery($db, $config, static function ($c, $payload) use (&$sent): array { $sent = $payload; return ['status' => 201, 'id' => 'offer-email']; }, static fn () => $now);
    check($deliver->process('n1') === 'ACCEPTED', 'current offer is emailed');
    check($sent['subject'] === '[TickSecure] Your queued seat is available', 'offer-specific subject');
    check(str_contains($sent['textContent'], '/buyer/seat-picker.php?eventId=event&sectionId=VIP&qty=1&waitlist=1'), 'offer email opens correct event and category');

};
$tests['only explicit rate rejection retries; uncertain sends never auto-resend'] = static function () use ($config, &$now): void {
    $db = database($now);$calls = 0;
    $delivery = new NotificationEmailDelivery($db, $config, static function () use (&$calls): array { $calls++;return ['status' => 429]; }, static function () use (&$now): int { return $now; });
    check($delivery->process('n1') === 'PENDING', 'rate rejection schedules retry');$delivery->process('n1');check($calls === 1, 'backoff honored');
    $now += 61;$delivery->process('n1');$now += 61;check($delivery->process('n1') === 'FAILED' && $calls === 3, 'retries bounded');
    foreach ([0, 500] as $status) {
        $db = database($now);$calls = 0;
        $delivery = new NotificationEmailDelivery($db, $config, static function () use (&$calls, $status): array { $calls++;return ['status' => $status]; }, static fn () => $now);
        check($delivery->process('n1') === 'UNKNOWN', 'ambiguous send recorded');$delivery->process('n1');check($calls === 1, 'no ambiguous retry');
    }
};
$tests['interrupted delivery is quarantined and waiting-list links use safe parameters'] = static function () use ($config, $now): void {
    $db = database($now);$db->records['EmailOutbox/n1']['status'] = 'SENDING';$db->records['EmailOutbox/n1']['leaseUntil'] = $now - 1;
    (new NotificationEmailDelivery($db, $config, static fn () => throw new RuntimeException('must not send'), static fn () => $now))->process('n1');
    check($db->records['EmailOutbox/n1']['status'] === 'UNKNOWN', 'interrupted lease is not resent');
    $job = notification_email_job('n2', ['recipientUid' => 'buyer', 'message' => 'Offer', 'relatedEntityType' => 'seat_waitlist', 'eventId' => 'event', 'sectionId' => 'VIP&injected=1']);
    $payload = notification_email_payload($config, $job, $db->account, 'buyer');
    check(str_contains($payload['textContent'], 'sectionId=VIP%26injected%3D1'), 'link values encoded');
    check(notification_email_payload($config, $job + [], $db->account, 'organizer')['sender']['email'] === $config['fromEmail'], 'fixed configured sender');
};
foreach ($tests as $name => $run) { $run();echo "PASS: {$name}\n"; }
echo count($tests) . " email checks passed. No real emails sent.\n";
