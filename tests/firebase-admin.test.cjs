const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

test('Firestore writes use canonical document resource names rather than HTTP URLs', () => {
    const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
    const output = execFileSync(php, ['-r', `
        require $argv[1];
        $reflection = new ReflectionClass(FirebaseAdminRest::class);
        $firebase = $reflection->newInstanceWithoutConstructor();
        $reflection->getProperty('projectId')->setValue($firebase, 'test-project');
        echo json_encode([
            $firebase->createWrite('EventSeats', 'event_A01', ['status'=>'AVAILABLE']),
            $firebase->updateWrite('EventSeats', 'event_A01', ['status'=>'SOLD'])
        ]);
    `, path.join(__dirname, '../api/firebase-admin.php')], { encoding: 'utf8' });
    const writes = JSON.parse(output);
    for (const write of writes) assert.equal(write.update.name, 'projects/test-project/databases/(default)/documents/EventSeats/event_A01');
    assert.equal(writes[0].currentDocument.exists, false);
    assert.equal(writes[1].currentDocument.exists, true);
    assert.deepEqual(writes[1].updateMask.fieldPaths, ['status']);
});

test('local sale timestamps use the product timezone independently of the PHP server timezone', () => {
    const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
    const source = fs.readFileSync(path.join(__dirname, '../api/backend.php'), 'utf8');
    const policy = source.match(/function backend_policy_date_timestamp\([\s\S]*?\r?\n\}/)[0];
    const output = execFileSync(php, ['-r', policy + `
        date_default_timezone_set('Europe/Berlin');
        echo json_encode([
            backend_policy_date_timestamp('2026-10-23T16:00'),
            backend_policy_date_timestamp('2026-10-23T08:00Z'),
            backend_policy_date_timestamp('2026-10-23', true)
        ]);
    `], { encoding: 'utf8' });
    const [local, utc, end] = JSON.parse(output);
    assert.equal(local, utc);
    assert.equal(end, Date.parse('2026-10-23T23:59:59.999+08:00') / 1000);
});
