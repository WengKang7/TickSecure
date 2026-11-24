<?php
declare(strict_types=1);
require_once __DIR__ . '/firebase-admin.php';

/** Tile settings are independent of the geocoding provider. */
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

/** Adapt Geoapify to the existing bounded result contract. The key stays server-side. */
function venue_geoapify_query(array $query): array
{
    $params = ['format'=>'json','lang'=>'en','limit'=>$query['path']==='search'?'5':'1'];
    if ($query['path']==='search') $params['text']=$query['params']['q'];
    else $params += ['lat'=>$query['params']['lat'],'lon'=>$query['params']['lon']];
    return ['path'=>$query['path'],'params'=>$params];
}

function venue_geoapify_normalize(array $raw, string $path): array
{
    if (!isset($raw['results']) || !is_array($raw['results']))
        throw new FirebaseBackendException(503,'The location provider returned an unexpected response. Try again later.','map_unavailable');
    $places=[];
    foreach (array_slice($raw['results'],0,5) as $place) {
        if (!is_array($place)) continue;
        $places[]=['lat'=>$place['lat']??null,'lon'=>$place['lon']??null,
            'display_name'=>$place['formatted']??'',
            'name'=>$place['name']??$place['address_line1']??''];
    }
    return venue_geocode_normalize($path==='reverse'?($places[0]??[]):$places,$path);
}

function venue_geocode_lookup(array $query, array $config, string $stateFile, ?callable $transport=null): array
{
    $key=trim((string)getenv('GEOAPIFY_API_KEY'));
    if ($key==='')return venue_geocode_cached($query,$config['geocodingBaseUrl'],$stateFile,$transport??'venue_geocode_http');
    $adapted=venue_geoapify_query($query);
    return venue_geocode_cached($adapted,'https://api.geoapify.com/v1/geocode',$stateFile,
        static function(string $url)use($key,$transport):array {
            $raw=($transport??'venue_geocode_http')($url.'&apiKey='.rawurlencode($key));
            // Return the legacy provider shape so caching/normalization stay shared.
            $result=venue_geoapify_normalize($raw,str_contains($url,'/reverse?')?'reverse':'search');
            $places=array_map(static fn($p)=>['lat'=>$p['latitude'],'lon'=>$p['longitude'],'display_name'=>$p['address'],'name'=>$p['name']],$result['results']);
            return str_contains($url,'/reverse?')?($places[0]??[]):$places;
        });
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

/** Fixed categories only: upstream pages can echo query strings or network credentials. */
function venue_geocode_response_diagnostics(string $body, array $headers): array
{
    $sample = strtolower(substr($body, 0, 16384));
    $signals = [];
    foreach (['access_blocked' => '/access (?:blocked|denied)|request (?:blocked|denied)|forbidden/',
        'rate_limit' => '/rate limit|too many requests/', 'usage_policy' => '/usage policy|acceptable use/',
        'proxy' => '/proxy|gateway/', 'challenge' => '/captcha|verify you are human|challenge/',
        'render' => '/render\.com/', 'cloudflare' => '/cloudflare/', 'fastly' => '/fastly/'] as $name => $pattern)
        if (preg_match($pattern, $sample)) $signals[] = $name;
    $safe = [];
    foreach (['server', 'content-type', 'retry-after'] as $name)
        if (isset($headers[$name]) && preg_match('/^[a-zA-Z0-9 .\/;=_+:-]{1,100}$/D', $headers[$name])) $safe[$name] = $headers[$name];
    return ['responseBytes' => strlen($body), 'responseHeaders' => $safe, 'responseSignals' => $signals];
}

function venue_geocode_http(string $url): array
{
    if (!function_exists('curl_init')) throw new FirebaseBackendException(503, 'Enable PHP cURL to use venue search.', 'map_unavailable');
    $handle = curl_init($url);
    $body = '';
    $responseHeaders = [];
    curl_setopt_array($handle, [CURLOPT_RETURNTRANSFER => false, CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 12,
        CURLOPT_USERAGENT => 'TickSecure-VenuePicker/1.0 (administrator-selected public event venues)',
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$responseHeaders): int {
            if (preg_match('/^HTTP\//i', $line)) $responseHeaders = [];
            elseif (str_contains($line, ':')) {
                [$name, $value] = explode(':', $line, 2);
                $name = strtolower(trim($name));
                if (in_array($name, ['server', 'content-type', 'retry-after'], true)) $responseHeaders[$name] = trim($value);
            }
            return strlen($line);
        },
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > 262144) return 0;
            $body .= $chunk; return strlen($chunk);
        }]);
    $ok = curl_exec($handle);
    $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $curlCode = curl_errno($handle);
    curl_close($handle);
    if ($ok === false || $status !== 200) {
        // Log only transport diagnostics, never tokens, search text or response bodies.
        error_log('Venue geocoding upstream failed: ' . json_encode([
            'host' => parse_url($url, PHP_URL_HOST), 'httpStatus' => $status, 'curlCode' => $curlCode
        ] + venue_geocode_response_diagnostics($body, $responseHeaders), JSON_UNESCAPED_SLASHES));
        $message = match (true) {
            $status === 401 => 'The location provider rejected its API key. Ask the administrator to check the Geoapify key in Render.',
            $status === 403 => 'The location provider blocked the server request. Ask the administrator to check the venue search provider.',
            $status === 429 => 'The location provider is limiting requests. Wait a moment before searching again.',
            $curlCode === 28 => 'The location provider timed out. Try again later or choose the location on the map.',
            $curlCode === 6 => 'The server could not resolve the location provider. Ask the administrator to check the server connection.',
            in_array($curlCode, [35, 60], true) => 'The server could not establish a secure connection to the location provider. Ask the administrator to check the server configuration.',
            default => 'The location provider could not complete the search. Try again later or choose the location on the map.'
        };
        throw new FirebaseBackendException(503, $message, 'map_unavailable');
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
