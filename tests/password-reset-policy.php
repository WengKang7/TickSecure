<?php
// CLI-only policy runner: fixtures only, no credentials or Firebase requests.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/firebase-admin.php';
require_once __DIR__ . '/../api/password-reset.php';
$cases = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$results = [];
foreach ($cases as $case) {
    try {
        $results[] = backend_check_password_reset_email($case['data'],
            static fn (string $email): ?array => $case['user'] ?? null,
            static function (string $uid) use ($case): ?array {
                if (!empty($case['profileError'])) { throw new RuntimeException('Database unavailable'); }
                if ($uid !== ($case['user']['uid'] ?? '')) { throw new RuntimeException('Incorrect profile UID'); }
                return $case['profile'] ?? null;
            }
        );
    } catch (FirebaseBackendException $error) {
        $results[] = ['error' => $error->errorCode];
    } catch (Throwable) {
        $results[] = ['error' => 'unavailable'];
    }
}
echo json_encode($results, JSON_THROW_ON_ERROR);
