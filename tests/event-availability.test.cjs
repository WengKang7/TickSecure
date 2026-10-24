const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { eventAvailability } = require('../functions/event-availability');
const root = path.resolve(__dirname, '..');
const currentTime = Date.parse('2026-10-23T12:00:00Z');
const event = { id: 'event', venueId: 'venue', categories: {
    A: { quantity: 5 }, B: { quantity: 3 }, C: { quantity: 0 }, D: { quantity: 4 }
} };
const physical = ['A', 'B', 'C', 'D'].flatMap(sectionId => Array.from({ length: 3 }, (_, index) => ({
    venueId: 'venue', sectionId, seatLabel: sectionId + index
})));
// A has five physical seats; D is misconfigured and must not claim availability.
physical.push({ venueId: 'venue', sectionId: 'A', seatLabel: 'A3' }, { venueId: 'venue', sectionId: 'A', seatLabel: 'A4' });
const seat = (sectionId, status, extra = {}) => ({
    eventId: 'event', venueId: 'venue', sectionId, status, reservedBy: 'private-buyer', id: 'private-seat', ...extra
});

function phpAvailability(input) {
    return JSON.parse(execFileSync('C:/xampp/php/php.exe', ['-r',
        'require $argv[1]; $i=json_decode(stream_get_contents(STDIN),true); echo json_encode(backend_event_availability($i[0],$i[1],$i[2],$i[3]/1000));',
        path.join(root, 'api/event-availability.php')], { input: JSON.stringify(input), encoding: 'utf8' }));
}

for (const [name, inventory, expected] of [
    ['uninitialized inventory uses allocation and physical seats without writes', [], [5, 3, 0, 0]],
    ['sold and active reservations reduce counts; expired reservations are reusable', [
        seat('A', 'SOLD'), seat('A', 'RESERVED', { reservationExpiry: '2026-10-23T12:01:00Z' }),
        seat('A', 'RESERVED', { reservationExpiry: '2026-10-23T11:59:00Z' }), seat('A', 'AVAILABLE'),
        seat('B', 'RESERVED', { reservationExpiry: '2026-10-23T12:00:00Z' }),
        seat('B', 'SOLD', { eventId: 'other-event' }), seat('B', 'SOLD', { venueId: 'other-venue' })
    ], [3, 3, 0, 0]],
    ['unknown states are unavailable and counts cannot become negative', [
        seat('B', 'SOLD'), seat('B', 'SOLD'), seat('B', 'SOLD'), seat('B', 'SOLD'), seat('A', 'BLOCKED')
    ], [4, 0, 0, 0]]
]) {
    test('PHP and Functions: ' + name, () => {
        const input = [event, physical, inventory, currentTime];
        const js = eventAvailability(...input);
        const php = phpAvailability(input);
        for (const result of [js, php]) {
            assert.deepEqual(result.categories.map(category => category.remaining), expected);
            assert.equal(result.remaining, expected.reduce((sum, value) => sum + value, 0));
            assert.deepEqual(Object.keys(result).sort(), ['categories', 'checkedAt', 'eventId', 'remaining']);
            assert.equal(JSON.stringify(result).includes('private-'), false, 'no seat IDs or buyer identities');
        }
        assert.deepEqual(php.categories, js.categories);
    });
}

test('legacy category arrays return the same section counts in both backends', () => {
    const legacy = { ...event, categories: [{ sectionId: 'A', quantity: 4 }, { section: 'B', available: 2 }] };
    assert.deepEqual(phpAvailability([legacy, physical, [], currentTime]).categories,
        eventAvailability(legacy, physical, [], currentTime).categories);
});

test('the browser requests aggregate counts in the configured Functions region', async () => {
    const source = require('node:fs').readFileSync(path.join(root, 'assets/js/firestore-crud.js'), 'utf8');
    const method = source.match(/async getEventAvailability\(eventId\) \{[\s\S]*?\n    \}/)[0];
    const requests = [];
    const service = require('node:vm').runInNewContext('({' + method + '})', {
        DEFAULT_FUNCTION_REGION: 'asia-southeast1',
        invokeCallable: async (request, config) => { requests.push({ request, config }); return { remaining: 9 }; }
    });
    assert.equal((await service.getEventAvailability('event')).remaining, 9);
    assert.deepEqual(JSON.parse(JSON.stringify(requests)), [{
        request: { eventId: 'event' }, config: { name: 'getEventAvailability', region: 'asia-southeast1' }
    }]);
});
