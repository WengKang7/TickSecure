<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/face-network.php';
foreach (['10.1.2.3', '172.16.0.1', '172.31.255.254', '192.168.0.12', '::ffff:192.168.0.5'] as $address) {
    if (!face_is_private_lan($address)) throw new RuntimeException('Expected private peer: ' . $address);
}
foreach (['8.8.8.8', '172.15.0.1', '172.32.0.1', '192.169.0.1', '192.168.999.1', 'localhost', '', '2001:db8::1'] as $address) {
    if (face_is_private_lan($address)) throw new RuntimeException('Unexpected private peer: ' . $address);
}
if (!face_is_loopback('127.0.0.1') || !face_is_loopback('::1') || face_is_loopback('192.168.0.1')) throw new RuntimeException('Invalid loopback classification');
echo "Private network boundary checks passed.\n";
