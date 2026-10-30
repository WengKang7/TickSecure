<?php
// In-memory transaction fixture: runs the actual PHP workflow functions,
// without a service account, Firebase access or changes to real records.
class FirebaseBackendException extends RuntimeException {
    public function __construct(public int $httpStatus, string $message, public string $errorCode) { parent::__construct($message); }
}
class FirebaseAdminRest {
    public function __construct(public array $records) {}
    public function getDocument(string $collection, string $id): ?array {
        $record = $this->records[$collection . '/' . $id] ?? null;
        return $record === null ? null : ['id' => $id] + $record;
    }
    public function queryDocuments(string $collection, array $filters = [], array $orderBy = [], ?int $limit = null): array {
        return (new FirebaseFirestoreTransaction($this->records))->query($collection, $filters, $orderBy, $limit);
    }
    public function transaction(callable $callback): mixed {
        $tx = new FirebaseFirestoreTransaction($this->records);
        $result = $callback($tx);
        $this->records = $tx->records;
        return $result;
    }
}
class FirebaseFirestoreTransaction {
    private bool $writing = false;
    public function __construct(public array $records) {}
    public function get(string $collection, string $id): ?array {
        if ($this->writing) throw new RuntimeException('Read after write');
        return $this->records[$collection . '/' . $id] ?? null;
    }
    public function query(string $collection, array $filters = [], array $orderBy = [], ?int $limit = null): array {
        if ($this->writing) throw new RuntimeException('Read after write');
        $items = [];
        foreach ($this->records as $key => $value) {
            if (!str_starts_with($key, $collection . '/')) continue;
            foreach ($filters as $field => $expected) {
                $actual = $value;
                foreach (explode('.', $field) as $part) $actual = is_array($actual) ? ($actual[$part] ?? null) : null;
                if ($actual !== $expected) continue 2;
            }
            $items[] = ['id' => substr($key, strlen($collection) + 1)] + $value;
            if ($limit !== null && count($items) >= $limit) break;
        }
        return $items;
    }
    public function create(string $collection, string $id, array $fields): void {
        $this->writing = true; $this->records[$collection . '/' . $id] = $fields;
    }
    public function update(string $collection, string $id, array $fields): void {
        $this->writing = true;
        $key = $collection . '/' . $id;
        if (!isset($this->records[$key])) throw new RuntimeException('Missing update target');
        $this->records[$key] = array_replace($this->records[$key], $fields);
    }
}
$source = file_get_contents(__DIR__ . '/../api/backend.php');
require_once __DIR__ . '/../api/ticket-transfer-history.php';
$start = strpos($source, 'const BACKEND_SERVICE_CHARGE');
$end = strpos($source, 'if (!backend_is_enabled()');
eval(substr($source, $start, $end - $start));
$cases = json_decode(stream_get_contents(STDIN), true, 64, JSON_THROW_ON_ERROR);
$results = [];
foreach ($cases as $case) {
    $firebase = new FirebaseAdminRest($case['records']);
    try {
        $result = match ($case['action']) {
            'transferTicket' => backend_transfer_ticket($firebase, $case['uid'], $case['data']),
            'getTicketTransfers' => backend_get_ticket_transfers($firebase, $case['uid'], $case['data']),
            'scanTicket' => backend_scan_ticket($firebase, $case['uid'], $case['data']),
            'createResaleListing' => backend_create_resale_listing($firebase, $case['uid'], $case['data']),
            'updateResalePrice' => backend_update_resale_price($firebase, $case['uid'], $case['data']),
            'cancelResaleListing' => backend_cancel_resale_listing($firebase, $case['uid'], $case['data']),
            'suspendResaleListing' => backend_suspend_resale_listing($firebase, $case['uid'], $case['data']),
            'purchaseResale' => backend_purchase_resale($firebase, $case['uid'], $case['data'])
        };
        $results[] = ['result' => $result, 'records' => $firebase->records];
    } catch (FirebaseBackendException $error) {
        $results[] = ['error' => $error->errorCode, 'records' => $firebase->records];
    }
}
echo json_encode($results, JSON_THROW_ON_ERROR);
