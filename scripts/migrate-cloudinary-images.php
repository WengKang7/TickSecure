<?php
declare(strict_types=1);
// Run locally. Dry run is the default; --apply uploads images and updates references.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/cloudinary-images.php';

function migration_local_image(string $value): ?string {
    $parts = parse_url($value);
    if (!$parts) return null;
    if (isset($parts['host']) && !in_array(strtolower($parts['host']), ['localhost','127.0.0.1','ticksecure.onrender.com'], true)) return null;
    $path = rawurldecode($parts['path'] ?? '');
    $path = preg_replace('~^/?ticksecure-ui/~', '', $path);
    $path = ltrim($path, '/');
    if (!preg_match('~^(uploads/posters|assets/images/collectibles)/[a-zA-Z0-9_.-]+\.(png|jpg)$~D', $path)) return null;
    $root = realpath(dirname(__DIR__));
    $file = realpath($root . '/' . $path);
    if (!$file || !is_file($file) || !str_starts_with(str_replace('\\','/',$file), str_replace('\\','/',$root) . '/')) return null;
    return $file;
}
function migration_urls(array $event): array {
    $urls = [(string)($event['posterUrl'] ?? '')];
    foreach ($event['categories'] ?? [] as $category) $urls[] = (string)($category['nftArtwork']['imageUrl'] ?? '');
    $urls[] = (string)($event['configurationDraft']['category']['nftArtwork']['imageUrl'] ?? '');
    return array_unique(array_filter($urls));
}
try {
    $apply = in_array('--apply', $argv, true);
    if ($apply) cloudinary_config();
    $db = new FirebaseAdminRest(firebase_backend_config());
    $events = $db->queryDocuments('Events', []);
    $count = 0; $missing = 0;
    foreach ($events as $event) {
        $eventId = (string)($event['id'] ?? '');
        $replacements = [];
        foreach (migration_urls($event) as $old) {
            $file = migration_local_image($old);
            if (!$file) {
                if (str_contains($old, 'uploads/posters/') || str_contains($old, 'localhost')) $missing++;
                continue;
            }
            $image = poster_inspect_image($file, filesize($file));
            $count++;
            if ($apply) $replacements[$old] = cloudinary_store_image($file, $eventId, $image);
        }
        if (!$replacements) continue;
        $db->transaction(static function(FirebaseFirestoreTransaction $tx) use ($eventId, $replacements): void {
            $current = $tx->get('Events', $eventId);
            if (!$current) return;
            $updates = [];
            if (isset($replacements[$current['posterUrl'] ?? ''])) $updates['posterUrl'] = $replacements[$current['posterUrl']];
            $categories = $current['categories'] ?? [];
            foreach ($categories as &$category) {
                $old = $category['nftArtwork']['imageUrl'] ?? '';
                if (isset($replacements[$old])) $category['nftArtwork']['imageUrl'] = $replacements[$old];
            }
            unset($category);
            if ($categories !== ($current['categories'] ?? [])) $updates['categories'] = $categories;
            $draft = $current['configurationDraft'] ?? [];
            $old = $draft['category']['nftArtwork']['imageUrl'] ?? '';
            if (isset($replacements[$old])) { $draft['category']['nftArtwork']['imageUrl'] = $replacements[$old]; $updates['configurationDraft'] = $draft; }
            if ($updates) { $updates['updatedAt'] = gmdate('Y-m-d\TH:i:s\Z'); $tx->update('Events', $eventId, $updates); }
        });
    }
    echo ($apply ? 'Migrated' : 'Dry run: found') . ' ' . $count . ' local image references. Missing local files: ' . $missing . PHP_EOL;
} catch (Throwable $error) {
    // No credentials or provider response bodies are printed.
    fwrite(STDERR, 'Migration stopped. ' . ($error instanceof FirebaseBackendException ? $error->getMessage() : 'Check the Firebase/Cloudinary configuration and retry.') . PHP_EOL);
    exit(1);
}
