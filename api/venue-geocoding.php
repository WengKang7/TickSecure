<?php
declare(strict_types=1);
require_once __DIR__ . '/venue-geocoding-service.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        header('Allow: POST');
        throw new FirebaseBackendException(405, 'Only POST requests are accepted.', 'method-not-allowed');
    }
    $authorization = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if ($authorization === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp((string)$name, 'Authorization') === 0) { $authorization = (string)$value; break; }
        }
    }
    if (!preg_match('/^Bearer\s+(.+)$/i', $authorization, $match)) {
        throw new FirebaseBackendException(401, 'Sign in to find a venue location.', 'unauthenticated');
    }
    $input = json_decode(file_get_contents('php://input', false, null, 0, 4096), true);
    if (!is_array($input)) throw new FirebaseBackendException(400, 'Choose a venue search or a map point.', 'invalid-argument');
    $query = venue_geocode_query($input);
    $firebase = new FirebaseAdminRest(firebase_backend_config());
    $claims = $firebase->verifyIdToken(trim($match[1]));
    venue_geocode_require_admin($claims, $firebase->getDocument('Users', (string)$claims['sub']));
    $config = venue_map_config();
    $response = venue_geocode_cached($query, $config['geocodingBaseUrl'], venue_geocode_state_file(), 'venue_geocode_http');
    echo json_encode($response, JSON_INVALID_UTF8_SUBSTITUTE | JSON_UNESCAPED_SLASHES);
} catch (FirebaseBackendException $error) {
    http_response_code($error->httpStatus);
    if ($error->httpStatus === 429) header('Retry-After: 2');
    echo json_encode(['error' => $error->getMessage(), 'code' => $error->errorCode]);
} catch (Throwable $error) {
    http_response_code(503);
    error_log('Venue geocoding failed: ' . get_class($error));
    echo json_encode(['error' => 'Venue search could not complete. Enter the details manually or try again later.', 'code' => 'map_unavailable']);
}
