<?php
declare(strict_types=1);

function face_is_loopback(string $address): bool {
    return in_array($address, ['127.0.0.1', '::1', '::ffff:127.0.0.1'], true);
}

function face_is_private_lan(string $address): bool {
    if (str_starts_with($address, '::ffff:')) $address = substr($address, 7);
    if (!filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) return false;
    $parts = array_map('intval', explode('.', $address));
    return $parts[0] === 10
        || ($parts[0] === 172 && $parts[1] >= 16 && $parts[1] <= 31)
        || ($parts[0] === 192 && $parts[1] === 168);
}
