<?php
declare(strict_types=1);

require_once __DIR__ . '/venue-blueprint-policy.php';

/** @param array<string,mixed> $body */
function blueprint_respond(int $status, array $body): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

// Independent of generic upload tokens and the full PHP backend flag. This
// dedicated localhost route always verifies a Firebase administrator ID token.
if (getenv('TICKSECURE_PHP_BLUEPRINT_UPLOAD') !== '1'
    || !blueprint_is_loopback((string)($_SERVER['REMOTE_ADDR'] ?? ''))) {
    blueprint_respond(410, ['error' => 'Local blueprint uploads are disabled.', 'code' => 'blueprint_upload_disabled']);
}

$method = (string)($_SERVER['REQUEST_METHOD'] ?? 'GET');
if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    blueprint_respond(405, ['error' => 'Only GET and POST requests are accepted.', 'code' => 'method_not_allowed']);
}

$savedPath = null;
try {
    $authorization = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if ($authorization === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp((string)$name, 'Authorization') === 0) {
                $authorization = (string)$value;
                break;
            }
        }
    }
    if (!preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches)) {
        throw new FirebaseBackendException(401, 'Sign in before uploading or reading a blueprint.', 'unauthenticated');
    }
    $venueId = blueprint_require_venue_id($method === 'POST' ? ($_POST['venueId'] ?? null) : ($_GET['venueId'] ?? null));
    $firebase = new FirebaseAdminRest(firebase_backend_config());
    $claims = $firebase->verifyIdToken(trim($matches[1]));
    $uid = (string)$claims['sub'];
    blueprint_require_admin($claims, $firebase->getDocument('Users', $uid));
    $venue = $firebase->getDocument('Venues', $venueId);
    if ($venue === null) {
        throw new FirebaseBackendException(404, 'Venue not found.', 'not-found');
    }

    if ($method === 'GET') {
        $path = blueprint_file_path((string)($venue['blueprintLocalFile'] ?? ''));
        if (!is_file($path)) {
            throw new FirebaseBackendException(404, 'Blueprint not found.', 'not-found');
        }
        header('Content-Type: application/pdf');
        header('Content-Length: ' . filesize($path));
        header('Content-Disposition: attachment; filename="blueprint.pdf"');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        readfile($path);
        exit;
    }

    $file = $_FILES['file'] ?? null;
    if (!is_array($file) || is_array($file['name'] ?? null)) {
        throw new FirebaseBackendException(400, 'Submit one PDF using the file field. Check the PHP upload limit if the file is large.', 'file-required');
    }
    $uploadError = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($uploadError !== UPLOAD_ERR_OK) {
        $status = in_array($uploadError, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 413 : 400;
        throw new FirebaseBackendException($status, 'PHP could not receive this file. Check the upload size limit and retry.', 'upload-failed');
    }
    $temporaryPath = (string)($file['tmp_name'] ?? '');
    if (!is_uploaded_file($temporaryPath)) {
        throw new FirebaseBackendException(400, 'The uploaded file is invalid.', 'invalid-file');
    }
    $size = (int)($file['size'] ?? 0);
    blueprint_inspect_pdf($temporaryPath, $size);
    $filename = bin2hex(random_bytes(20)) . '.pdf';
    $savedPath = blueprint_file_path($filename);
    if (!move_uploaded_file($temporaryPath, $savedPath)) {
        throw new FirebaseBackendException(500, 'The PDF could not be saved locally.', 'upload-save-failed');
    }
    chmod($savedPath, 0600);
    $name = basename(str_replace('\\', '/', (string)($file['name'] ?? 'blueprint.pdf')));
    $url = 'api/venue-blueprint.php?venueId=' . rawurlencode($venueId);
    $metadata = [
        'blueprintUrl' => $url,
        'blueprintLocalFile' => $filename,
        'blueprintName' => mb_substr($name, 0, 200),
        'blueprintSize' => $size,
        'updatedAt' => gmdate('Y-m-d\TH:i:s\Z'),
    ];
    // Recheck authorization inside the metadata transaction, so role changes or
    // a deleted venue during the upload cannot publish the new blueprint.
    $firebase->transaction(static function (FirebaseFirestoreTransaction $tx) use ($claims, $uid, $venueId, $metadata): void {
        blueprint_require_admin($claims, $tx->get('Users', $uid));
        if ($tx->get('Venues', $venueId) === null) {
            throw new FirebaseBackendException(404, 'Venue not found.', 'not-found');
        }
        $tx->update('Venues', $venueId, $metadata);
    });
    $savedPath = null;
    blueprint_respond(201, ['ok' => true, 'url' => $url, 'size' => $size]);
} catch (FirebaseBackendException $error) {
    if ($savedPath !== null && is_file($savedPath)) unlink($savedPath);
    blueprint_respond($error->httpStatus, ['error' => $error->getMessage(), 'code' => $error->errorCode]);
} catch (Throwable $error) {
    if ($savedPath !== null && is_file($savedPath)) unlink($savedPath);
    error_log('Local blueprint upload failed: ' . $error->getMessage());
    blueprint_respond(500, ['error' => 'The local blueprint service could not complete the request.', 'code' => 'backend_error']);
}
