<?php
declare(strict_types=1);

require_once __DIR__ . '/event-poster-policy.php';

/** @param array<string,mixed> $body */
function poster_respond(int $status, array $body): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

if (getenv('TICKSECURE_PHP_POSTER_UPLOAD') !== '1' || !poster_is_loopback((string)($_SERVER['REMOTE_ADDR'] ?? ''))) {
    poster_respond(410, ['error' => 'Local event poster uploads are disabled.', 'code' => 'poster_upload_disabled']);
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    poster_respond(405, ['error' => 'Only POST requests are accepted.', 'code' => 'method_not_allowed']);
}

$savedPath = null;
try {
    $authorization = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if ($authorization === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp((string)$name, 'Authorization') === 0) { $authorization = (string)$value; break; }
        }
    }
    if (!preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches)) {
        throw new FirebaseBackendException(401, 'Sign in before uploading a poster.', 'unauthenticated');
    }
    $eventId = poster_require_event_id($_POST['eventId'] ?? null);
    $firebase = new FirebaseAdminRest(firebase_backend_config());
    $claims = $firebase->verifyIdToken(trim($matches[1]));
    $uid = (string)$claims['sub'];
    poster_require_editor($claims, $firebase->getDocument('Users', $uid), $firebase->getDocument('Events', $eventId));
    $file = $_FILES['file'] ?? null;
    if (!is_array($file) || is_array($file['name'] ?? null)) {
        throw new FirebaseBackendException(400, 'Choose one JPG or PNG image no larger than 5 MB.', 'file-required');
    }
    $uploadError = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($uploadError !== UPLOAD_ERR_OK) {
        throw new FirebaseBackendException(in_array($uploadError, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 413 : 400,
            'PHP could not receive the poster. Check the file size and retry.', 'upload-failed');
    }
    $temporaryPath = (string)($file['tmp_name'] ?? '');
    if (!is_uploaded_file($temporaryPath)) {
        throw new FirebaseBackendException(400, 'The uploaded image is invalid.', 'invalid-file');
    }
    $image = poster_inspect_image($temporaryPath, (int)($file['size'] ?? 0));
    $filename = bin2hex(random_bytes(20)) . '.' . $image['extension'];
    $savedPath = poster_file_path($filename);
    if (!move_uploaded_file($temporaryPath, $savedPath)) {
        throw new FirebaseBackendException(500, 'The poster could not be saved locally.', 'upload-save-failed');
    }
    chmod($savedPath, 0644);
    $relativePath = 'uploads/posters/' . $filename;
    // Root-relative URLs work in both public event pages and organizer pages,
    // including projects installed under an XAMPP subdirectory.
    $basePath = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? ''), 2)), '/.');
    $url = $basePath . '/' . $relativePath;
    $firebase->transaction(static function (FirebaseFirestoreTransaction $tx) use ($claims, $uid, $eventId, $url): void {
        poster_require_editor($claims, $tx->get('Users', $uid), $tx->get('Events', $eventId));
        $tx->update('Events', $eventId, ['posterUrl' => $url, 'updatedAt' => gmdate('Y-m-d\TH:i:s\Z')]);
    });
    $savedPath = null;
    poster_respond(201, ['ok' => true, 'path' => $relativePath]);
} catch (FirebaseBackendException $error) {
    if ($savedPath !== null && is_file($savedPath)) unlink($savedPath);
    poster_respond($error->httpStatus, ['error' => $error->getMessage(), 'code' => $error->errorCode]);
} catch (Throwable $error) {
    if ($savedPath !== null && is_file($savedPath)) unlink($savedPath);
    error_log('Local poster upload failed: ' . $error->getMessage());
    poster_respond(500, ['error' => 'The local poster service could not complete the request.', 'code' => 'backend_error']);
}
