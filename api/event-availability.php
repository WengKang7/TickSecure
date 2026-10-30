<?php
declare(strict_types=1);

/** Read-only public counts. Missing lazy inventory is available; active holds and sales are not. */
function backend_event_availability(array $event, array $physicalSeats, array $eventSeats, ?float $currentTime = null): array
{
    $currentTime ??= microtime(true);
    $physicalCounts = []; $physicalLabels = [];
    foreach ($physicalSeats as $seat) {
        if (($seat['venueId'] ?? '') === ($event['venueId'] ?? '')
            && !empty($seat['sectionId']) && trim((string)($seat['seatLabel'] ?? '')) !== '') {
            $physicalLabels[$seat['seatLabel']] = true;
            $id = (string)$seat['sectionId'];
            $physicalCounts[$id] = ($physicalCounts[$id] ?? 0) + 1;
        }
    }
    $blocked = [];
    foreach ($eventSeats as $seat) {
        if (($seat['eventId'] ?? '') !== $event['id'] || ($seat['venueId'] ?? '') !== ($event['venueId'] ?? '')) continue;
        $expiry = strtotime((string)($seat['reservationExpiry'] ?? ''));
        $reusable = ($seat['status'] ?? '') === 'AVAILABLE' || (($seat['status'] ?? '') === 'RESERVED'
            && !($expiry !== false && $expiry > $currentTime));
        if (!$reusable) {
            $id = (string)($seat['sectionId'] ?? '');
            $blocked[$id] = ($blocked[$id] ?? 0) + 1;
        }
    }
    $source = is_array($event['categories'] ?? null) ? $event['categories'] : [];
    $list = array_is_list($source);
    $categories = [];
    foreach ($source as $key => $category) {
        if (!is_array($category)) continue;
        $id = (string)($list ? ($category['sectionId'] ?? $category['section'] ?? $category['id'] ?? '') : $key);
        if ($id === '') continue;
        $value = $category['quantity'] ?? $category['available'] ?? 0;
        $allocated = is_numeric($value) ? max(0, (int)floor((float)$value)) : 0;
        $valid = ($physicalCounts[$id] ?? 0) >= $allocated;
        if (array_key_exists('seatLabels', $category)) {
            $chosen = $category['seatLabels']; $seen = [];
            $valid = is_array($chosen) && array_is_list($chosen) && count($chosen) === $allocated;
            if ($valid) foreach ($chosen as $label) {
                if (!is_string($label) || !isset($physicalLabels[$label]) || isset($seen[$label])) { $valid = false; break; }
                $seen[$label] = true;
            }
        }
        $capacity = $valid ? $allocated : 0;
        $categories[] = ['sectionId' => $id, 'allocated' => $allocated, 'remaining' => max(0, $capacity - ($blocked[$id] ?? 0))];
    }
    return ['eventId' => $event['id'], 'checkedAt' => gmdate('Y-m-d\TH:i:s\Z', (int)$currentTime),
        'categories' => $categories, 'remaining' => array_sum(array_column($categories, 'remaining'))];
}
