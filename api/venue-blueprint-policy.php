<?php
declare(strict_types=1);

require_once __DIR__ . '/firebase-admin.php';

const BLUEPRINT_MAX_BYTES = 10 * 1024 * 1024;

function blueprint_is_loopback(string $address): bool
{
    return in_array($address, ['::1', '::ffff:127.0.0.1'], true)
        || (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false
            && str_starts_with($address, '127.'));
}

function blueprint_require_venue_id(mixed $value): string
{
    if (!is_string($value) || !preg_match('/^[A-Za-z0-9_-]{1,160}$/D', $value)) {
        throw new FirebaseBackendException(400, 'The venue ID is invalid.', 'invalid-argument');
    }
    return $value;
}

/** @param array<string,mixed> $claims @param array<string,mixed>|null $profile */
function blueprint_require_admin(array $claims, ?array $profile): void
{
    if (!is_string($claims['sub'] ?? null) || $claims['sub'] === '') {
        throw new FirebaseBackendException(401, 'Sign in before uploading or reading a blueprint.', 'unauthenticated');
    }
    // Match the provisioned-administrator exception in login.php/auth-guard.js.
    // The endpoint verifies the signed Firebase token before calling this and
    // loads the role/status from Users/{token.sub}; neither comes from the form.
    // Administrator profiles may predate the emailVerified projection entirely.
    if (($profile['role'] ?? '') !== 'admin' || ($profile['status'] ?? '') !== 'active') {
        throw new FirebaseBackendException(403, 'Only an active administrator can upload or read blueprints.', 'permission-denied');
    }
}

function blueprint_inspect_file(string $path, int $size): string
{
    if ($size < 1 || $size > BLUEPRINT_MAX_BYTES) {
        throw new FirebaseBackendException(413, 'Choose a PNG or PDF file no larger than 10 MB.', 'file-too-large');
    }
    if (!class_exists('finfo')) {
        throw new FirebaseBackendException(503, 'PHP Fileinfo is required for blueprint uploads.', 'backend_not_configured');
    }
    if (is_file($path)) {
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);
        if ($mime === 'application/pdf' && file_get_contents($path, false, null, 0, 5) === '%PDF-') {
            return $mime;
        }
        if ($mime === 'image/png' && file_get_contents($path, false, null, 0, 8) === "\x89PNG\r\n\x1a\n") {
            $image = @getimagesize($path);
            if ($image !== false && $image[0] > 0 && $image[1] > 0 && $image[2] === IMAGETYPE_PNG) {
                return $mime;
            }
        }
    }
    throw new FirebaseBackendException(415, 'The selected file is not a valid PNG or PDF.', 'invalid-file-type');
}

function blueprint_storage_directory(): string
{
    $directory = realpath(__DIR__ . '/../storage/blueprints');
    $project = realpath(__DIR__ . '/..');
    if ($directory === false || $project === false || is_link(__DIR__ . '/../storage')
        || is_link(__DIR__ . '/../storage/blueprints')
        || !str_starts_with($directory . DIRECTORY_SEPARATOR, $project . DIRECTORY_SEPARATOR)
        || !is_file($directory . '/.htaccess') || !is_writable($directory)) {
        throw new FirebaseBackendException(503, 'The private blueprint directory is unavailable.', 'backend_not_configured');
    }
    return $directory;
}

function blueprint_file_path(string $filename): string
{
    if (!preg_match('/^[a-f0-9]{40}\.(pdf|png)$/D', $filename)) {
        throw new FirebaseBackendException(404, 'Blueprint not found.', 'not-found');
    }
    $path = blueprint_storage_directory() . DIRECTORY_SEPARATOR . $filename;
    if (is_link($path)) {
        throw new FirebaseBackendException(404, 'Blueprint not found.', 'not-found');
    }
    return $path;
}
