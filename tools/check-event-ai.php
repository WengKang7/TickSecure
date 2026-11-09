<?php
// Optional CLI smoke check: synthetic event text only; never modifies Firebase.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/firebase-admin.php';
require_once __DIR__ . '/../api/event-content-review.php';
function backend_fail(int $status, string $message, string $code): never { throw new FirebaseBackendException($status, $message, $code); }
if (in_array('--diagnose', $argv, true)) {
    $config = event_review_config();
    $curl = curl_init('https://generativelanguage.googleapis.com/v1beta/models');
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => ['x-goog-api-key: ' . $config['key']]]);
    $raw = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $errno = curl_errno($curl);
    curl_close($curl);
    $body = is_string($raw) ? json_decode($raw, true) : [];
    $reason = '';
    foreach ($body['error']['details'] ?? [] as $detail) {
        if (preg_match('/^[A-Z_]{1,80}$/', $detail['reason'] ?? '')) $reason = $detail['reason'];
    }
    $models = array_values(array_filter(array_map(static fn ($m) => $m['name'] ?? '', $body['models'] ?? []), static fn ($m) => str_contains($m, 'flash') && !str_contains($m, 'image')));
    echo json_encode(['httpStatus' => $status, 'curlErrorCode' => $errno, 'providerErrorReason' => $reason, 'flashModels' => $models], JSON_THROW_ON_ERROR) . PHP_EOL;
    exit($status === 200 ? 0 : 1);
}
$cases = [
    ['name' => 'The Killers — Live Music Night', 'description' => 'An evening of live rock music with a tribute band. All ages welcome. No violence or dangerous activities.'],
    ['name' => 'Attack attendees night', 'description' => 'Bring weapons and join us to attack and kill attendees from a rival community.']
];
foreach ($cases as $case) {
    try {
        $result = event_review_gemini(event_review_content($case));
        echo json_encode(['name' => $case['name']] + $result, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    } catch (FirebaseBackendException $error) {
        echo json_encode(['error' => $error->errorCode, 'message' => $error->getMessage()], JSON_THROW_ON_ERROR) . PHP_EOL;
        exit(1);
    }
}
