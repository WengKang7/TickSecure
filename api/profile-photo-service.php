<?php
declare(strict_types=1);
require_once __DIR__ . '/cloudinary-images.php';

function profile_photo_user(array $claims, ?array $profile): string
{
    $uid = (string)($claims['sub'] ?? '');
    if ($uid === '') {
        throw new FirebaseBackendException(401, 'Sign in before uploading your profile photo.', 'unauthenticated');
    }
    $role = $profile['role'] ?? '';
    $status = $profile['status'] ?? '';
    if (!in_array($role, ['buyer', 'organizer', 'admin'], true)
        || ($status !== 'active' && !($role === 'organizer' && $status === 'pending'))) {
        throw new FirebaseBackendException(403, 'This account cannot upload a profile photo.', 'permission-denied');
    }
    return $uid;
}

function profile_photo_save(object $db, array $claims, string $path, int $size, ?callable $store = null): array
{
    $uid = (string)($claims['sub'] ?? '');
    if ($uid === '') {
        throw new FirebaseBackendException(401, 'Sign in before uploading your profile photo.', 'unauthenticated');
    }
    $image = poster_inspect_image($path, $size);
    $dimensions = getimagesize($path);
    if (max($dimensions[0], $dimensions[1]) > 4096) {
        throw new FirebaseBackendException(413, 'Choose a profile photo no larger than 4096 pixels on either side.', 'image-too-large');
    }
    // Claim an upload slot before contacting Cloudinary. Recheck the account
    // afterward, in case it was disabled while the upload was running.
    $db->transaction(static function ($tx) use ($uid, $claims): void {
        profile_photo_user($claims, $tx->get('Users', $uid));
        $rate = $tx->get('ProfilePhotoLimits', $uid);
        $window = intdiv(time(), 60);
        $count = ($rate['window'] ?? 0) === $window ? (int)($rate['count'] ?? 0) : 0;
        if ($count >= 5) {
            throw new FirebaseBackendException(429, 'Too many photo uploads. Wait a minute and try again.', 'resource-exhausted');
        }
        $fields = ['window' => $window, 'count' => $count + 1];
        if ($rate === null) $tx->create('ProfilePhotoLimits', $uid, $fields);
        else $tx->update('ProfilePhotoLimits', $uid, $fields);
    });
    $upload = $store ?? 'cloudinary_store_image';
    $url = $upload($path, hash('sha256', $uid), $image, 'profiles');
    $db->transaction(static function ($tx) use ($uid, $claims, $url): void {
        profile_photo_user($claims, $tx->get('Users', $uid));
        $tx->update('Users', $uid, ['profilePhotoUrl' => $url, 'updatedAt' => gmdate('c')]);
    });
    return ['profilePhotoUrl' => $url];
}
