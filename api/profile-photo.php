<?php
declare(strict_types=1);
require_once __DIR__ . '/profile-photo-service.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
set_time_limit(120);

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        header('Allow: POST');
        throw new FirebaseBackendException(405, 'Only POST requests are accepted.', 'method-not-allowed');
    }
    $authorization = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if ($authorization === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $key => $value) {
            if (strcasecmp($key, 'Authorization') === 0) $authorization = $value;
        }
    }
    if (!preg_match('/^Bearer\s+(.+)$/i', $authorization, $match)) {
        throw new FirebaseBackendException(401, 'Sign in before uploading a profile photo.', 'unauthenticated');
    }
    $db = new FirebaseAdminRest(firebase_backend_config());
    $claims = $db->verifyIdToken(trim($match[1]));
    $file = $_FILES['file'] ?? null;
    if (!is_array($file) || is_array($file['name'] ?? null)
        || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK
        || !is_uploaded_file((string)($file['tmp_name'] ?? ''))) {
        throw new FirebaseBackendException(400, 'Choose one JPG or PNG photo, up to 5 MB.', 'invalid-file');
    }
    // The account ID comes exclusively from the verified token, never the form.
    $result = profile_photo_save($db, $claims, $file['tmp_name'], (int)filesize($file['tmp_name']));
    http_response_code(201);
    echo json_encode(['data' => $result], JSON_THROW_ON_ERROR);
} catch (FirebaseBackendException $error) {
    http_response_code($error->httpStatus);
    echo json_encode(['error' => ['code' => $error->errorCode, 'message' => $error->getMessage()]]);
} catch (Throwable $error) {
    http_response_code(503);
    echo json_encode(['error' => ['code' => 'unavailable',
        'message' => 'Profile photo upload could not finish. Check your profile before retrying.']]);
}
