const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const vm = require('node:vm');
const wallet = '0x' + '1'.repeat(40);
function records(status = 'PUBLISHED') {
    return {
        'Users/admin': { role: 'admin', status: 'active', emailVerified: true },
        'Users/organizer': { role: 'organizer', status: 'active', emailVerified: true },
        'Users/buyer': { role: 'buyer', status: 'active', emailVerified: true, walletAddress: wallet },
        'Events/event': { name: 'Keep this event', description: 'Original description', status, organizerUid: 'organizer',
            posterUrl: '/uploads/poster.jpg', categories: { A: { name: 'VIP', price: 100, quantity: 10 } },
            resaleEnabled: true, statusHistory: [{ from: 'PENDING_REVIEW', to: 'PUBLISHED', timestamp: '2026-10-01' }] },
        'Bookings/booking': { eventId: 'event', buyerUid: 'buyer', status: 'CONFIRMED', totalAmount: 120 },
        'NFTTickets/ticket': { eventId: 'event', ownerUid: 'buyer', status: 'VALID', seatId: 'A1' },
        'NFTTickets/listed-ticket': { eventId: 'event', ownerUid: 'buyer', status: 'LISTED_FOR_RESALE', seatId: 'A2' },
        'ResaleListings/listing': { eventId: 'event', ticketId: 'listed-ticket', sellerUid: 'buyer', status: 'ACTIVE', resalePrice: 100 }
    };
}
function run(cases) {
    const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
    return JSON.parse(execFileSync(php, [path.join(__dirname, 'resale-backend-fixture.php')], {
        input: JSON.stringify(cases), encoding: 'utf8'
    }));
}
test('Make unavailable retains the event, existing bookings and tickets, records the decision and closes resale', () => {
    const before = records();
    const [after] = run([{ action: 'moderateEvent', uid: 'admin', records: before,
        data: { eventId: 'event', status: 'SUSPENDED', reason: 'Venue unavailable' } }]);
    assert.equal(after.error, undefined);
    assert.equal(after.result.status, 'SUSPENDED');
    assert.equal(after.records['Events/event'].status, 'SUSPENDED');
    for (const key of Object.keys(before)) assert.ok(key in after.records, key + ' must not be deleted');
    assert.deepEqual(after.records['Bookings/booking'], before['Bookings/booking']);
    assert.deepEqual(after.records['NFTTickets/ticket'], before['NFTTickets/ticket']);
    for (const field of ['name', 'description', 'posterUrl', 'categories']) {
        assert.deepEqual(after.records['Events/event'][field], before['Events/event'][field]);
    }
    assert.deepEqual(after.records['Events/event'].statusHistory[0], before['Events/event'].statusHistory[0]);
    assert.equal(after.records['Events/event'].statusHistory.at(-1).reason, 'Venue unavailable');
    assert.equal(after.records['ResaleListings/listing'].status, 'SUSPENDED');
    assert.ok(Object.entries(after.records).some(([key, value]) => key.startsWith('AuditLogs/') && value.action === 'event_suspended'));
    const [checkout, resale] = run([
        { action: 'checkout', uid: 'buyer', records: after.records, data: { eventId: 'event', sectionId: 'A', quantity: 1 } },
        { action: 'purchaseResale', uid: 'buyer', records: after.records, data: { listingId: 'listing', expectedPrice: 100 } }
    ]);
    assert.equal(checkout.error, 'failed-precondition');
    assert.equal(resale.error, 'failed-precondition');
    assert.deepEqual(checkout.records, after.records);
    assert.deepEqual(resale.records, after.records);
});

test('only an active administrator can make published or legacy approved events unavailable', () => {
    const cases = ['buyer', 'organizer', 'admin'].map(uid => ({ action: 'moderateEvent', uid,
        records: records('APPROVED'), data: { eventId: 'event', status: 'SUSPENDED', reason: 'No longer available' } }));
    cases.push({ ...cases[2], records: { ...records(), 'Users/admin': { role: 'admin', status: 'suspended' } } });
    const result = run(cases);
    assert.equal(result[0].error, 'permission-denied');
    assert.equal(result[1].error, 'permission-denied');
    assert.equal(result[2].result.status, 'SUSPENDED');
    assert.equal(result[3].error, 'permission-denied');
    for (const index of [0, 1, 3]) assert.deepEqual(result[index].records, cases[index].records);
});

test('Make available restores visibility and history while retaining tickets, sales rules and closed resales', () => {
    const initial = records();
    initial['Events/event'].salesStartDate = '2026-01-01';
    initial['Events/event'].salesEndDate = '2099-12-31';
    const [unavailable] = run([{ action: 'moderateEvent', uid: 'admin', records: initial,
        data: { eventId: 'event', status: 'SUSPENDED', reason: 'Venue unavailable' } }]);
    const [available] = run([{ action: 'moderateEvent', uid: 'admin', records: unavailable.records,
        data: { eventId: 'event', status: 'PUBLISHED', restore: true } }]);
    assert.equal(available.error, undefined);
    assert.equal(available.result.status, 'PUBLISHED');
    for (const field of ['name', 'description', 'posterUrl', 'categories', 'salesStartDate', 'salesEndDate']) {
        assert.deepEqual(available.records['Events/event'][field], initial['Events/event'][field]);
    }
    for (const key of ['Bookings/booking', 'NFTTickets/ticket', 'NFTTickets/listed-ticket', 'ResaleListings/listing']) {
        assert.deepEqual(available.records[key], unavailable.records[key]);
    }
    assert.equal(available.records['ResaleListings/listing'].status, 'SUSPENDED');
    const history = available.records['Events/event'].statusHistory;
    assert.equal(history.at(-1).from, 'SUSPENDED');
    assert.equal(history.at(-1).to, 'PUBLISHED');
    assert.deepEqual(history.slice(0, -1), unavailable.records['Events/event'].statusHistory);
    assert.ok(Object.entries(available.records).some(([key, value]) => key.startsWith('AuditLogs/') && value.action === 'event_restored'));
    assert.ok(Object.entries(available.records).some(([key, value]) => key.startsWith('Notifications/') && value.type === 'event_restored'));
});

test('restoration requires an active admin and explicit restore intent; it cannot approve drafts or cancelled events', () => {
    const cases = ['DRAFT', 'CANCELLED', 'PENDING_REVIEW', 'PUBLISHED', 'APPROVED'].map(status => ({
        action: 'moderateEvent', uid: 'admin', records: records(status), data: { eventId: 'event', status: 'PUBLISHED', restore: true }
    }));
    cases.push(...['buyer', 'organizer'].map(uid => ({ action: 'moderateEvent', uid, records: records('SUSPENDED'),
        data: { eventId: 'event', status: 'PUBLISHED', restore: true } })));
    cases.push({ action: 'moderateEvent', uid: 'admin', records: records('SUSPENDED'), data: { eventId: 'event', status: 'PUBLISHED' } });
    cases.push({ action: 'moderateEvent', uid: 'admin', records: { ...records('SUSPENDED'), 'Users/admin': { role: 'admin', status: 'suspended' } },
        data: { eventId: 'event', status: 'PUBLISHED', restore: true } });
    for (const [index, result] of run(cases).entries()) {
        assert.ok(['failed-precondition', 'permission-denied'].includes(result.error));
        assert.deepEqual(result.records, cases[index].records, 'a rejected restore must not alter any record');
    }
    const [approved] = run([{ action: 'moderateEvent', uid: 'admin', records: records('PENDING_REVIEW'),
        data: { eventId: 'event', status: 'PUBLISHED' } }]);
    assert.equal(approved.result.status, 'PUBLISHED', 'normal submission approval is unchanged');
    assert.ok(Object.entries(approved.records).some(([key, value]) => key.startsWith('AuditLogs/') && value.action === 'event_approved'));
});

function cloudRestore(options = {}) {
    const data = records(options.status || 'SUSPENDED');
    if (options.role) data['Users/admin'].role = options.role;
    const calls = [];
    let autoId = 0;
    const source = fs.readFileSync(path.join(__dirname, '../assets/js/firestore-crud.js'), 'utf8');
    const code = source.slice(source.indexOf('export const EventService'), source.indexOf('// SEAT SERVICE'))
        .replace('export const EventService =', 'globalThis.service =');
    const context = vm.createContext({
        db: {}, uid: () => 'admin', iso: () => '2026-11-01T12:00:00Z', usingLocalPhpBackend: () => Boolean(options.php),
        invokeCallable: async (request, config) => { calls.push({ request, config }); return { status: 'PUBLISHED' }; },
        collection: (_db, name) => name,
        doc: (first, collection, id) => id ? collection + '/' + id : first + '/auto-' + ++autoId,
        arrayUnion: value => ({ historyEntry: value }),
        runTransaction: async (_db, callback) => {
            const updates = [];
            await callback({
                get: async key => ({ exists: () => Boolean(data[key]), data: () => data[key] }),
                update: (key, value) => updates.push({ key, value }),
                set: (key, value) => updates.push({ key, value })
            });
            for (const { key, value } of updates) {
                const record = { ...data[key], ...value };
                if (value.statusHistory?.historyEntry) record.statusHistory = [...data[key].statusHistory, value.statusHistory.historyEntry];
                data[key] = record;
            }
        }
    });
    vm.runInContext(code, context);
    return { service: context.service, data, calls };
}

test('Firebase restoration changes only an unavailable event and records notification atomically', async () => {
    const c = cloudRestore();
    const before = structuredClone(c.data);
    await c.service.restoreEvent('event');
    assert.equal(c.data['Events/event'].status, 'PUBLISHED');
    assert.equal(c.data['Events/event'].statusHistory.at(-1).from, 'SUSPENDED');
    assert.deepEqual(c.data['Bookings/booking'], before['Bookings/booking']);
    assert.deepEqual(c.data['NFTTickets/ticket'], before['NFTTickets/ticket']);
    assert.deepEqual(c.data['ResaleListings/listing'], before['ResaleListings/listing']);
    assert.ok(Object.values(c.data).some(value => value.type === 'event_restored'));
    for (const options of [{ role: 'buyer' }, { status: 'CANCELLED' }, { status: 'PENDING_REVIEW' }]) {
        const rejected = cloudRestore(options);
        const original = structuredClone(rejected.data);
        await assert.rejects(rejected.service.restoreEvent('event'));
        assert.deepEqual(rejected.data, original);
    }
});

test('local restoration uses an explicit restore request instead of ordinary approval', async () => {
    const c = cloudRestore({ php: true });
    await c.service.restoreEvent('event');
    assert.equal(c.calls[0].request.restore, true);
    assert.equal(c.calls[0].request.status, 'PUBLISHED');
    assert.equal(c.calls[0].config.name, 'moderateEvent');
});
