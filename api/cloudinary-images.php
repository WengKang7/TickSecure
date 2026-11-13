<?php
declare(strict_types=1);
require_once __DIR__ . '/event-poster-policy.php';

function cloudinary_config_path(): string {
    return getenv('TICKSECURE_CLOUDINARY_ENV') ?: (getenv('TICKSECURE_HOSTED_CHECKOUT') === '1'
        ? '/etc/secrets/cloudinary.env' : dirname(__DIR__, 3) . '/private/cloudinary.env');
}

function cloudinary_config(): array {
    $path = realpath(cloudinary_config_path());
    $root = realpath(dirname(__DIR__));
    if (!$path || !$root || str_starts_with(strtolower(str_replace('\\', '/', $path)), rtrim(strtolower(str_replace('\\', '/', $root)), '/') . '/')) {
        throw new FirebaseBackendException(503, 'Configure the private cloudinary.env Secret File before uploading images.', 'image-storage-not-configured');
    }
    $raw = file_get_contents($path);
    if (!is_string($raw) || strlen($raw) > 4096) throw new FirebaseBackendException(503, 'Cloudinary configuration cannot be read.', 'image-storage-not-configured');
    $settings = parse_ini_string($raw, false, INI_SCANNER_RAW);
    $config = ['cloud' => trim((string)($settings['CLOUDINARY_CLOUD_NAME'] ?? '')),
        'key' => trim((string)($settings['CLOUDINARY_API_KEY'] ?? '')),
        'secret' => trim((string)($settings['CLOUDINARY_API_SECRET'] ?? ''))];
    if (!preg_match('/^[a-z0-9_-]{1,100}$/iD', $config['cloud']) || !preg_match('/^[0-9]{5,100}$/D', $config['key'])
        || !preg_match('/^[a-z0-9_-]{10,200}$/iD', $config['secret'])) {
        throw new FirebaseBackendException(503, 'Check the Cloudinary cloud name, API key and API secret in the private configuration file.', 'image-storage-not-configured');
    }
    return $config;
}

function cloudinary_image_url(mixed $url, string $cloud): string {
    $parts = is_string($url) ? parse_url($url) : false;
    if (!$parts || ($parts['scheme'] ?? '') !== 'https' || ($parts['host'] ?? '') !== 'res.cloudinary.com'
        || isset($parts['user']) || isset($parts['port']) || !str_starts_with($parts['path'] ?? '', '/' . $cloud . '/image/upload/')) {
        throw new FirebaseBackendException(502, 'The image service returned an invalid image address.', 'image-storage-invalid-response');
    }
    return $url;
}

// Public ID is based on event and image bytes: safe retries reuse the same asset.
function cloudinary_store_image(string $path, string $eventId, array $image): string {
    $config = cloudinary_config();
    $publicId = 'ticksecure/events/' . poster_require_event_id($eventId) . '/' . hash_file('sha256', $path);
    $fields = ['overwrite' => 'false', 'public_id' => $publicId, 'timestamp' => (string)time()];
    ksort($fields);
    $signed = [];
    foreach ($fields as $name => $value) $signed[] = $name . '=' . $value;
    $fields['signature'] = sha1(implode('&', $signed) . $config['secret']);
    $fields['api_key'] = $config['key'];
    $fields['file'] = new CURLFile($path, $image['mimeType'], 'artwork.' . $image['extension']);
    $curl = curl_init('https://api.cloudinary.com/v1_1/' . $config['cloud'] . '/image/upload');
    curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_POSTFIELDS => $fields,
        CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 45]);
    $raw = curl_exec($curl); $status = curl_getinfo($curl, CURLINFO_HTTP_CODE); curl_close($curl);
    if ($status !== 200 || !is_string($raw) || strlen($raw) > 100000) {
        throw new FirebaseBackendException(502, 'Cloudinary could not save the image. Check the storage credentials and account quota, then retry.', 'image-storage-upload-failed');
    }
    $result = json_decode($raw, true);
    return cloudinary_image_url($result['secure_url'] ?? null, $config['cloud']);
}
