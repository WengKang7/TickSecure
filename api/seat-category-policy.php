<?php
declare(strict_types=1);

/** Resolve exact event allocations before creating any inventory. */
function category_allocate_seats(array $categories, array $physicalSeats): array
{
    if ($categories === []) throw new RuntimeException('This event has no ticket inventory configured.');
    $labels = [];
    foreach ($physicalSeats as $seat) $labels[$seat['seatLabel']] = $seat;
    $result = []; $claimed = [];
    foreach ($categories as $key => $category) {
        if (!is_array($category)) throw new RuntimeException('Invalid ticket category configuration.');
        $sectionId = array_is_list($categories) ? ($category['sectionId'] ?? $category['section'] ?? $category['id'] ?? '') : (string)$key;
        $quantity = $category['quantity'] ?? $category['available'] ?? 0;
        if (!preg_match('/^[A-Za-z0-9_-]{1,160}$/D', $sectionId) || !is_numeric($quantity) || (float)$quantity !== (float)(int)$quantity
            || $quantity < 1 || $quantity > 100000 || !is_string($category['name'] ?? null) || !trim($category['name'])
            || !is_numeric($category['price'] ?? null) || !is_finite((float)$category['price']) || $category['price'] <= 0) throw new RuntimeException('Invalid ticket category configuration.');
        if (array_key_exists('seatLabels', $category)) {
            $chosen = $category['seatLabels'];
            if (!is_array($chosen) || !array_is_list($chosen) || count($chosen) !== (int)$quantity) throw new RuntimeException('Category quantity must match its unique physical seat labels.');
            $seen = []; $seats = [];
            foreach ($chosen as $label) {
                if (!is_string($label) || $label === '' || strlen($label) > 160 || isset($seen[$label])) throw new RuntimeException('Category quantity must match its unique physical seat labels.');
                if (!isset($labels[$label])) throw new RuntimeException('A category references a seat outside this venue.');
                $seen[$label] = true; $seats[] = $labels[$label];
            }
        } else {
            $seats = array_values(array_filter($physicalSeats, static fn(array $seat): bool => $seat['sectionId'] === $sectionId));
            usort($seats, static fn(array $a, array $b): int => strcmp($a['seatLabel'], $b['seatLabel']));
            $seats = array_slice($seats, 0, (int)$quantity);
            if (count($seats) !== (int)$quantity) throw new RuntimeException("The {$sectionId} allocation exceeds the venue's physical seats.");
        }
        foreach ($seats as $seat) {
            if (isset($claimed[$seat['id']])) throw new RuntimeException('A physical seat belongs to more than one ticket category.');
            $claimed[$seat['id']] = true;
            $result[] = ['sectionId' => $sectionId, 'sourceSeat' => $seat];
        }
    }
    return $result;
}
