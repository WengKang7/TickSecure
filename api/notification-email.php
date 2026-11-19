<?php
declare(strict_types=1);

/** Transactional email copies. Configuration and delivery records are server-only. */
function notification_email_config(): ?array
{
    if (getenv('NOTIFICATION_EMAIL_ENABLED') === '0') return null;
    $path = realpath(getenv('TICKSECURE_NOTIFICATION_EMAIL_ENV') ?: (getenv('TICKSECURE_HOSTED_CHECKOUT') === '1'
        ? '/etc/secrets/notification-email.env' : dirname(__DIR__, 3) . '/private/notification-email.env'));
    $root = rtrim(str_replace('\\', '/', strtolower((string)realpath(dirname(__DIR__)))), '/') . '/';
    $values = [];
    if ($path && !str_starts_with(str_replace('\\', '/', strtolower($path)), $root) && is_file($path)) {
        // Windows ACL metadata can make is_readable() false even when opening
        // the private file succeeds. The actual read remains authoritative.
        $raw = @file_get_contents($path);
        if (is_string($raw) && strlen($raw) <= 8192) $values = @parse_ini_string($raw, false, INI_SCANNER_RAW) ?: [];
    }
    $value = static fn (string $key, string $default = ''): string => trim((string)(getenv($key) ?: ($values[$key] ?? $default)));
    $key = $value('BREVO_API_KEY');
    $from = $value('NOTIFICATION_FROM_EMAIL');
    $url = rtrim($value('NOTIFICATION_APP_URL', 'https://ticksecure.onrender.com'), '/');
    $parts = parse_url($url);
    if ($value('NOTIFICATION_EMAIL_ENABLED', '1') === '0' || strlen($key) < 15 || strlen($key) > 1024
        || preg_match('/[\r\n]/', $key . $from) || !filter_var($from, FILTER_VALIDATE_EMAIL)
        || !$parts || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])
        || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) return null;
    return ['apiKey' => $key, 'fromEmail' => $from, 'fromName' => 'TickSecure', 'appUrl' => $url];
}

function notification_email_job(string $notificationId, array $notice): ?array
{
    $uid = (string)($notice['recipientUid'] ?? '');
    $message = trim((string)($notice['message'] ?? ''));
    if (!preg_match('/^[A-Za-z0-9_-]{1,160}$/D', $uid) || $message === '') return null;
    $allowed = ['recipientUid', 'message', 'type', 'relatedEntityType', 'relatedEntityId', 'eventId', 'sectionId', 'createdAt', 'emailExpiresAt'];
    return ['notificationId' => $notificationId, 'notification' => array_intersect_key($notice, array_flip($allowed)),
        'recipientUid' => $uid, 'status' => 'PENDING', 'pending' => true, 'attempts' => 0,
        'createdAtEpoch' => time(), 'nextAttemptAt' => 0, 'leaseUntil' => 0];
}

function notification_email_wake_file(): string
{
    return sys_get_temp_dir() . '/ticksecure-email-' . hash('sha256', __DIR__ . '|' . (getenv('FIREBASE_PROJECT_ID') ?: 'tick-c12a1')) . '.wake';
}

/** Only called after the database commit. A failed signal never changes the committed result. */
function notification_email_wake(): void
{
    @file_put_contents(notification_email_wake_file(), bin2hex(random_bytes(12)), LOCK_EX);
}

/** Stable UUIDv5 in Brevo's documented idempotency-key format. */
function notification_email_idempotency_key(string $notificationId): string
{
    $hash = sha1(hex2bin('6ba7b8119dad11d180b400c04fd430c8') . 'ticksecure-notification|' . $notificationId);
    return substr($hash,0,8) . '-' . substr($hash,8,4) . '-5' . substr($hash,13,3) . '-'
        . dechex((hexdec($hash[16]) & 3) | 8) . substr($hash,17,3) . '-' . substr($hash,20,12);
}

function notification_email_payload(array $config, array $job, array $account, string $role): array
{
    $notice = $job['notification'];
    $type = (string)($notice['type'] ?? 'info');
    $titles = ['booking_confirmed' => 'Booking confirmed', 'ticket_transferred' => 'Ticket transfer update',
        'resale_sold' => 'Your resale ticket was sold', 'resale_purchased' => 'Resale purchase update',
        'resale_suspended' => 'Resale listing update', 'organizer_approved' => 'Organizer application approved',
        'organizer_rejected' => 'Organizer application update', 'account_suspended' => 'Account update',
        'event_content_review' => 'Event review update', 'event_approved' => 'Event approved',
        'event_rejected' => 'Event review update', 'event_suspended' => 'Event update',
        'event_cancelled' => 'Event cancelled', 'complaint_update' => 'Complaint update', 'seat_waitlist' => 'Seat waiting-list update'];
    $title = $type === 'seat_waitlist' && !empty($notice['emailExpiresAt'])
        ? 'Your queued seat is available' : ($titles[$type] ?? 'Account notification');
    $folder = $role === 'organizer' ? 'organizer' : ($role === 'admin' ? 'admin' : 'buyer');
    $route = $folder === 'admin' ? '/admin/dashboard.php' : '/' . $folder . '/notifications.php';
    if (($notice['relatedEntityType'] ?? '') === 'seat_waitlist' && !empty($notice['eventId']) && !empty($notice['sectionId'])) {
        $route = '/buyer/seat-picker.php?' . http_build_query(['eventId' => $notice['eventId'], 'sectionId' => $notice['sectionId'], 'qty' => 1, 'waitlist' => 1]);
    }
    $url = $config['appUrl'] . $route;
    $clean = static fn (string $text): string => preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $text) ?? '';
    $message = $clean((string)$notice['message']);
    $escape = static fn (string $text): string => htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $name = trim($clean((string)($account['displayName'] ?? '')));
    $greeting = $name === '' ? 'Hello,' : 'Hello ' . $name . ',';
    $html = '<!doctype html><html><body style="margin:0;background:#f5f5f7;color:#151515;font-family:Arial,sans-serif">'
        . '<table role="presentation" style="width:100%;padding:28px 12px"><tr><td align="center">'
        . '<table role="presentation" style="width:100%;max-width:580px;background:#fff;border:1px solid #e5e5e5;border-radius:14px;padding:30px">'
        . '<tr><td><p style="color:#7028f4;font-weight:700;font-size:22px;margin:0 0 28px">ticksecure</p>'
        . '<h1 style="font-size:24px;line-height:1.3">' . $escape($title) . '</h1><p>' . $escape($greeting) . '</p>'
        . '<p style="font-size:16px;line-height:1.6;white-space:pre-line">' . $escape($message) . '</p>'
        . '<p style="margin:28px 0"><a href="' . $escape($url) . '" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 22px;border-radius:9px">View update</a></p>'
        . '<p style="font-size:13px;color:#687080;line-height:1.5">Sign in to TickSecure to see the latest status. This email does not complete payment, NFT setup or a seat reservation.</p>'
        . '</td></tr></table></td></tr></table></body></html>';
    return ['sender' => ['name' => 'TickSecure', 'email' => $config['fromEmail']],
        'to' => [['email' => $account['email']]], 'subject' => '[TickSecure] ' . $title,
        'htmlContent' => $html, 'textContent' => $title . "\n\n" . $greeting . "\n\n" . $message . "\n\nView update: " . $url
            . "\n\nSign in to see the latest status. This email does not complete payment, NFT setup or a seat reservation.",
        'headers' => ['idempotencyKey' => notification_email_idempotency_key((string)$job['notificationId'])],
        'tags' => ['ticksecure-notification']];
}

/** Classify provider failures without retaining raw responses or private values. */
function notification_email_failure_details(int $status, mixed $response): array
{
    $code = is_array($response) ? ($response['code'] ?? '') : '';
    $allowed = ['unauthorized','permission_denied','access_denied','forbidden','invalid_parameter',
        'missing_parameter','out_of_range','not_enough_credits','duplicate_parameter','method_not_allowed','bad_request'];
    $code = in_array($code, $allowed, true) ? $code : 'unclassified';
    $message = is_array($response) && is_string($response['message'] ?? null) ? strtolower($response['message']) : '';
    $reason = 'unclassified';
    if (str_contains($message, 'idempotency') && (str_contains($message, 'limit') || str_contains($message, 'uuid'))) $reason = 'invalid_idempotency_key';
    elseif (str_contains($message, 'ip') && (str_contains($message, 'unrecogn') || str_contains($message, 'unauthor'))) $reason = 'ip_not_authorized';
    elseif (str_contains($message, 'permission') || str_contains($message, 'access denied')) $reason = 'api_permission_denied';
    elseif (str_contains($message, 'not activated') || str_contains($message, 'not yet activated')) $reason = 'sending_not_activated';
    elseif (str_contains($message, 'key not found') || str_contains($message, 'invalid api key')) $reason = 'invalid_api_key';
    elseif (str_contains($message, 'sender') && (str_contains($message, 'valid') || str_contains($message, 'verif'))) $reason = 'sender_not_validated';
    elseif (str_contains($message, 'credit') || str_contains($message, 'quota')) $reason = 'sending_quota';
    elseif (str_contains($message, 'suspend') || str_contains($message, 'blocked')) $reason = 'account_or_request_blocked';
    return ['httpStatus' => max(0, min(599, $status)), 'errorCode' => $code, 'reason' => $reason];
}

/** Returns safe delivery metadata only; provider responses and credentials are never logged. */
function notification_email_http(array $config, array $payload): array
{
    $curl = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15, CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json', 'api-key: ' . $config['apiKey']],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    $body = curl_exec($curl); $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE); $error = curl_errno($curl); curl_close($curl);
    $decoded = is_string($body) ? json_decode($body, true) : null;
    return ['status' => $error ? 0 : $status, 'id' => is_array($decoded) ? (string)($decoded['messageId'] ?? '') : '',
        'failure' => notification_email_failure_details($error ? 0 : $status, $decoded)];
}

final class NotificationEmailDelivery
{
    public function __construct(private object $db, private array $config, private ?Closure $transport = null, private ?Closure $clock = null) {}
    private function now(): int { return $this->clock ? ($this->clock)() : time(); }

    public function process(string $id): string
    {
        $now = $this->now(); $token = bin2hex(random_bytes(16));
        $claimed = $this->db->transaction(static function ($tx) use ($id, $now, $token): ?array {
            $job = $tx->get('EmailOutbox', $id);
            if (!$job || empty($job['pending'])) return null;
            if (($job['status'] ?? '') === 'SENDING') {
                if (($job['leaseUntil'] ?? 0) <= $now) $tx->update('EmailOutbox', $id,
                    ['status' => 'UNKNOWN', 'pending' => false, 'lastError' => 'interrupted_delivery', 'leaseUntil' => 0]);
                return null;
            }
            if (($job['status'] ?? '') !== 'PENDING' || ($job['nextAttemptAt'] ?? 0) > $now) return null;
            if (($job['createdAtEpoch'] ?? 0) < $now - 86400 || (!empty($job['notification']['emailExpiresAt']) && $job['notification']['emailExpiresAt'] <= $now)) {
                $tx->update('EmailOutbox', $id, ['status' => 'EXPIRED', 'pending' => false]); return null;
            }
            $profile = $tx->get('Users', (string)$job['recipientUid']);
            if (!$profile) { $tx->update('EmailOutbox', $id, ['status' => 'SKIPPED', 'pending' => false, 'lastError' => 'account_missing']); return null; }
            if (!empty($job['notification']['emailExpiresAt']) && ($job['notification']['relatedEntityType'] ?? '') === 'seat_waitlist') {
                $offer = $tx->get('SeatWaitlists', (string)($job['notification']['relatedEntityId'] ?? ''));
                if (!$offer || ($offer['offerUid'] ?? '') !== $job['recipientUid']
                    || (int)strtotime((string)($offer['offerExpiry'] ?? '')) !== (int)$job['notification']['emailExpiresAt']) {
                    $tx->update('EmailOutbox', $id, ['status' => 'SKIPPED', 'pending' => false, 'lastError' => 'offer_no_longer_available']); return null;
                }
            }
            $attempts = (int)($job['attempts'] ?? 0) + 1;
            $tx->update('EmailOutbox', $id, ['status' => 'SENDING', 'leaseToken' => $token, 'leaseUntil' => $now + 90, 'attempts' => $attempts]);
            return ['job' => $job, 'role' => $profile['role'] ?? 'buyer', 'attempts' => $attempts];
        });
        if (!$claimed) return 'unchanged';
        try { $account = $this->db->getAuthUserByUid((string)$claimed['job']['recipientUid']); }
        catch (Throwable) { return $this->finish($id, $token, $claimed['attempts'] < 3 ? 'PENDING' : 'FAILED', 'account_lookup_unavailable'); }
        if (!$account || ($account['emailVerified'] ?? false) !== true || !filter_var($account['email'] ?? '', FILTER_VALIDATE_EMAIL)
            || preg_match('/[\r\n]/', (string)($account['email'] ?? ''))) return $this->finish($id, $token, 'SKIPPED', 'verified_email_unavailable');
        $payload = notification_email_payload($this->config, $claimed['job'], $account, (string)$claimed['role']);
        try { $result = $this->transport ? ($this->transport)($this->config, $payload) : notification_email_http($this->config, $payload); }
        catch (Throwable) { return $this->finish($id, $token, 'UNKNOWN', 'delivery_response_unavailable'); }
        $status = (int)($result['status'] ?? 0);
        if ($status >= 200 && $status < 300 && !empty($result['id'])) return $this->finish($id, $token, 'ACCEPTED', '', (string)$result['id']);
        if ($status === 429) return $this->finish($id, $token, $claimed['attempts'] < 3 ? 'PENDING' : 'FAILED', 'provider_rate_limited');
        if ($status >= 400 && $status < 500) {
            $safe = $result['failure'] ?? notification_email_failure_details($status, null);
            $detail = 'provider_rejected:' . (int)$status;
            foreach (['errorCode', 'reason'] as $field) {
                $value = (string)($safe[$field] ?? 'unclassified');
                $detail .= ':' . (preg_match('/^[a-z_]{1,40}$/D', $value) ? $value : 'unclassified');
            }
            return $this->finish($id, $token, 'FAILED', $detail);
        }
        // A lost response or server error may follow an accepted send. Do not blindly resend.
        return $this->finish($id, $token, 'UNKNOWN', 'delivery_response_unavailable');
    }

    private function finish(string $id, string $token, string $status, string $error = '', string $providerId = ''): string
    {
        $now = $this->now();
        $this->db->transaction(static function ($tx) use ($id, $token, $status, $error, $providerId, $now): void {
            $job = $tx->get('EmailOutbox', $id);
            if (!$job || ($job['leaseToken'] ?? '') !== $token || ($job['status'] ?? '') !== 'SENDING') return;
            $tx->update('EmailOutbox', $id, ['status' => $status, 'pending' => $status === 'PENDING', 'leaseUntil' => 0,
                'leaseToken' => '', 'lastError' => $error, 'providerId' => $providerId, 'updatedAtEpoch' => $now, 'nextAttemptAt' => $now + 60]);
        });
        return $status;
    }

    public function batch(int $limit = 10): array
    {
        $jobs = $this->db->queryDocuments('EmailOutbox', ['pending' => true], [], max(1, min(20, $limit)));
        $outcomes = [];
        foreach ($jobs as $job) $outcomes[] = $this->process((string)$job['id']);
        return ['examined' => count($jobs), 'changed' => count(array_filter($outcomes, static fn ($s) => $s !== 'unchanged'))];
    }
}
