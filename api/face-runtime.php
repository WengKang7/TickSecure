<?php
declare(strict_types=1);
require_once __DIR__ . '/firebase-admin.php';
require_once __DIR__ . '/face-service.php';

function face_runtime_config(): array {
    $path = __DIR__ . '/face-config.local.php';
    if (!is_file($path)) face_fail('Local face verification needs its one-time setup. Ask the organizer to run tools/face/setup.php.', 'unavailable', 503);
    $config = require $path;
    $keyPath = realpath((string)($config['keyPath'] ?? ''));
    $webRoot = realpath(dirname(__DIR__, 2)); // htdocs, not just this project.
    if (!$keyPath || !$webRoot || str_starts_with(strtolower(str_replace('\\', '/', $keyPath)), strtolower(str_replace('\\', '/', $webRoot)) . '/')) {
        face_fail('Face encryption key must be outside htdocs.', 'unavailable', 503);
    }
    $key = file_get_contents($keyPath);
    if (!is_string($key) || strlen($key) !== 32) face_fail('Face encryption key is unavailable.', 'unavailable', 503);
    return ['key' => $key, 'python' => (string)($config['python'] ?? 'python')];
}
function face_extract(array $frames, string $python): array {
    if (count($frames) !== 3) face_fail('Capture three images from your camera.', 'invalid-argument', 400);
    foreach ($frames as $frame) if (!is_string($frame) || strlen($frame) > 1000000 || !preg_match('/^[A-Za-z0-9+\/=]+$/D', $frame)) {
        face_fail('Invalid camera image.', 'invalid-argument', 400);
    }
    $pipes = [];
    $process = proc_open([$python, __DIR__ . '/../tools/face/recognize.py'],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['file', PHP_OS_FAMILY === 'Windows' ? 'NUL' : '/dev/null', 'a']],
        $pipes, __DIR__, null, ['bypass_shell' => true, 'create_no_window' => true]);
    if (!is_resource($process)) face_fail('Face recognition could not start.', 'unavailable', 503);
    $payload = json_encode(['frames' => $frames], JSON_THROW_ON_ERROR);
    $offset = 0;
    while ($offset < strlen($payload)) {
        $written = fwrite($pipes[0], substr($payload, $offset));
        if (!$written) break;
        $offset += $written;
    }
    fclose($pipes[0]);
    $output = stream_get_contents($pipes[1], 40000); fclose($pipes[1]); proc_close($process);
    $result = json_decode($output, true);
    if (isset($result['error'])) face_fail((string)$result['error'], 'face-capture-failed');
    if (($result['data']['model'] ?? '') !== FACE_MODEL) face_fail('Face models are unavailable. Ask the organizer to check the setup.', 'unavailable', 503);
    return face_vectors($result['data']['vectors'] ?? null);
}
