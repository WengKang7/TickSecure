<?php
declare(strict_types=1);
// Explicit CLI setup: creates a separate random encryption key beside the existing private Firebase credentials.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../../api/firebase-admin.php';
$python = $argv[1] ?? '';
if ($python === '' || !is_file($python)) { fwrite(STDERR, "Provide the full path to Python with OpenCV installed.\n"); exit(1); }
$firebase = firebase_backend_config();
$keyPath = dirname($firebase['serviceAccountPath']) . '/ticksecure-face-template.key';
$webRoot = strtolower(str_replace('\\', '/', realpath(__DIR__ . '/../../..')));
if (str_starts_with(strtolower(str_replace('\\', '/', $keyPath)), $webRoot . '/')) { fwrite(STDERR, "Private key path must be outside htdocs.\n"); exit(1); }
if (!is_file($keyPath)) {
    $handle = fopen($keyPath, 'xb');
    if (!$handle) throw new RuntimeException('Could not create the private face key.');
    fwrite($handle, random_bytes(32)); fclose($handle); chmod($keyPath, 0600);
}
if (filesize($keyPath) !== 32) throw new RuntimeException('Existing face key is invalid. It was not overwritten.');
$config = "<?php\nreturn " . var_export(['python' => $python, 'keyPath' => $keyPath], true) . ";\n";
file_put_contents(__DIR__ . '/../../api/face-config.local.php', $config);
echo "Local face verification configured; existing encryption keys preserved.\n";
