<?php
declare(strict_types=1);
require_once __DIR__ . '/firebase-admin.php';

/** Provider settings can be changed without changing the picker code. No API key is needed. */
function venue_map_config(): array
{
    $config = ['geocodingBaseUrl' => 'https://nominatim.openstreetmap.org',
        'tileUrl' => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'];
    $local = __DIR__ . '/maps-config.local.php';
    if (is_file($local)) {
        $overrides = require $local;
        if (is_array($overrides)) $config = array_intersect_key($overrides, $config) + $config;
    }
    $config['geocodingBaseUrl'] = rtrim((string)(getenv('TICKSECURE_NOMINATIM_URL') ?: $config['geocodingBaseUrl']), '/');
    $config['tileUrl'] = (string)(getenv('TICKSECURE_MAP_TILE_URL') ?: $config['tileUrl']);
    foreach ($config as $url) {
        $parts = parse_url($url);
        if (!$parts || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
            throw new FirebaseBackendException(503, 'The venue map provider is not configured correctly.', 'map_configuration');
        }
    }
    return $config;
}

function venue_geocode_require_admin(array $claims, ?array $profile): void
{
    if (empty($claims['sub'])) throw new FirebaseBackendException(401, 'Sign in to find a venue location.', 'unauthenticated');
    if (($profile['role'] ?? '') !== 'admin' || ($profile['status'] ?? '') !== 'active') {
        throw new FirebaseBackendException(403, 'Only an active administrator can find venue locations.', 'permission-denied');
    }
}

function venue_geocode_query(array $input): array
{
    $common = ['format' => 'jsonv2', 'addressdetails' => '1', 'accept-language' => 'en'];
    if (($input['action'] ?? '') === 'search') {
        $text = is_string($input['q'] ?? null) ? trim($input['q']) : '';
        $length = preg_match_all('/./us', $text);
        if ($length === false || $length < 3 || $length > 200 || preg_match('/[\x00-\x1f\x7f]/', $text)) {
            throw new FirebaseBackendException(400, 'Enter a venue or address between 3 and 200 characters.', 'invalid-argument');
        }
        return ['path' => 'search', 'params' => $common + ['q' => $text, 'limit' => '5']];
    }
    if (($input['action'] ?? '') === 'reverse') {
        foreach (['lat' => 90, 'lon' => 180] as $field => $bound) {
            $value = $input[$field] ?? null;
            if ((!is_string($value) && !is_int($value) && !is_float($value)) || !is_numeric($value)
                || !is_finite((float)$value) || abs((float)$value) > $bound) {
                throw new FirebaseBackendException(400, 'Choose a valid point on the map.', 'invalid-argument');
            }
        }
        return ['path' => 'reverse', 'params' => $common + ['lat' => sprintf('%.6F', (float)$input['lat']),
            'lon' => sprintf('%.6F', (float)$input['lon']), 'zoom' => '18']];
    }
    throw new FirebaseBackendException(400, 'Choose a venue search or a map point.', 'invalid-argument');
}

function venue_geocode_text(mixed $value, int $limit): string
{
    if (!is_string($value)) return '';
    return preg_match('/^.{0,' . $limit . '}/us', trim($value), $matches) ? $matches[0] : '';
}

function venue_geocode_normalize(array $raw, string $path): array
{
    $places = $path === 'reverse' ? [$raw] : $raw;
    $results = [];
    foreach (array_slice($places, 0, 5) as $place) {
        if (!is_array($place) || !is_numeric($place['lat'] ?? null) || !is_numeric($place['lon'] ?? null)) continue;
        $lat = (float)$place['lat']; $lon = (float)$place['lon'];
        $address = venue_geocode_text($place['display_name'] ?? '', 500);
        if (!is_finite($lat) || !is_finite($lon) || abs($lat) > 90 || abs($lon) > 180 || $address === '') continue;
        $name = venue_geocode_text($place['name'] ?? '', 100);
        if ($name === '') {
            foreach (['amenity', 'building', 'leisure', 'tourism', 'shop', 'road', 'neighbourhood'] as $part) {
                $name = venue_geocode_text($place['address'][$part] ?? '', 100);
                if ($name !== '') break;
            }
        }
        if ($name === '') $name = venue_geocode_text(explode(',', $address)[0], 100);
        $results[] = ['name' => $name, 'address' => $address, 'latitude' => $lat, 'longitude' => $lon];
    }
    return ['results' => $results];
}

function venue_geocode_http(string $url): array
{
    if (!function_exists('curl_init')) throw new FirebaseBackendException(503, 'Enable PHP cURL to use venue search.', 'map_unavailable');
    $handle = curl_init($url);
    $body = '';
    curl_setopt_array($handle, [CURLOPT_RETURNTRANSFER => false, CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 12,
        CURLOPT_USERAGENT => 'TickSecure-VenuePicker/1.0 (administrator-selected public event venues)',
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > 262144) return 0;
            $body .= $chunk; return strlen($chunk);
        }]);
    $ok = curl_exec($handle);
    $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    if ($ok === false || $status !== 200) {
        throw new FirebaseBackendException(503, 'The free location service is unavailable. Try again later or enter the venue details manually.', 'map_unavailable');
    }
    $decoded = json_decode($body, true);
    if (!is_array($decoded)) throw new FirebaseBackendException(503, 'The location service returned an unreadable result.', 'map_unavailable');
    return $decoded;
}

/** Shared across all administrators: cache 24 hours, serialize requests, at least 1.1 seconds between upstream starts. */
function venue_geocode_cached(array $query, string $baseUrl, string $stateFile, callable $transport): array
{
    $file = fopen($stateFile, 'c+');
    if (!$file) throw new FirebaseBackendException(503, 'The map cache could not be opened.', 'map_unavailable');
    if (!flock($file, LOCK_EX | LOCK_NB)) {
        fclose($file);
        throw new FirebaseBackendException(429, 'Another location lookup is running. Wait a moment and try again.', 'map_busy');
    }
    $save = static function (array $state) use ($file): void {
        $json = json_encode($state, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR);
        rewind($file);
        if (!ftruncate($file, 0) || fwrite($file, $json) !== strlen($json) || !fflush($file)) {
            throw new FirebaseBackendException(503, 'The map cache could not be saved.', 'map_unavailable');
        }
    };
    try {
        rewind($file); $state = json_decode(stream_get_contents($file), true);
        if (!is_array($state)) $state = [];
        $url = $baseUrl . '/' . $query['path'] . '?' . http_build_query($query['params'], '', '&', PHP_QUERY_RFC3986);
        $key = hash('sha256', $url);
        $entries = array_filter(is_array($state['entries'] ?? null) ? $state['entries'] : [],
            static fn($entry) => is_array($entry) && ($entry['expires'] ?? 0) > time());
        if (isset($entries[$key]['response'])) return $entries[$key]['response'];
        $wait = max(0, (float)($state['nextRequestAt'] ?? 0) - microtime(true));
        if ($wait > 1.2) throw new FirebaseBackendException(429, 'Wait a moment before another location lookup.', 'map_busy');
        if ($wait > 0) usleep((int)ceil($wait * 1000000));
        // Write the throttle even if the provider later fails, while retaining the lock until completion.
        $state = ['nextRequestAt' => microtime(true) + 1.1, 'entries' => $entries];
        $save($state);
        $response = venue_geocode_normalize($transport($url), $query['path']);
        $entries[$key] = ['expires' => time() + 86400, 'response' => $response];
        $state['entries'] = array_slice($entries, -200, null, true);
        $save($state);
        return $response;
    } finally { flock($file, LOCK_UN); fclose($file); }
}

function venue_geocode_state_file(): string
{
    return rtrim(sys_get_temp_dir(), '/\\') . '/ticksecure-venue-geocoding-' . sha1(__DIR__) . '.json';
}
