<?php
declare(strict_types=1);

require_once __DIR__ . '/firebase-admin.php';

const POSTER_MAX_BYTES = 5 * 1024 * 1024;

function poster_is_loopback(string $address): bool
{
    return in_array($address, ['::1', '::ffff:127.0.0.1'], true)
        || (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false && str_starts_with($address, '127.'));
}

function poster_require_event_id(mixed $value): string
{
    if (!is_string($value) || !preg_match('/^[A-Za-z0-9_-]{1,160}$/D', $value)) {
        throw new FirebaseBackendException(400, 'The event ID is invalid.', 'invalid-argument');
    }
    return $value;
}

/** @param array<string,mixed> $claims @param array<string,mixed>|null $profile @param array<string,mixed>|null $event */
function poster_require_editor(array $claims, ?array $profile, ?array $event): void
{
    $uid = $claims['sub'] ?? null;
    if (!is_string($uid) || $uid === '') {
        throw new FirebaseBackendException(401, 'Sign in before uploading a poster.', 'unauthenticated');
    }
    $role = $profile['role'] ?? '';
    $admin = $role === 'admin';
    $organizer = $role === 'organizer' && ($claims['email_verified'] ?? false) === true;
    if (($profile['status'] ?? '') !== 'active' || (!$admin && !$organizer)) {
        throw new FirebaseBackendException(403, 'An active organizer with a verified email or an administrator is required.', 'permission-denied');
    }
    if ($event === null) {
        throw new FirebaseBackendException(404, 'Event not found.', 'not-found');
    }
    if (!$admin && ($event['organizerUid'] ?? '') !== $uid) {
        throw new FirebaseBackendException(403, 'You can upload posters only for your own events.', 'permission-denied');
    }
    if (($event['status'] ?? '') !== 'DRAFT') {
        throw new FirebaseBackendException(409, 'Only draft event posters can be changed.', 'event-locked');
    }
}

/** @return array{extension:string,mimeType:string} */
function poster_inspect_image(string $path, int $size): array
{
    if ($size < 1 || $size > POSTER_MAX_BYTES) {
        throw new FirebaseBackendException(413, 'Choose a JPG or PNG image no larger than 5 MB.', 'file-too-large');
    }
    if (!class_exists('finfo')) {
        throw new FirebaseBackendException(503, 'PHP Fileinfo is required for poster uploads.', 'backend_not_configured');
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);
    $image = @getimagesize($path);
    $signature = file_get_contents($path, false, null, 0, 8);
    if (is_array($image) && is_string($signature)) {
        if ($mime === 'image/png' && $image[2] === IMAGETYPE_PNG && str_starts_with($signature, "\x89PNG\r\n\x1a\n")) {
            return ['extension' => 'png', 'mimeType' => 'image/png'];
        }
        if ($mime === 'image/jpeg' && $image[2] === IMAGETYPE_JPEG && str_starts_with($signature, "\xff\xd8\xff")) {
            return ['extension' => 'jpg', 'mimeType' => 'image/jpeg'];
        }
    }
    throw new FirebaseBackendException(415, 'The selected file must be a valid JPG or PNG image.', 'invalid-file-type');
}

function poster_file_path(string $filename): string
{
    if (!preg_match('/^[a-f0-9]{40}\.(jpg|png)$/D', $filename)) {
        throw new FirebaseBackendException(400, 'The poster filename is invalid.', 'invalid-argument');
    }
    $base = __DIR__ . '/../uploads/posters';
    $directory = realpath($base);
    $project = realpath(__DIR__ . '/..');
    if ($directory === false || $project === false || is_link(__DIR__ . '/../uploads') || is_link($base)
        || !str_starts_with($directory . DIRECTORY_SEPARATOR, $project . DIRECTORY_SEPARATOR)
        || !is_file($directory . '/.htaccess') || !is_writable($directory)) {
        throw new FirebaseBackendException(503, 'The local poster directory is unavailable.', 'backend_not_configured');
    }
    $path = $directory . DIRECTORY_SEPARATOR . $filename;
    if (is_link($path)) {
        throw new FirebaseBackendException(400, 'The poster path is invalid.', 'invalid-argument');
    }
    return $path;
}
