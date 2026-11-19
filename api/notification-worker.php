<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/firebase-admin.php';
$watch = in_array('--watch', $argv, true);
$nextPoll = 0; $lastSignal = ''; $client = null;
do {
    try {
        $config = notification_email_config();
        $signal = @file_get_contents(notification_email_wake_file()) ?: '';
        if ($config && (time() >= $nextPoll || $signal !== $lastSignal)) {
            $lastSignal = $signal;
            $client ??= new FirebaseAdminRest(firebase_backend_config());
            $result = (new NotificationEmailDelivery($client, $config))->batch();
            $nextPoll = time() + ($result['examined'] ? ($result['changed'] ? 1 : 60) : 300);
            if (!$watch) echo json_encode($result, JSON_THROW_ON_ERROR) . PHP_EOL;
        } elseif (!$config && !$watch) {
            fwrite(STDERR, "Notification email is not configured. See docs/notification-email.md.\n"); exit(1);
        }
    } catch (Throwable) {
        // Logs deliberately omit addresses, message bodies, tokens and provider responses.
        error_log('TickSecure notification email worker: delivery processing unavailable.');
        $nextPoll = time() + 60;
        if (!$watch) exit(1);
    }
    if ($watch) sleep(5);
} while ($watch);
