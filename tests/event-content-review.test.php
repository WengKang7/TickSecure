<?php
declare(strict_types=1);
// Exercise real workflow logic with synthetic records; no network or database writes.
$fixture = file_get_contents(__DIR__ . '/resale-backend-fixture.php');
eval(substr($fixture, strpos($fixture, 'class FirebaseBackendException'), strpos($fixture, '$source =') - strpos($fixture, 'class FirebaseBackendException')));
require_once __DIR__ . '/../api/event-content-review.php';
$source = file_get_contents(__DIR__ . '/../api/backend.php');
$start = strpos($source, 'const BACKEND_SERVICE_CHARGE');
eval(substr($source, $start, strpos($source, 'if (!backend_is_enabled()') - $start));
function ensure(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function denied(callable $fn, string $code): void {
    try { $fn(); } catch (FirebaseBackendException $e) { ensure($e->errorCode === $code, $e->errorCode . ' expected ' . $code); return; }
    throw new RuntimeException('Expected ' . $code);
}
function fixture(): FirebaseAdminRest {
    return new FirebaseAdminRest([
        'Users/organizer' => ['role' => 'organizer', 'status' => 'active', 'emailVerified' => true],
        'Users/other' => ['role' => 'organizer', 'status' => 'active', 'emailVerified' => true],
        'Users/admin' => ['role' => 'admin', 'status' => 'active'],
        'Users/buyer' => ['role' => 'buyer', 'status' => 'active', 'emailVerified' => true],
        'Events/event' => ['name' => 'The Killers concert', 'description' => 'Live music at the hall.', 'organizerUid' => 'organizer', 'status' => 'DRAFT', 'categories' => [], 'statusHistory' => []],
    ]);
}
function answer(string $decision = 'PASS'): array {
    return ['decision' => $decision, 'reason' => $decision === 'PASS' ? 'Ordinary music event.' : 'Explicit invitation to harm attendees.', 'evidence' => $decision === 'PASS' ? [] : ['kill attendees'], 'model' => 'test-model'];
}
$tests = [];
$tests['private configuration accepts dotenv and bare-key files without accepting header injection'] = function () {
    $key = str_repeat('a', 25) . '.example';
    ensure(event_review_read_settings($key)['key'] === $key, 'bare key accepted');
    ensure(event_review_read_settings("\xEF\xBB\xBFGEMINI_API_KEY=\"$key\"\r\nGEMINI_MODEL=gemini-2.5-flash-lite\r\n")['key'] === $key, 'dotenv with BOM accepted');
    denied(fn () => event_review_read_settings("GEMINI_API_KEY=bad\r\nX-Injected: bad"), 'ai-not-configured');
    denied(fn () => event_review_read_settings(''), 'ai-not-configured');
};
$tests['safe submission awaits admin approval, never self-publishes'] = function () {
    $db = fixture(); $calls = 0;
    $service = new EventContentReview($db, function ($content) use (&$calls) { $calls++; ensure($content['name'] === 'The Killers concert', 'actual content'); return answer(); });
    $result = $service->run('organizer', 'event', true);
    ensure($result['status'] === 'PENDING_REVIEW' && $calls === 1, 'pending after one check');
    ensure($db->records['Events/event']['contentReview']['decision'] === 'PASS', 'safe summary');
    ensure(backend_moderate_event($db, 'admin', ['eventId' => 'event', 'status' => 'PUBLISHED'])['status'] === 'PUBLISHED', 'admin publishes');
};
$tests['harmful submission auto-rejects and records reason, history, audit and notification'] = function () {
    $db = fixture(); $db->records['Events/event']['description'] = 'Bring weapons and kill attendees.';
    $result = (new EventContentReview($db, fn () => answer('REJECT')))->run('organizer', 'event', true);
    ensure($result['status'] === 'REJECTED', 'automatic rejection');
    ensure(str_contains($db->records['Events/event']['rejectReason'], 'AI content review'), 'reason saved');
    ensure($db->records['Events/event']['statusHistory'][0]['changedBy'] === 'system:gemini', 'system history');
    ensure(count(array_filter($db->records, fn ($r) => ($r['type'] ?? '') === 'event_content_review')) === 1, 'notification');
    denied(fn () => backend_moderate_event($db, 'admin', ['eventId' => 'event', 'status' => 'PUBLISHED']), 'failed-precondition');
};
$tests['missing, forged, outdated and stale verdicts cannot authorize publishing'] = function () {
    foreach (['missing', 'reject', 'old-policy', 'changed-text', 'forged-summary', 'checking'] as $case) {
        $db = fixture(); $db->records['Events/event']['status'] = 'PENDING_REVIEW';
        $event = $db->records['Events/event'];
        $review = ['decision' => 'PASS', 'policyVersion' => EVENT_REVIEW_POLICY, 'contentHash' => event_review_hash($event)];
        if ($case === 'reject') $review['decision'] = 'REJECT';
        if ($case === 'checking') $review['decision'] = 'CHECKING';
        if ($case === 'old-policy') $review['policyVersion'] = 'old';
        if ($case === 'changed-text') $db->records['Events/event']['description'] = 'Changed after assessment';
        if (!in_array($case, ['missing', 'forged-summary'])) $db->records['EventContentReviews/event'] = $review;
        $db->records['Events/event']['contentReview'] = ['decision' => 'PASS'];
        denied(fn () => backend_moderate_event($db, 'admin', ['eventId' => 'event', 'status' => 'PUBLISHED']), 'ai-review-required');
    }
};
$tests['buyers, other organizers and inactive accounts cannot invoke or forge a check'] = function () {
    foreach (['buyer', 'other', 'admin', 'inactive'] as $uid) {
        $db = fixture(); $calls = 0;
        if ($uid === 'inactive') { $uid = 'organizer'; $db->records['Users/organizer']['status'] = 'inactive'; }
        denied(fn () => (new EventContentReview($db, function () use (&$calls) { $calls++; return answer(); }))->run($uid, 'event', true), 'permission-denied');
        ensure($calls === 0, 'no unauthorized provider call');
    }
};
$tests['provider failure and ambiguity leave draft unpublished with no false rejection'] = function () {
    $db = fixture();
    denied(fn () => (new EventContentReview($db, fn () => throw new RuntimeException('synthetic failure')))->run('organizer', 'event', true), 'ai-unavailable');
    ensure($db->records['Events/event']['status'] === 'DRAFT', 'still draft');
    ensure($db->records['EventContentReviews/event']['decision'] === 'ERROR', 'error recorded');
    ensure($db->records['EventContentReviews/event']['leaseUntil'] === 0, 'can retry');
    $result = (new EventContentReview($db, fn () => answer('REVIEW')))->run('organizer', 'event', true);
    ensure($result['status'] === 'DRAFT', 'ambiguity not published or rejected');
};
$tests['content changes during inference discard stale answer'] = function () {
    $db = fixture();
    denied(fn () => (new EventContentReview($db, function () use ($db) { $db->records['Events/event']['name'] = 'Changed event'; return answer(); }))->run('organizer', 'event', true), 'aborted');
    ensure($db->records['Events/event']['status'] === 'DRAFT', 'stale result not published');
    ensure($db->records['EventContentReviews/event']['decision'] === 'STALE', 'stale verdict recorded');
};
$tests['in-flight checks, request floods and unchanged resubmissions are bounded'] = function () {
    $db = fixture(); $db->records['EventContentReviews/event'] = ['leaseUntil' => time() + 30];
    denied(fn () => (new EventContentReview($db, fn () => answer()))->run('organizer', 'event', true), 'ai-busy');
    $db = fixture(); $db->records['EventReviewLimits/organizer'] = ['windowStart' => time(), 'count' => 5];
    denied(fn () => (new EventContentReview($db, fn () => answer()))->run('organizer', 'event', true), 'resource-exhausted');
    $db = fixture(); $service = new EventContentReview($db, fn () => answer()); $service->run('organizer', 'event', true);
    $db->records['Events/event']['status'] = 'DRAFT';
    $calls = 0;
    (new EventContentReview($db, function () use (&$calls) { $calls++; return answer(); }))->run('organizer', 'event', true);
    ensure($calls === 0, 'reuse exact reviewed content');
};
$tests['Gemini output is parsed strictly, handles safety blocks and verifies exact evidence'] = function () {
    $content = event_review_content(['name' => 'Die Another Day concert', 'description' => 'Soundtrack performance']);
    $response = fn ($result) => ['candidates' => [['finishReason' => 'STOP', 'content' => ['parts' => [['text' => json_encode($result)]]]]]];
    ensure(event_review_parse($response(answer()), $content, 'test')['decision'] === 'PASS', 'valid JSON');
    denied(fn () => event_review_parse($response(answer('REJECT')), $content, 'test'), 'ai-invalid-response');
    denied(fn () => event_review_parse(['promptFeedback' => ['blockReason' => 'SAFETY']], $content, 'test'), 'ai-unavailable');
    denied(fn () => event_review_parse($response(['decision' => 'PASS', 'reason' => 'Ok']), $content, 'test'), 'ai-invalid-response');
    $harm = event_review_content(['name' => 'kill attendees']);
    ensure(event_review_parse($response(answer('REJECT')), $harm, 'test')['decision'] === 'REJECT', 'anchored rejection');
};
foreach ($tests as $name => $test) { $test(); echo 'PASS ' . $name . PHP_EOL; }
echo count($tests) . ' event AI workflow checks passed.' . PHP_EOL;
