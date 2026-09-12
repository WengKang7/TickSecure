<?php
declare(strict_types=1);

/**
 * Local-development upload fallback.
 *
 * This endpoint deliberately remains off unless the web-server environment has
 * opted in. Firebase Storage is the normal upload path; this is only for an
 * XAMPP/FYP demonstration running from the same computer.
 */

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * @param array<string, mixed> $payload
 */
function respond(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, max-age=0');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function isLoopbackRequest(): bool
{
    $remoteAddress = (string) ($_SERVER['REMOTE_ADDR'] ?? '');

    if ($remoteAddress === '::1' || $remoteAddress === '::ffff:127.0.0.1') {
        return true;
    }

    return filter_var($remoteAddress, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false
        && str_starts_with($remoteAddress, '127.');
}

function localUploadsAreEnabled(): bool
{
    // getenv() reads an Apache/XAMPP server setting, not a browser-supplied value.
    return getenv('TICKSECURE_LOCAL_UPLOADS') === '1'
        && strlen((string) getenv('TICKSECURE_LOCAL_UPLOAD_TOKEN')) >= 32
        && isLoopbackRequest();
}

function hasValidLocalUploadRequestMode(): bool
{
    return ($_SERVER['HTTP_X_TICKSECURE_UPLOAD_MODE'] ?? '') === 'local-dev'
        && ($_GET['mode'] ?? '') === 'local-dev';
}

function hasValidLocalUploadToken(): bool
{
    $serverToken = (string) getenv('TICKSECURE_LOCAL_UPLOAD_TOKEN');
    $requestToken = (string) ($_SERVER['HTTP_X_TICKSECURE_LOCAL_UPLOAD_TOKEN'] ?? '');

    return $requestToken !== '' && hash_equals($serverToken, $requestToken);
}

/**
 * @return array{mimeType: string, extension: string}
 */
function inspectUpload(string $temporaryPath): array
{
    if (!class_exists('finfo')) {
        respond(500, ['error' => 'PHP Fileinfo is required for local uploads.', 'code' => 'FILEINFO_UNAVAILABLE']);
    }

    $mimeType = (new finfo(FILEINFO_MIME_TYPE))->file($temporaryPath);
    $signature = file_get_contents($temporaryPath, false, null, 0, 16);

    if (!is_string($signature)) {
        respond(400, ['error' => 'The uploaded file could not be inspected.', 'code' => 'INVALID_FILE']);
    }

    $isJpeg = str_starts_with($signature, "\xFF\xD8\xFF");
    $isPng = str_starts_with($signature, "\x89PNG\r\n\x1A\n");
    $isPdf = str_starts_with($signature, '%PDF-');

    if ($mimeType === 'image/jpeg' && $isJpeg) {
        $imageInfo = getimagesize($temporaryPath);
        if (is_array($imageInfo) && ($imageInfo[2] ?? null) === IMAGETYPE_JPEG) {
            return ['mimeType' => 'image/jpeg', 'extension' => 'jpg'];
        }
    }

    if ($mimeType === 'image/png' && $isPng) {
        $imageInfo = getimagesize($temporaryPath);
        if (is_array($imageInfo) && ($imageInfo[2] ?? null) === IMAGETYPE_PNG) {
            return ['mimeType' => 'image/png', 'extension' => 'png'];
        }
    }

    if ($mimeType === 'application/pdf' && $isPdf) {
        return ['mimeType' => 'application/pdf', 'extension' => 'pdf'];
    }

    respond(415, [
        'error' => 'Only valid JPG, PNG, or PDF files are accepted.',
        'code' => 'UNSUPPORTED_FILE_TYPE',
    ]);
}

/**
 * @return array{0: string, 1: string}
 */
function makeSafeUploadDirectory(string $projectRoot): array
{
    $uploadsRoot = $projectRoot . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'local';
    $dateDirectory = gmdate('Y') . DIRECTORY_SEPARATOR . gmdate('m');
    $destinationDirectory = $uploadsRoot . DIRECTORY_SEPARATOR . $dateDirectory;

    if (!is_dir($destinationDirectory) && !mkdir($destinationDirectory, 0700, true) && !is_dir($destinationDirectory)) {
        respond(500, ['error' => 'The local upload directory could not be created.', 'code' => 'UPLOAD_DIRECTORY_ERROR']);
    }

    $resolvedRoot = realpath($uploadsRoot);
    $resolvedDestination = realpath($destinationDirectory);
    $rootPrefix = $projectRoot . DIRECTORY_SEPARATOR;
    $uploadsPrefix = ($resolvedRoot ?: '') . DIRECTORY_SEPARATOR;

    if (
        $resolvedRoot === false
        || $resolvedDestination === false
        || !str_starts_with($resolvedRoot . DIRECTORY_SEPARATOR, $rootPrefix)
        || !str_starts_with($resolvedDestination . DIRECTORY_SEPARATOR, $uploadsPrefix)
        || is_link($resolvedRoot)
        || is_link($resolvedDestination)
    ) {
        respond(500, ['error' => 'The local upload path is invalid.', 'code' => 'UPLOAD_PATH_ERROR']);
    }

    return [$resolvedDestination, 'uploads/local/' . str_replace(DIRECTORY_SEPARATOR, '/', $dateDirectory)];
}

// Preserve the retired endpoint's safe default: it is unavailable without an
// explicit server-side opt-in, a loopback request, and the request contract below.
if (!localUploadsAreEnabled()) {
    respond(410, [
        'error' => 'Local uploads are disabled. Use Firebase Storage or explicitly enable local development uploads.',
        'code' => 'LOCAL_UPLOADS_DISABLED',
    ]);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    respond(405, ['error' => 'Only POST requests are accepted.', 'code' => 'METHOD_NOT_ALLOWED']);
}

if (!hasValidLocalUploadRequestMode()) {
    respond(400, [
        'error' => 'Use local-dev mode in both the query string and X-TickSecure-Upload-Mode header.',
        'code' => 'LOCAL_UPLOAD_MODE_REQUIRED',
    ]);
}

if (!hasValidLocalUploadToken()) {
    respond(403, ['error' => 'The local upload token is invalid.', 'code' => 'LOCAL_UPLOAD_FORBIDDEN']);
}

$file = $_FILES['file'] ?? null;
if (!is_array($file) || is_array($file['name'] ?? null)) {
    respond(400, ['error' => 'Submit one multipart file using the "file" field.', 'code' => 'FILE_REQUIRED']);
}

$uploadError = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
if ($uploadError !== UPLOAD_ERR_OK) {
    $status = $uploadError === UPLOAD_ERR_INI_SIZE || $uploadError === UPLOAD_ERR_FORM_SIZE ? 413 : 400;
    respond($status, ['error' => 'The file upload failed.', 'code' => 'UPLOAD_FAILED']);
}

$temporaryPath = (string) ($file['tmp_name'] ?? '');
$fileSize = (int) ($file['size'] ?? 0);
if ($fileSize < 1 || $fileSize > MAX_UPLOAD_BYTES) {
    respond(413, ['error' => 'Files must be no larger than 10 MB.', 'code' => 'FILE_TOO_LARGE']);
}

if ($temporaryPath === '' || !is_uploaded_file($temporaryPath)) {
    respond(400, ['error' => 'The uploaded file is invalid.', 'code' => 'INVALID_FILE']);
}

$fileMetadata = inspectUpload($temporaryPath);
$projectRoot = realpath(dirname(__DIR__));
if ($projectRoot === false) {
    respond(500, ['error' => 'The project path could not be resolved.', 'code' => 'PROJECT_PATH_ERROR']);
}

[$destinationDirectory, $relativeDirectory] = makeSafeUploadDirectory($projectRoot);
$generatedName = bin2hex(random_bytes(20)) . '.' . $fileMetadata['extension'];
$destinationPath = $destinationDirectory . DIRECTORY_SEPARATOR . $generatedName;

if (!move_uploaded_file($temporaryPath, $destinationPath)) {
    respond(500, ['error' => 'The file could not be saved.', 'code' => 'UPLOAD_SAVE_FAILED']);
}

chmod($destinationPath, 0600);

respond(201, [
    'ok' => true,
    'path' => $relativeDirectory . '/' . $generatedName,
    'mimeType' => $fileMetadata['mimeType'],
    'size' => $fileSize,
]);
