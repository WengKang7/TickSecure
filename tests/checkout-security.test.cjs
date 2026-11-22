const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
const wallet = '0x' + '1'.repeat(40);
const selected = ['event_p1', 'event_p2'];
const request = { eventId: 'event', sectionId: 'VIP', seatDocIds: selected, quantity: 2 };
const plain = value => JSON.parse(JSON.stringify(value));

function records() {
    const state = {
        'Users/buyer': { role: 'buyer', status: 'active', emailVerified: true, walletAddress: wallet },
        'Users/other': { role: 'buyer', status: 'active', emailVerified: true, walletAddress: '0x' + '2'.repeat(40) },
        'Events/event': { name: 'Concert', venueId: 'venue', organizerUid: 'organizer', status: 'PUBLISHED',
            maxTicketsPerBuyer: 2, categories: { VIP: { name: 'VIP', price: 100, quantity: 3 } } }
    };
    for (let i = 1; i <= 3; i++) {
        state['Seats/p' + i] = { venueId: 'venue', sectionId: 'VIP', seatLabel: 'VIP-' + i };
        state['EventSeats/event_p' + i] = { eventId: 'event', venueId: 'venue', sectionId: 'VIP', sourceSeatId: 'p' + i,
            seatLabel: 'VIP-' + i, status: i === 3 ? 'AVAILABLE' : 'RESERVED', reservedBy: i === 3 ? '' : 'buyer',
            reservationExpiry: new Date(Date.now() + 600000).toISOString(), reservationEventId: 'event' };
    }
    return state;
}

function phpCheckout(state, data = request, uid = 'buyer') {
    return JSON.parse(execFileSync(php, ['tests/resale-backend-fixture.php'], {
        input: JSON.stringify([{ action: 'checkout', uid, data, records: state }]), encoding: 'utf8'
    }))[0];
}

// Execute the full callable checkout and inventory preparation using versioned
// in-memory transactions. No Firebase connection or payment service is used.
function functionsBackend(initial) {
    const state = structuredClone(initial), versions = new Map(); let serial = 0;
    const snapshot = (key, data = state) => ({ id: key.split('/')[1], exists: !!data[key], data: () => structuredClone(data[key]) });
    const collection = (name, filters = []) => ({
        doc(id = 'generated-' + ++serial) { const key = name + '/' + id; return { key, id, get: async () => snapshot(key) }; },
        where: (field, operator, value) => collection(name, [...filters, [field, value]]),
        get: async () => ({ docs: Object.keys(state).filter(key => key.startsWith(name + '/')
            && filters.every(([field, value]) => state[key][field] === value)).map(key => snapshot(key)) }), name, filters
    });
    const db = { collection, getAll: async (...refs) => refs.map(ref => snapshot(ref.key)),
        async runTransaction(callback) {
            for (let attempt = 0; attempt < 8; attempt++) {
                const readVersions = new Map(), writes = [];
                const read = key => { readVersions.set(key, versions.get(key) || 0); return snapshot(key); };
                const result = await callback({
                    async get(target) {
                        if (writes.length) throw Error('Read after write');
                        if (target.key) return read(target.key);
                        const docs = Object.keys(state).filter(key => key.startsWith(target.name + '/')
                            && target.filters.every(([field, value]) => state[key][field] === value)).map(read);
                        return { docs, size: docs.length };
                    },
                    set: (ref, fields) => writes.push([ref.key, fields, true]),
                    update: (ref, fields) => writes.push([ref.key, fields, false])
                });
                if ([...readVersions].some(([key, version]) => (versions.get(key) || 0) !== version)) continue;
                for (const [key, fields, replace] of writes) {
                    state[key] = { ...(replace ? {} : state[key]), ...plain(fields) };
                    versions.set(key, (versions.get(key) || 0) + 1);
                }
                return result;
            }
            throw Error('Transaction retry limit');
        }
    };
    class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
    const localRequire = createRequire(path.resolve('functions/index.js'));
    const context = { exports: {}, process: { env: {} }, console, require(name) {
        if (name === 'firebase-functions/v2/https') return { onCall: (_, action) => action, HttpsError };
        if (name === 'firebase-functions/v2/firestore') return { onDocumentUpdated() {} };
        if (name === 'firebase-admin/app') return { getApps: () => [1] };
        if (name === 'firebase-admin/firestore') return { getFirestore: () => db, FieldValue: {} };
        if (name === 'firebase-admin/auth') return { getAuth: () => ({}) };
        return localRequire(name);
    } };
    vm.runInNewContext(fs.readFileSync('functions/index.js', 'utf8'), context);
    return { state, checkout: (data = request, uid = 'buyer') => context.exports.checkout({ auth: { uid }, data }) };
}

test('PHP and Functions reject missing, empty, malformed, duplicate and quantity-mismatched seat selections without writes', async () => {
    for (const [data, code] of [
        [{ eventId: 'event', sectionId: 'VIP', quantity: 2 }, 'failed-precondition'],
        [{ ...request, seatDocIds: null }, 'failed-precondition'],
        [{ ...request, seatDocIds: [] }, 'invalid-argument'],
        [{ ...request, seatDocIds: 'event_p1' }, 'invalid-argument'],
        [{ ...request, seatDocIds: ['event_p1', 'event_p1'] }, 'invalid-argument'],
        [{ ...request, quantity: 1 }, 'invalid-argument']
    ]) {
        const state = records(), node = functionsBackend(state), result = phpCheckout(state, data);
        assert.equal(result.error, code); assert.deepEqual(result.records, state);
        await assert.rejects(node.checkout(data), error => error.code === code);
        assert.deepEqual(node.state, state);
    }
});

test('both servers require the exact seats to be reserved by this buyer for this event, venue and category', async () => {
    for (const change of [
        s => { s['EventSeats/event_p1'].reservedBy = 'other'; },
        s => { s['EventSeats/event_p1'].reservationExpiry = '2000-01-01T00:00:00Z'; },
        s => { s['EventSeats/event_p1'].status = 'AVAILABLE'; },
        s => { s['EventSeats/event_p1'].eventId = 'another'; },
        s => { s['EventSeats/event_p1'].venueId = 'another'; },
        s => { s['EventSeats/event_p1'].sectionId = 'another'; },
        s => { s['EventSeats/event_p1'].reservationEventId = 'another'; }
    ]) {
        const state = records(); change(state);
        const node = functionsBackend(state), result = phpCheckout(state);
        assert.equal(result.error, 'failed-precondition'); assert.deepEqual(result.records, state);
        await assert.rejects(node.checkout(), error => error.code === 'failed-precondition');
        assert.deepEqual(node.state, state);
    }
});

test('a selected reservation buys only those seats at the server price and replay returns the same booking at the ticket limit', async () => {
    const forged = { ...request, unitPrice: 0.01, totalAmount: 0.01, serviceCharge: 0, seatLabels: ['FAKE'], walletAddress: '0x' + '9'.repeat(40) };
    const start = records(), first = phpCheckout(start, forged), node = functionsBackend(start), saved = await node.checkout(forged);
    assert.equal(first.error, undefined);
    for (const [state, booking] of [[first.records, first.result], [node.state, saved]]) {
        assert.equal(booking.totalAmount, 220);
        assert.deepEqual(plain(booking.seatLabels), ['VIP-1', 'VIP-2']);
        assert.equal(state['EventSeats/event_p3'].status, 'AVAILABLE');
        assert.equal(Object.keys(state).filter(key => key.startsWith('Bookings/')).length, 1);
        const tickets = Object.entries(state).filter(([key]) => key.startsWith('NFTTickets/')).map(([, ticket]) => ticket);
        assert.equal(tickets.length, 2); assert.ok(tickets.every(ticket => ticket.walletAddress === wallet));
    }
    const second = phpCheckout(first.records, { ...request, seatDocIds: [...selected].reverse() });
    assert.equal(second.result.id, first.result.id); assert.deepEqual(second.records, first.records);
    const before = structuredClone(node.state), repeated = await node.checkout({ ...request, seatDocIds: [...selected].reverse() });
    assert.equal(repeated.id, saved.id); assert.deepEqual(node.state, before);
    const foreign = phpCheckout(first.records, request, 'other');
    assert.equal(foreign.error, 'failed-precondition'); assert.deepEqual(foreign.records, first.records);
    await assert.rejects(node.checkout(request, 'other'), error => error.code === 'failed-precondition');
});

test('concurrent retries create one booking, two tickets and two mint operations for the same selected seats', async () => {
    const node = functionsBackend(records());
    const results = await Promise.all([node.checkout(), node.checkout()]);
    assert.equal(results[0].id, results[1].id);
    for (const [collection, count] of [['Bookings', 1], ['NFTTickets', 2], ['BlockchainTransactions', 2]]) {
        assert.equal(Object.keys(node.state).filter(key => key.startsWith(collection + '/')).length, count);
    }
});
