<?php
declare(strict_types=1);

/** Short-lived cache for display-only, non-user-specific physical layout data.
 * Never use this for authorization, inventory status, reservations or checkout.
 * A cache failure falls back to Firestore and failed reads are never cached.
 */
function display_read_cache(string $namespace, string $key, int $ttl, callable $load): array
{
    $project = (string)(getenv('FIREBASE_PROJECT_ID') ?: 'tick-c12a1');
    // Keep outside the document root, and separate installations and projects.
    $directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ticksecure-display-' . hash('sha256', __DIR__ . '|' . $project);
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) return $load();
    $file = $directory . DIRECTORY_SEPARATOR . hash('sha256', $namespace . '|' . $key) . '.json';
    $handle = @fopen($file, 'c+');
    if ($handle === false) return $load();
    @chmod($file, 0600);
    try {
        // One loader per key, including requests served by different Apache workers.
        if (!flock($handle, LOCK_EX)) return $load();
        $raw = stream_get_contents($handle);
        $cached = is_string($raw) ? json_decode($raw, true) : null;
        $now = time();
        if (is_array($cached) && is_int($cached['savedAt'] ?? null)
            && $cached['savedAt'] <= $now && $cached['savedAt'] + $ttl > $now && is_array($cached['value'] ?? null)) {
            return $cached['value'];
        }
        $value = $load();
        $encoded = json_encode(['savedAt' => time(), 'value' => $value]);
        if (is_string($encoded)) { rewind($handle); ftruncate($handle, 0); fwrite($handle, $encoded); fflush($handle); }
        return $value;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}
