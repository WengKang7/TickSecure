<?php
// Optional: copy to maps-config.local.php to switch Nominatim-compatible providers.
// Default OpenStreetMap services need no API key or billing.
// Public Nominatim: https://operations.osmfoundation.org/policies/nominatim/
// Only user-triggered searches/pin drops, shared 1.1-second throttle and 24-hour cache.
return [
    'geocodingBaseUrl' => 'https://nominatim.openstreetmap.org',
    'tileUrl' => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
];
