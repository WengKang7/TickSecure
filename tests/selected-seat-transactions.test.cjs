const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { checkSelected } = require('../functions/seat-picker-policy');
function backend() {
    const data = new Map(), versions = new Map(); let serial = 0;
    const put = (collection, id, value) => { const key = `${collection}/${id}`; data.set(key, structuredClone(value)); versions.set(key, (versions.get(key) || 0) + 1); };
    put('Events', 'event', { venueId: 'venue', status: 'PUBLISHED', maxTicketsPerBuyer: 2, categories: { A: { name: 'A', price: 100 }, B: { name: 'B', price: 120 } } });
    for (const id of ['s1', 's2', 's3']) put('EventSeats', id, { eventId: 'event', venueId: 'venue', sectionId: 'A', seatLabel: id, status: 'AVAILABLE' });
    put('EventSeats', 'b1', { eventId: 'event', venueId: 'venue', sectionId: 'B', seatLabel: 'b1', status: 'AVAILABLE' });
    function query(collection, filters = []) { return { collection, filters, doc: id => ({ key: collection + '/' + (id || 'audit' + ++serial), id }), where(field, op, value) { return query(collection, [...filters, [field, value]]); } }; }
    const db = { collection: name => query(name), runTransaction: async action => {
        for (let attempt = 0; attempt < 10; attempt++) {
            const reads = new Map(), writes = [];
            const snapshot = key => { reads.set(key, versions.get(key) || 0); const value = data.get(key); return { id: key.split('/')[1], exists: !!value, data: () => structuredClone(value) }; };
            const tx = { get: async ref => {
                if (ref.key) return snapshot(ref.key);
                const docs = [...data.keys()].filter(key => key.startsWith(ref.collection + '/') && ref.filters.every(([field, value]) => data.get(key)[field] === value)).map(snapshot);
                return { docs, size: docs.length };
            }, update: (ref, fields) => writes.push([ref.key, fields, false]), set: (ref, fields) => writes.push([ref.key, fields, true]) };
            const result = await action(tx);
            if ([...reads].some(([key, version]) => (versions.get(key) || 0) !== version)) continue;
            writes.forEach(([key, fields, replace]) => { data.set(key, { ...(replace ? {} : data.get(key)), ...structuredClone(fields) }); versions.set(key, (versions.get(key) || 0) + 1); });
            return result;
        }
        throw Error('Transaction retry limit');
    } };
    const src = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
    class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
    const context = vm.createContext({ exports: {}, db, createHash, HttpsError, region: 'test', onCall: (_, callback) => callback,
        ensurePurchasableEventInventory: async () => {}, getActiveBuyer: async (_, uid) => ({ uid }), checkSelected,
        salesAreOpen: event => event.status === 'PUBLISHED', requireTicketCategory: c => { if (!c) throw Error('Bad category'); return c; }, categoryForSection: (c,s) => c[s],
        ownedTicketCount: async () => 0, configuredMaxTickets: event => event.maxTicketsPerBuyer, now: () => new Date().toISOString(),
        reservationIsActive: (s, t) => Date.parse(s.reservationExpiry || '') > t, auditDoc: () => ({ action: 'selected' }) });
    vm.runInContext(src.slice(src.indexOf('function requireAuth('), src.indexOf('function requirePositiveInteger(')), context);
    vm.runInContext(src.slice(src.indexOf('exports.holdSelectedSeats ='), src.indexOf('exports.releaseSeatReservation =')), context);
    return { data, put, hold: (uid, ids, sectionId = 'A') => context.exports.holdSelectedSeats({ auth: { uid }, data: { eventId: 'event', sectionId, seatDocIds: ids } }) };
}
test('two concurrent buyers cannot hold the same seat', async () => {
    const b = backend(); const results = await Promise.allSettled([b.hold('buyer1',['s1']), b.hold('buyer2',['s1'])]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected')[0].reason.code, 'already-exists');
});
test('a conflict in a multi-seat selection leaves every requested seat untouched', async () => {
    const b = backend(); await b.hold('buyer1', ['s1']);
    await assert.rejects(b.hold('buyer2', ['s1','s2']), /just taken/);
    assert.equal(b.data.get('EventSeats/s2').status, 'AVAILABLE');
});
test('replacing a selection releases old seats atomically and duplicate requests retain the same exact seats', async () => {
    const b = backend(); await b.hold('buyer1', ['s1']); const next = await b.hold('buyer1', ['s2','s3']);
    assert.equal(b.data.get('EventSeats/s1').status, 'AVAILABLE');
    assert.deepEqual(Array.from(next.seats, s => s.id), ['s2','s3']);
    assert.deepEqual(Array.from((await b.hold('buyer1', ['s2','s3'])).seats, s => s.id), ['s2','s3']);
});
test('forged cross-event IDs, duplicates and purchases over the buyer limit are rejected', async () => {
    const b = backend(); b.put('EventSeats','foreign',{ eventId: 'other',venueId:'venue',sectionId:'A',status:'AVAILABLE' });
    await assert.rejects(b.hold('buyer1',['foreign']), /does not belong/);
    await assert.rejects(b.hold('buyer1',['s1','s1']), /duplicates/);
    await assert.rejects(b.hold('buyer1',['s1','s2','s3']), /ticket limit/);
});
