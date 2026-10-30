<?php
declare(strict_types=1);

/** Only safe, event-scoped availability reaches the buyer. */
function picker_visible_seat(array $seat, string $uid, array $fallback = [], ?int $now = null): array
{
    $active = strtotime((string)($seat['reservationExpiry'] ?? '')) > ($now ?? time());
    $state = $seat['status'] ?? '';
    $status = $state === 'RESERVED' ? ($active ? (($seat['reservedBy'] ?? '') === $uid ? 'MINE' : 'HELD') : 'AVAILABLE')
        : (in_array($state, ['AVAILABLE', 'SOLD'], true) ? $state : 'BLOCKED');
    $result = ['id' => $seat['id'], 'sectionId' => $seat['sectionId'], 'seatLabel' => $seat['seatLabel'], 'status' => $status,
        'row' => (string)($seat['rowLabel'] ?? $fallback['row'] ?? ''), 'number' => (string)($seat['seatNumber'] ?? $fallback['number'] ?? '')];
    $position = $seat['position'] ?? $fallback;
    if (isset($position['x'], $position['y']) && is_numeric($position['x']) && is_numeric($position['y'])
        && $position['x'] >= 0 && $position['x'] <= 104 && $position['y'] >= 0 && $position['y'] <= 106) {
        $result['position'] = ['x' => (float)$position['x'], 'y' => (float)$position['y'], 'page' => max(1, (int)($position['page'] ?? 1)),
            'width' => is_numeric($position['width'] ?? null) && $position['width'] > 0 ? (float)$position['width'] : 2.8,
            'height' => is_numeric($position['height'] ?? null) && $position['height'] > 0 ? (float)$position['height'] : 2.8,
            'rotation' => is_numeric($position['rotation'] ?? null) ? (float)$position['rotation'] : 0,
            'shape' => ($position['shape'] ?? '') === 'rect' ? 'rect' : 'circle'];
    }
    if ($status === 'MINE') $result['reservationExpiry'] = $seat['reservationExpiry'];
    return $result;
}

/** Only geometry is shared for other chairs; never inventory IDs or reservation data. */
function picker_layout_context(array $sections): array
{
    $result = []; $labels = [];
    foreach ($sections as $section) foreach ($section['geometry']['seatMarkers'] ?? [] as $marker) {
        if (count($result) >= 5000) return $result;
        if (empty($marker['label']) || empty($section['sectionId'])) continue;
        $label = $section['sectionId'] . '-' . $marker['label'];
        if (isset($labels[$label])) continue;
        $seat = picker_visible_seat(['id' => '', 'sectionId' => '', 'seatLabel' => $label, 'status' => 'BLOCKED'], '', array_merge($marker, ['page' => $section['geometry']['page'] ?? 1]));
        if (!isset($seat['position'])) continue;
        $labels[$label] = true;
        $result[] = ['seatLabel' => $label, 'number' => $seat['number'], 'position' => $seat['position']];
    }
    return $result;
}

function picker_check_selected(array $seats, array $ids, array $context): array
{
    $byId = array_column($seats, null, 'id'); $selected = [];
    foreach ($ids as $id) {
        $seat = $byId[$id] ?? null;
        if (!$seat || ($seat['eventId'] ?? '') !== $context['eventId'] || ($seat['venueId'] ?? '') !== $context['venueId'] || ($seat['sectionId'] ?? '') !== $context['sectionId']) {
            throw new FirebaseBackendException(400, 'A selected seat does not belong to this event and section.', 'invalid-argument');
        }
        if (($seat['status'] ?? '') !== 'AVAILABLE' && !(($seat['status'] ?? '') === 'RESERVED'
            && (!(strtotime((string)($seat['reservationExpiry'] ?? '')) > $context['now']) || ($seat['reservedBy'] ?? '') === $context['uid']))) {
            throw new FirebaseBackendException(409, 'A selected seat was just taken. Refresh the map and choose another seat.', 'already-exists');
        }
        $selected[] = $seat;
    }
    return $selected;
}
