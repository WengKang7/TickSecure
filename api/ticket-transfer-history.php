<?php
declare(strict_types=1);

/** A transfer receipt contains only ticket facts and the two participants' display identities. */
function backend_transfer_receipt(array $ticket, array $event, array $sender, array $recipient, string $wallet, string $timestamp): array
{
    return [
        'ticketId' => (string)($ticket['id'] ?? ''),
        'eventId' => (string)($ticket['eventId'] ?? ''),
        'eventName' => (string)($ticket['eventName'] ?? $event['name'] ?? ''),
        'eventDate' => (string)($event['date'] ?? $ticket['eventDate'] ?? ''),
        'eventTime' => (string)($event['time'] ?? ''),
        'venueName' => (string)($event['venueName'] ?? $ticket['venueName'] ?? ''),
        'categoryName' => (string)($ticket['categoryName'] ?? ''),
        'sectionId' => (string)($ticket['sectionId'] ?? ''),
        'seatId' => (string)($ticket['seatId'] ?? ''),
        'fromName' => (string)($sender['fullName'] ?? $sender['displayName'] ?? ''),
        'toName' => (string)($recipient['fullName'] ?? $recipient['displayName'] ?? ''),
        'fromWallet' => (string)($ticket['walletAddress'] ?? ''),
        'toWallet' => $wallet,
        'timestamp' => $timestamp,
    ];
}

/** Read-only history. Audit logs stay private; only a participant's safe receipt is returned. */
function backend_get_ticket_transfers(FirebaseAdminRest $firebase, string $uid, array $data): array
{
    backend_assert_active_buyer(backend_get_current_actor($firebase, $uid));
    $ticketId = isset($data['ticketId']) ? backend_require_id($data['ticketId'], 'Ticket ID') : '';
    $transferId = isset($data['transferId']) ? backend_require_id($data['transferId'], 'Transfer ID') : '';
    $logs = $transferId !== '' ? [$firebase->getDocument('AuditLogs', $transferId)] : array_merge(
        $firebase->queryDocuments('AuditLogs', ['actorUid' => $uid]),
        $firebase->queryDocuments('AuditLogs', ['details.recipientUid' => $uid])
    );
    $records = []; $tickets = []; $profiles = []; $events = [];
    foreach ($logs as $log) {
        if (!$log || ($log['action'] ?? '') !== 'ticket_transferred' || ($log['entityType'] ?? '') !== 'ticket') continue;
        $fromUid = (string)($log['actorUid'] ?? ''); $toUid = (string)($log['details']['recipientUid'] ?? '');
        if ($fromUid === '' || $toUid === '') continue;
        if ($fromUid !== $uid && $toUid !== $uid) continue;
        $id = (string)($log['entityId'] ?? '');
        if ($ticketId !== '' && $id !== $ticketId) continue;
        if (!array_key_exists($id, $tickets)) $tickets[$id] = $firebase->getDocument('NFTTickets', $id);
        $ticket = $tickets[$id]; $snapshot = $log['details']['transfer'] ?? null;
        $legacy = !is_array($snapshot);
        if ($legacy) {
            // Older transfers already have durable audit entries. Recover the matching
            // history step without granting the former owner access to the current ticket.
            $history = array_values(array_filter(backend_transfer_history($ticket ?? []), static fn ($step): bool =>
                is_array($step) && ($step['fromUid'] ?? '') === $fromUid && ($step['toUid'] ?? '') === $toUid));
            $time = backend_policy_date_timestamp($log['timestamp'] ?? '') ?? 0;
            usort($history, static fn ($a, $b): int => abs((backend_policy_date_timestamp($a['timestamp'] ?? '') ?? 0) - $time) <=> abs((backend_policy_date_timestamp($b['timestamp'] ?? '') ?? 0) - $time));
            $step = $history[0] ?? [];
            foreach ([$fromUid, $toUid] as $participant) if (!array_key_exists($participant, $profiles)) $profiles[$participant] = $firebase->getDocument('Users', $participant) ?? [];
            $eventId = (string)($ticket['eventId'] ?? '');
            if ($eventId !== '' && !array_key_exists($eventId, $events)) $events[$eventId] = $firebase->getDocument('Events', $eventId) ?? [];
            $snapshot = backend_transfer_receipt(array_replace($ticket ?? [], ['id' => $id, 'walletAddress' => $step['fromWallet'] ?? '']),
                $events[$eventId] ?? [], $profiles[$fromUid], $profiles[$toUid], (string)($step['toWallet'] ?? ''), (string)($log['timestamp'] ?? ''));
        }
        // Explicit allowlist: never return audit emails, user profiles, booking data or QR material.
        $safe = [];
        foreach (['ticketId','eventId','eventName','eventDate','eventTime','venueName','categoryName','sectionId','seatId','fromName','toName','fromWallet','toWallet','timestamp'] as $key) {
            $safe[$key] = is_string($snapshot[$key] ?? null) ? $snapshot[$key] : '';
        }
        $logId = (string)($log['id'] ?? $transferId);
        $records[$logId] = $safe + ['id' => $logId, 'direction' => $fromUid === $uid ? 'SENT' : 'RECEIVED', 'status' => 'COMPLETED',
            'isCurrentOwner' => ($ticket['ownerUid'] ?? '') === $uid, 'legacy' => $legacy];
    }
    if ($transferId !== '' && !$records) backend_fail(404, 'Transfer record not found for your account.', 'not-found');
    $records = array_values($records);
    usort($records, static fn ($a,$b): int => strcmp($b['timestamp'], $a['timestamp']) ?: strcmp($b['id'], $a['id']));
    return ['records' => $records];
}
