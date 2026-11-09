<?php
declare(strict_types=1);
require_once __DIR__ . '/face-runtime.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
try {
    // This FYP service is local only. Do not expose Apache to the internet.
    $remote = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    if (!in_array($remote, ['127.0.0.1', '::1', '::ffff:127.0.0.1'], true)) face_fail('Face verification is available only on the local demo server.', 'permission-denied', 403);
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') face_fail('Only POST requests are accepted.', 'method-not-allowed', 405);
    $authorization = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    // Apache may expose Authorization through getallheaders() instead of $_SERVER.
    if ($authorization === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp((string)$name, 'Authorization') === 0) {
                $authorization = (string)$value;
                break;
            }
        }
    }
    if (!preg_match('/^Bearer\s+(.+)$/i', $authorization, $match)) face_fail('Sign in before using face verification.', 'unauthenticated', 401);
    $body = file_get_contents('php://input', false, null, 0, 3100001);
    if (strlen($body) > 3100000) face_fail('The camera request is too large.', 'invalid-argument', 413);
    $input = json_decode($body, true, 16, JSON_THROW_ON_ERROR);
    if (!is_array($input)) face_fail('Invalid face verification request.', 'invalid-argument', 400);
    $firebase = new FirebaseAdminRest(firebase_backend_config());
    $claims = $firebase->verifyIdToken(trim($match[1]));
    $runtime = face_runtime_config();
    $service = new TicketFaceService($firebase, $runtime['key'], fn ($frames) => face_extract($frames, $runtime['python']));
    $result = match ($input['action'] ?? '') {
        'session' => $service->session($claims),
        'status' => $service->status($claims, face_id($input['ticketId'] ?? null)),
        'enroll' => $service->enroll($claims, face_id($input['ticketId'] ?? null), (array)($input['frames'] ?? []), ($input['consent'] ?? false) === true),
        'remove' => $service->remove($claims, face_id($input['ticketId'] ?? null)),
        'beginCheckIn' => $service->begin($claims, (string)($input['qr'] ?? '')),
        'completeCheckIn' => $service->complete($claims, face_id($input['challengeId'] ?? null), (array)($input['frames'] ?? [])),
        'testFace' => $service->complete($claims, face_id($input['challengeId'] ?? null), (array)($input['frames'] ?? []), false),
        default => throw new FirebaseBackendException(400, 'Unknown face verification action.', 'invalid-argument')
    };
    echo json_encode(['data' => $result], JSON_THROW_ON_ERROR);
} catch (FirebaseBackendException $error) {
    http_response_code($error->httpStatus);
    echo json_encode(['error' => ['code' => $error->errorCode, 'message' => $error->getMessage()]]);
} catch (JsonException $error) {
    http_response_code(400);
    echo json_encode(['error' => ['code' => 'invalid-argument', 'message' => 'Invalid camera request.']]);
} catch (Throwable $error) {
    http_response_code(503);
    error_log('Face verification unavailable: ' . get_class($error)); // No camera data or secrets in logs.
    echo json_encode(['error' => ['code' => 'unavailable', 'message' => 'Face verification is unavailable. Please try again or contact the organizer.']]);
}
