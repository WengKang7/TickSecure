<?php
declare(strict_types=1);

/**
 * Private account/profile lookup for the signed-out recovery form.
 * Callbacks keep this policy testable without credentials or real emails.
 * @param array<string,mixed> $data
 * @return array{registered:bool}
 */
function backend_check_password_reset_email(array $data, callable $findAuthUser, callable $findProfile): array
{
    $email = is_string($data['email'] ?? null) ? strtolower(trim($data['email'])) : '';
    if (strlen($email) > 254 || !preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $email)) {
        throw new FirebaseBackendException(400, 'Enter a valid email address.', 'invalid-argument');
    }
    $user = $findAuthUser($email);
    if (!is_array($user) || empty($user['uid'])
        || strtolower(trim((string)($user['email'] ?? ''))) !== $email) {
        return ['registered' => false];
    }
    $profile = $findProfile($user['uid']);
    return ['registered' => is_array($profile)
        && in_array($profile['role'] ?? null, ['buyer', 'organizer', 'admin'], true)
        && is_string($profile['email'] ?? null)
        && strtolower(trim($profile['email'])) === $email];
}
