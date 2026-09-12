<?php
declare(strict_types=1);

/**
 * Small, dependency-free Firebase Admin REST bridge for a local XAMPP demo.
 *
 * It intentionally keeps the service-account file outside the web root. This
 * gives PHP trusted Firestore access without deploying Cloud Functions, while
 * Firebase Auth ID tokens still identify every browser caller.
 */

final class FirebaseBackendException extends RuntimeException
{
    public function __construct(
        public readonly int $httpStatus,
        string $message,
        public readonly string $errorCode = 'backend_error'
    ) {
        parent::__construct($message);
    }
}

function firebase_base64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function firebase_base64url_decode(string $value): string
{
    $padding = strlen($value) % 4;
    if ($padding !== 0) {
        $value .= str_repeat('=', 4 - $padding);
    }
    $decoded = base64_decode(strtr($value, '-_', '+/'), true);
    if ($decoded === false) {
        throw new FirebaseBackendException(401, 'The authentication token is malformed.', 'unauthenticated');
    }
    return $decoded;
}

/** @return array{projectId:string,serviceAccountPath:string} */
function firebase_backend_config(): array
{
    $localConfig = __DIR__ . '/firebase-config.local.php';
    if (!is_file($localConfig)) {
        throw new FirebaseBackendException(
            503,
            'PHP Firebase mode is not configured. Copy api/firebase-config.example.php to api/firebase-config.local.php and set a private service-account path.',
            'backend_not_configured'
        );
    }

    /** @var mixed $config */
    $config = require $localConfig;
    if (!is_array($config)) {
        throw new FirebaseBackendException(503, 'The PHP Firebase configuration is invalid.', 'backend_not_configured');
    }

    $projectId = trim((string)($config['projectId'] ?? ''));
    $configuredPath = trim((string)($config['serviceAccountPath'] ?? ''));
    $serviceAccountPath = $configuredPath !== '' ? realpath($configuredPath) : false;
    $projectRoot = realpath(dirname(__DIR__));
    $normalizedProjectRoot = $projectRoot === false
        ? ''
        : rtrim(str_replace('\\', '/', strtolower($projectRoot)), '/') . '/';
    $normalizedCredentialPath = $serviceAccountPath === false
        ? ''
        : str_replace('\\', '/', strtolower($serviceAccountPath));

    if ($projectId === '' || $serviceAccountPath === false || !is_file($serviceAccountPath)) {
        throw new FirebaseBackendException(
            503,
            'PHP Firebase mode needs a project ID and a readable service-account JSON file outside the web root.',
            'backend_not_configured'
        );
    }

    // A credential under htdocs could be downloaded if Apache is ever
    // misconfigured. Refuse that layout instead of relying on documentation.
    if ($normalizedProjectRoot !== '' && str_starts_with($normalizedCredentialPath, $normalizedProjectRoot)) {
        throw new FirebaseBackendException(
            503,
            'The Firebase service-account JSON must be stored outside this project web root.',
            'backend_not_configured'
        );
    }

    return ['projectId' => $projectId, 'serviceAccountPath' => $serviceAccountPath];
}

final class FirebaseAdminRest
{
    private string $projectId;
    private array $serviceAccount;
    private string $databaseUrl;
    private ?string $accessToken = null;
    private int $accessTokenExpiresAt = 0;
    private ?array $publicCertificates = null;

    /** @param array{projectId:string,serviceAccountPath:string} $config */
    public function __construct(array $config)
    {
        if (!function_exists('curl_init') || !function_exists('openssl_sign')) {
            throw new FirebaseBackendException(503, 'PHP Firebase mode requires the curl and openssl PHP extensions.', 'backend_unavailable');
        }

        $raw = file_get_contents($config['serviceAccountPath']);
        $serviceAccount = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($serviceAccount)
            || empty($serviceAccount['client_email'])
            || empty($serviceAccount['private_key'])
            || empty($serviceAccount['token_uri'])) {
            throw new FirebaseBackendException(503, 'The Firebase service-account JSON is invalid.', 'backend_not_configured');
        }
        if (!empty($serviceAccount['project_id']) && (string)$serviceAccount['project_id'] !== $config['projectId']) {
            throw new FirebaseBackendException(
                503,
                'The service-account project does not match the configured Firebase project.',
                'backend_not_configured'
            );
        }

        $this->projectId = $config['projectId'];
        $this->serviceAccount = $serviceAccount;
        $this->databaseUrl = 'https://firestore.googleapis.com/v1/projects/'
            . rawurlencode($this->projectId) . '/databases/(default)';
    }

    public function projectId(): string
    {
        return $this->projectId;
    }

    /** @return array<string,mixed> */
    public function verifyIdToken(string $idToken): array
    {
        $parts = explode('.', $idToken);
        if (count($parts) !== 3) {
            throw new FirebaseBackendException(401, 'Sign in before using this action.', 'unauthenticated');
        }

        try {
            $header = json_decode(firebase_base64url_decode($parts[0]), true, 512, JSON_THROW_ON_ERROR);
            $payload = json_decode(firebase_base64url_decode($parts[1]), true, 512, JSON_THROW_ON_ERROR);
            $signature = firebase_base64url_decode($parts[2]);
        } catch (Throwable) {
            throw new FirebaseBackendException(401, 'The authentication token is malformed.', 'unauthenticated');
        }

        $keyId = (string)($header['kid'] ?? '');
        $certificates = $this->publicCertificates();
        $certificate = $certificates[$keyId] ?? null;
        if (!is_string($certificate) || $certificate === '') {
            throw new FirebaseBackendException(401, 'The authentication token signing key is unavailable. Refresh your sign-in and try again.', 'unauthenticated');
        }

        $verified = openssl_verify(
            $parts[0] . '.' . $parts[1],
            $signature,
            $certificate,
            OPENSSL_ALGO_SHA256
        );
        if ($verified !== 1) {
            throw new FirebaseBackendException(401, 'The authentication token is invalid.', 'unauthenticated');
        }

        $now = time();
        $issuer = 'https://securetoken.google.com/' . $this->projectId;
        if (($payload['aud'] ?? '') !== $this->projectId
            || ($payload['iss'] ?? '') !== $issuer
            || empty($payload['sub'])
            || !is_string($payload['sub'])
            || (int)($payload['exp'] ?? 0) <= $now
            || (int)($payload['iat'] ?? 0) > $now + 300) {
            throw new FirebaseBackendException(401, 'The authentication token has expired or is not valid for this project.', 'unauthenticated');
        }

        return $payload;
    }

    /** @return array<string,string> */
    private function publicCertificates(): array
    {
        if ($this->publicCertificates !== null) {
            return $this->publicCertificates;
        }

        [, $body] = $this->httpRequest(
            'GET',
            'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
            null,
            []
        );
        $certificates = json_decode($body, true);
        if (!is_array($certificates)) {
            throw new FirebaseBackendException(503, 'Firebase Auth signing certificates could not be loaded.', 'backend_unavailable');
        }
        $this->publicCertificates = $certificates;
        return $certificates;
    }

    /** @return array{0:int,1:string} */
    private function httpRequest(string $method, string $url, ?string $body, array $headers): array
    {
        $handle = curl_init($url);
        if ($handle === false) {
            throw new FirebaseBackendException(503, 'Unable to initialize the local backend HTTP client.', 'backend_unavailable');
        }

        $requestHeaders = array_merge(['Accept: application/json'], $headers);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $requestHeaders,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 30,
        ]);
        if ($body !== null) {
            curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
        }

        $response = curl_exec($handle);
        $curlError = curl_error($handle);
        $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);

        if ($response === false) {
            throw new FirebaseBackendException(503, 'The local backend could not reach Firebase: ' . $curlError, 'backend_unavailable');
        }
        return [$status, (string)$response];
    }

    /** @return array<string,mixed> */
    private function adminJsonRequest(string $method, string $url, ?array $payload = null): array
    {
        $headers = ['Authorization: Bearer ' . $this->accessToken()];
        $body = null;
        if ($payload !== null) {
            $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            $body = $encoded;
            $headers[] = 'Content-Type: application/json';
        }

        [$status, $response] = $this->httpRequest($method, $url, $body, $headers);
        $decoded = $response === '' ? [] : json_decode($response, true);
        if ($status < 200 || $status >= 300) {
            $message = is_array($decoded) ? (string)($decoded['error']['message'] ?? '') : '';
            $code = is_array($decoded) ? (string)($decoded['error']['status'] ?? '') : '';
            throw new FirebaseBackendException(
                $status ?: 503,
                $message !== '' ? $message : 'Firebase rejected the local backend request.',
                $code !== '' ? strtolower($code) : 'firebase_request_failed'
            );
        }
        if (!is_array($decoded)) {
            throw new FirebaseBackendException(503, 'Firebase returned an unreadable response.', 'backend_unavailable');
        }
        return $decoded;
    }

    private function accessToken(): string
    {
        if ($this->accessToken !== null && $this->accessTokenExpiresAt > time() + 60) {
            return $this->accessToken;
        }

        $issuedAt = time();
        $assertionHeader = firebase_base64url_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
        $assertionPayload = firebase_base64url_encode(json_encode([
            'iss' => $this->serviceAccount['client_email'],
            'scope' => 'https://www.googleapis.com/auth/datastore',
            'aud' => $this->serviceAccount['token_uri'],
            'iat' => $issuedAt,
            'exp' => $issuedAt + 3600,
        ], JSON_THROW_ON_ERROR));
        $unsigned = $assertionHeader . '.' . $assertionPayload;
        $signature = '';
        if (!openssl_sign($unsigned, $signature, $this->serviceAccount['private_key'], OPENSSL_ALGO_SHA256)) {
            throw new FirebaseBackendException(503, 'The Firebase service-account private key could not sign a request.', 'backend_not_configured');
        }

        $form = http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $unsigned . '.' . firebase_base64url_encode($signature),
        ]);
        [$status, $response] = $this->httpRequest(
            'POST',
            (string)$this->serviceAccount['token_uri'],
            $form,
            ['Content-Type: application/x-www-form-urlencoded']
        );
        $decoded = json_decode($response, true);
        if ($status < 200 || $status >= 300 || !is_array($decoded) || empty($decoded['access_token'])) {
            throw new FirebaseBackendException(503, 'The local backend could not obtain Firebase Admin access.', 'backend_not_configured');
        }

        $this->accessToken = (string)$decoded['access_token'];
        $this->accessTokenExpiresAt = time() + max(60, (int)($decoded['expires_in'] ?? 3600));
        return $this->accessToken;
    }

    private function documentName(string $collection, string $id): string
    {
        return $this->databaseUrl . '/documents/' . rawurlencode($collection) . '/' . rawurlencode($id);
    }

    /** @return array<string,mixed>|null */
    public function getDocument(string $collection, string $id, ?string $transaction = null): ?array
    {
        $url = $this->documentName($collection, $id);
        if ($transaction !== null) {
            $url .= '?transaction=' . rawurlencode($transaction);
        }
        try {
            $document = $this->adminJsonRequest('GET', $url);
        } catch (FirebaseBackendException $error) {
            if ($error->httpStatus === 404) {
                return null;
            }
            throw $error;
        }
        return self::decodeDocument($document);
    }

    /**
     * Reads a small group of documents in one Firestore batchGet request.
     * Firestore returns batchGet as a JSON stream, so this deliberately does
     * not use adminJsonRequest(), which expects a single JSON object.
     *
     * @param list<string> $ids
     * @return array<string,array<string,mixed>|null>
     */
    public function getDocuments(string $collection, array $ids, ?string $transaction = null): array
    {
        $uniqueIds = array_values(array_unique(array_filter(
            array_map(static fn (mixed $id): string => trim((string)$id), $ids),
            static fn (string $id): bool => $id !== ''
        )));
        if ($uniqueIds === []) {
            return [];
        }

        $payload = [
            'documents' => array_map(
                fn (string $id): string => $this->documentName($collection, $id),
                $uniqueIds
            ),
        ];
        if ($transaction !== null) {
            $payload['transaction'] = $transaction;
        }

        [$status, $response] = $this->httpRequest(
            'POST',
            $this->databaseUrl . '/documents:batchGet',
            json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            [
                'Authorization: Bearer ' . $this->accessToken(),
                'Content-Type: application/json',
            ]
        );
        if ($status < 200 || $status >= 300) {
            $error = json_decode($response, true);
            throw new FirebaseBackendException(
                $status ?: 503,
                (string)($error['error']['message'] ?? 'Firestore batch read failed.'),
                strtolower((string)($error['error']['status'] ?? 'firebase_batch_read_failed'))
            );
        }

        $documents = array_fill_keys($uniqueIds, null);
        $records = [];
        $asSingleJson = json_decode($response, true);
        if (is_array($asSingleJson) && array_is_list($asSingleJson)) {
            $records = $asSingleJson;
        } else {
            foreach (preg_split('/\r?\n/', trim($response)) ?: [] as $line) {
                $decoded = json_decode(trim($line), true);
                if (is_array($decoded)) {
                    $records[] = $decoded;
                }
            }
        }

        foreach ($records as $record) {
            if (isset($record['found']) && is_array($record['found'])) {
                $decoded = self::decodeDocument($record['found']);
                if ($decoded['id'] !== '') {
                    $documents[$decoded['id']] = $decoded;
                }
                continue;
            }
            if (isset($record['missing']) && is_string($record['missing'])) {
                $parts = explode('/', $record['missing']);
                $missingId = (string)(end($parts) ?: '');
                if ($missingId !== '') {
                    $documents[$missingId] = null;
                }
            }
        }

        return $documents;
    }

    /** @param array<string,mixed> $filters @param list<array{field:string,direction?:string}> $orderBy @return list<array<string,mixed>> */
    public function queryDocuments(string $collection, array $filters = [], array $orderBy = [], ?int $limit = null, ?string $transaction = null): array
    {
        $structuredQuery = ['from' => [['collectionId' => $collection]]];
        $filterParts = [];
        foreach ($filters as $field => $value) {
            $filterParts[] = [
                'fieldFilter' => [
                    'field' => ['fieldPath' => (string)$field],
                    'op' => 'EQUAL',
                    'value' => self::encodeValue($value),
                ],
            ];
        }
        if (count($filterParts) === 1) {
            $structuredQuery['where'] = $filterParts[0];
        } elseif (count($filterParts) > 1) {
            $structuredQuery['where'] = ['compositeFilter' => ['op' => 'AND', 'filters' => $filterParts]];
        }
        if ($orderBy !== []) {
            $structuredQuery['orderBy'] = array_map(static fn (array $part): array => [
                'field' => ['fieldPath' => $part['field']],
                'direction' => strtoupper((string)($part['direction'] ?? 'ASCENDING')),
            ], $orderBy);
        }
        if ($limit !== null) {
            $structuredQuery['limit'] = $limit;
        }

        $payload = ['structuredQuery' => $structuredQuery];
        if ($transaction !== null) {
            $payload['transaction'] = $transaction;
        }
        $url = $this->databaseUrl . '/documents:runQuery';
        $headers = [
            'Authorization: Bearer ' . $this->accessToken(),
            'Content-Type: application/json',
        ];
        [$status, $response] = $this->httpRequest('POST', $url, json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), $headers);
        if ($status < 200 || $status >= 300) {
            $error = json_decode($response, true);
            throw new FirebaseBackendException(
                $status ?: 503,
                (string)($error['error']['message'] ?? 'Firestore query failed.'),
                strtolower((string)($error['error']['status'] ?? 'firebase_query_failed'))
            );
        }

        $records = json_decode($response, true);
        if (!is_array($records) || !array_is_list($records)) {
            $records = [];
            foreach (preg_split('/\r?\n/', trim($response)) ?: [] as $line) {
                $line = trim($line);
                if ($line === '') {
                    continue;
                }
                $decoded = json_decode($line, true);
                if (is_array($decoded)) {
                    $records[] = $decoded;
                }
            }
        }

        $documents = [];
        foreach ($records as $record) {
            if (isset($record['document']) && is_array($record['document'])) {
                $documents[] = self::decodeDocument($record['document']);
            }
        }
        return $documents;
    }

    public function transaction(callable $callback): mixed
    {
        $lastError = null;
        for ($attempt = 0; $attempt < 4; $attempt += 1) {
            $started = $this->adminJsonRequest('POST', $this->databaseUrl . '/documents:beginTransaction', []);
            $transaction = (string)($started['transaction'] ?? '');
            if ($transaction === '') {
                throw new FirebaseBackendException(503, 'Firestore did not start a transaction.', 'backend_unavailable');
            }

            try {
                $context = new FirebaseFirestoreTransaction($this, $transaction);
                $result = $callback($context);
                $this->adminJsonRequest('POST', $this->databaseUrl . '/documents:commit', [
                    'transaction' => $transaction,
                    'writes' => $context->writes(),
                ]);
                return $result;
            } catch (FirebaseBackendException $error) {
                $lastError = $error;
                if ($error->httpStatus !== 409 && $error->errorCode !== 'aborted') {
                    throw $error;
                }
            }
        }

        throw $lastError instanceof Throwable
            ? $lastError
            : new FirebaseBackendException(409, 'The transaction changed too quickly. Please try again.', 'aborted');
    }

    /** @param array<string,mixed> $fields @return array<string,mixed> */
    public function createWrite(string $collection, string $id, array $fields): array
    {
        return [
            'update' => ['name' => $this->documentName($collection, $id), 'fields' => self::encodeFields($fields)],
            'currentDocument' => ['exists' => false],
        ];
    }

    /** @param array<string,mixed> $fields @return array<string,mixed> */
    public function updateWrite(string $collection, string $id, array $fields): array
    {
        return [
            'update' => ['name' => $this->documentName($collection, $id), 'fields' => self::encodeFields($fields)],
            'updateMask' => ['fieldPaths' => array_keys($fields)],
            // Match Firestore SDK transaction.update(): a missing document
            // must fail, never turn into an unexpected partial create.
            'currentDocument' => ['exists' => true],
        ];
    }

    /** @param array<string,mixed> $document @return array<string,mixed> */
    private static function decodeDocument(array $document): array
    {
        $name = (string)($document['name'] ?? '');
        $parts = explode('/', $name);
        $id = end($parts) ?: '';
        return ['id' => $id, ...self::decodeFields((array)($document['fields'] ?? []))];
    }

    /** @param array<string,mixed> $fields @return array<string,mixed> */
    private static function decodeFields(array $fields): array
    {
        $decoded = [];
        foreach ($fields as $key => $value) {
            $decoded[(string)$key] = self::decodeValue((array)$value);
        }
        return $decoded;
    }

    /** @param array<string,mixed> $value */
    private static function decodeValue(array $value): mixed
    {
        if (array_key_exists('nullValue', $value)) {
            return null;
        }
        if (array_key_exists('stringValue', $value)) {
            return (string)$value['stringValue'];
        }
        if (array_key_exists('booleanValue', $value)) {
            return (bool)$value['booleanValue'];
        }
        if (array_key_exists('integerValue', $value)) {
            return (int)$value['integerValue'];
        }
        if (array_key_exists('doubleValue', $value)) {
            return (float)$value['doubleValue'];
        }
        if (array_key_exists('timestampValue', $value)) {
            return (string)$value['timestampValue'];
        }
        if (isset($value['arrayValue'])) {
            return array_map(static fn (array $entry): mixed => self::decodeValue($entry), (array)($value['arrayValue']['values'] ?? []));
        }
        if (isset($value['mapValue'])) {
            return self::decodeFields((array)($value['mapValue']['fields'] ?? []));
        }
        return '';
    }

    /** @param array<string,mixed> $fields @return array<string,mixed> */
    private static function encodeFields(array $fields): array
    {
        $encoded = [];
        foreach ($fields as $key => $value) {
            $encoded[(string)$key] = self::encodeValue($value);
        }
        return $encoded;
    }

    /** @return array<string,mixed> */
    public static function encodeValue(mixed $value): array
    {
        if ($value === null) {
            return ['nullValue' => null];
        }
        if (is_bool($value)) {
            return ['booleanValue' => $value];
        }
        if (is_int($value)) {
            return ['integerValue' => (string)$value];
        }
        if (is_float($value)) {
            return ['doubleValue' => $value];
        }
        if (is_string($value)) {
            return ['stringValue' => $value];
        }
        if (is_array($value)) {
            if (array_is_list($value)) {
                return ['arrayValue' => ['values' => array_map(static fn (mixed $entry): array => self::encodeValue($entry), $value)]];
            }
            return ['mapValue' => ['fields' => self::encodeFields($value)]];
        }
        throw new FirebaseBackendException(500, 'The PHP backend received an unsupported Firestore value.', 'backend_error');
    }
}

final class FirebaseFirestoreTransaction
{
    /** @var list<array<string,mixed>> */
    private array $pendingWrites = [];

    public function __construct(
        private readonly FirebaseAdminRest $firebase,
        private readonly string $transactionId
    ) {
    }

    /** @return array<string,mixed>|null */
    public function get(string $collection, string $id): ?array
    {
        return $this->firebase->getDocument($collection, $id, $this->transactionId);
    }

    /** @param list<string> $ids @return array<string,array<string,mixed>|null> */
    public function getMany(string $collection, array $ids): array
    {
        return $this->firebase->getDocuments($collection, $ids, $this->transactionId);
    }

    /** @param array<string,mixed> $filters @param list<array{field:string,direction?:string}> $orderBy @return list<array<string,mixed>> */
    public function query(string $collection, array $filters = [], array $orderBy = [], ?int $limit = null): array
    {
        return $this->firebase->queryDocuments($collection, $filters, $orderBy, $limit, $this->transactionId);
    }

    /** @param array<string,mixed> $fields */
    public function create(string $collection, string $id, array $fields): void
    {
        $this->pendingWrites[] = $this->firebase->createWrite($collection, $id, $fields);
    }

    /** @param array<string,mixed> $fields */
    public function update(string $collection, string $id, array $fields): void
    {
        $this->pendingWrites[] = $this->firebase->updateWrite($collection, $id, $fields);
    }

    /** @return list<array<string,mixed>> */
    public function writes(): array
    {
        return $this->pendingWrites;
    }
}
