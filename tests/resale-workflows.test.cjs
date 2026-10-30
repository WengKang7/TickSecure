const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const policy = require('../assets/js/resale-policy');
const wallet = '0x' + '1'.repeat(40);
const actor = role => ({ role, status: 'active', emailVerified: true, walletAddress: wallet });
function records() {
    return {
        'Users/buyer': actor('buyer'), 'Users/other': actor('buyer'), 'Users/seller': actor('buyer'), 'Users/admin': actor('admin'),
        'Events/event': { status: 'PUBLISHED', organizerUid: 'organizer', resaleEnabled: true, resaleStartDate: '2000-01-01', resaleDeadline: '2099-12-31', maxTicketsPerBuyer: 2, maxResaleMarkup: 10, categories: { A: { name: 'VIP', price: 100 } } },
        'NFTTickets/ticket': { eventId: 'event', sectionId: 'A', categoryName: 'VIP', ownerUid: 'seller', status: 'LISTED_FOR_RESALE', seatId: 'A1', walletAddress: wallet },
        'ResaleListings/listing': { eventId: 'event', sectionId: 'A', ticketId: 'ticket', sellerUid: 'seller', buyerUid: '', originalPrice: 100, resalePrice: 105, maxAllowedPrice: 110, status: 'ACTIVE', ruleCompliance: 'COMPLIANT' }
    };
}
function backend(initial) {
    const data = structuredClone(initial), versions = new Map();
    let serial = 0;
    const ref = (collection, id) => ({ key: collection + '/' + (id || 'generated-' + ++serial), id: id || 'generated-' + serial });
    const collection = (name, filters = []) => ({ name, filters, doc: id => ref(name, id),
        where: (field, op, value) => collection(name, [...filters, [field, value]]) });
    const db = { collection, async runTransaction(action) {
        for (let attempt = 0; attempt < 10; attempt++) {
            const reads = new Map(), writes = [];
            const snapshot = key => { reads.set(key, versions.get(key) || 0); return { exists: !!data[key], id: key.split('/')[1], data: () => structuredClone(data[key]) }; };
            const tx = { async get(target) {
                if (writes.length) throw Error('Read after write');
                if (target.key) return snapshot(target.key);
                const docs = Object.keys(data).filter(key => key.startsWith(target.name + '/') && target.filters.every(([field, value]) => data[key][field] === value)).map(snapshot);
                return { docs, size: docs.length };
            }, set(target, fields) { writes.push([target.key, fields, true]); }, update(target, fields) { writes.push([target.key, fields, false]); } };
            const result = await action(tx);
            if ([...reads].some(([key, version]) => (versions.get(key) || 0) !== version)) continue;
            writes.forEach(([key, fields, replace]) => {
                const value = replace ? {} : { ...data[key] };
                for (const [field, content] of Object.entries(fields)) value[field] = content?.fixtureUnion ? [...(value[field] || []), ...content.fixtureUnion] : content;
                data[key] = value; versions.set(key, (versions.get(key) || 0) + 1);
            });
            return result;
        }
        throw Error('Too many retries');
    } };
    class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
    const localRequire = createRequire(path.join(root, 'functions/index.js'));
    const context = { exports: {}, console, process: {env:{}}, require(name) {
        if (name === 'firebase-functions/v2/https') return { onCall: (_, cb) => cb, HttpsError };
        if (name === 'firebase-functions/v2/firestore') return { onDocumentUpdated: () => {} };
        if (name === 'firebase-admin/app') return { getApps: () => [1] };
        if (name === 'firebase-admin/firestore') return { getFirestore: () => db, FieldValue: { arrayUnion: (...items) => ({ fixtureUnion: items }) } };
        if (name === 'firebase-admin/auth') return { getAuth: () => ({}) };
        return localRequire(name);
    } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8'), context);
    return { data, call: (action, uid, request) => context.exports[action]({ auth: { uid }, data: request }) };
}
const scenarios = [];
function scenario(name, action, uid, patch, error, request = {}) {
    const state = records(); patch?.(state);
    scenarios.push({ name, action, uid, records: state, error, data: { listingId: 'listing', ticketId: 'ticket', resalePrice: 105, expectedPrice: 105, ...request } });
}
scenario('buy a valid listing', 'purchaseResale', 'buyer');
scenario('seller cannot buy own ticket', 'purchaseResale', 'seller', null, 'failed-precondition');
scenario('expired resale window', 'purchaseResale', 'buyer', s => { s['Events/event'].resaleDeadline = '2000-01-01'; }, 'failed-precondition');
scenario('cancelled event', 'purchaseResale', 'buyer', s => { s['Events/event'].status = 'CANCELLED'; }, 'failed-precondition');
scenario('current cap reduced after listing', 'purchaseResale', 'buyer', s => { s['Events/event'].maxResalePrice = 99; }, 'failed-precondition');
scenario('price changed after confirmation', 'purchaseResale', 'buyer', null, 'failed-precondition', { expectedPrice: 100 });
scenario('ticket now belongs to another seller', 'purchaseResale', 'buyer', s => { s['NFTTickets/ticket'].ownerUid = 'other'; }, 'failed-precondition');
scenario('ticket now belongs to another event', 'purchaseResale', 'buyer', s => { s['NFTTickets/ticket'].eventId = 'other'; }, 'failed-precondition');
scenario('archived seller cannot sell', 'purchaseResale', 'buyer', s => { s['Users/seller'].status = 'deleted'; }, 'failed-precondition');
scenario('buyer holding limit', 'purchaseResale', 'buyer', s => { for (let i=0; i<2; i++) s['NFTTickets/owned'+i] = { ownerUid: 'buyer', eventId: 'event' }; }, 'failed-precondition');
scenario('repeat purchase returns the same receipt', 'purchaseResale', 'buyer', s => { Object.assign(s['ResaleListings/listing'], { status: 'SOLD', buyerUid: 'buyer' }); });
scenario('create listing', 'createResaleListing', 'seller', s => { s['NFTTickets/ticket'].status = 'VALID'; delete s['ResaleListings/listing']; });
scenario('duplicate listing rejected', 'createResaleListing', 'seller', null, 'permission-denied');
scenario('invalid decimal price rejected', 'createResaleListing', 'seller', null, 'invalid-argument', { resalePrice: 100.001 });
scenario('seller reprices listing', 'updateResalePrice', 'seller', null, null, { resalePrice: 108 });
scenario('other account cannot reprice', 'updateResalePrice', 'buyer', null, 'permission-denied');
scenario('stale ticket cannot be repriced', 'updateResalePrice', 'seller', s => { s['NFTTickets/ticket'].status = 'USED'; }, 'failed-precondition');
scenario('seller cancels listing', 'cancelResaleListing', 'seller');
scenario('cancelling does not revive used ticket', 'cancelResaleListing', 'seller', s => { s['NFTTickets/ticket'].status = 'USED'; }, 'failed-precondition');
scenario('admin suspends listing', 'suspendResaleListing', 'admin');
scenario('unverified admin suspends listing', 'suspendResaleListing', 'admin', s => { s['Users/admin'].emailVerified = false; });
scenario('admin without a verification field suspends listing', 'suspendResaleListing', 'admin', s => { delete s['Users/admin'].emailVerified; });
scenario('suspended admin cannot suspend listings', 'suspendResaleListing', 'admin', s => { s['Users/admin'].status = 'suspended'; s['Users/admin'].emailVerified = false; }, 'permission-denied');
scenario('moderation does not revive a used ticket', 'suspendResaleListing', 'admin', s => { s['NFTTickets/ticket'].status = 'USED'; });
scenario('buyer cannot suspend listing', 'suspendResaleListing', 'buyer', null, 'permission-denied');
scenario('unverified active admin scans a valid ticket', 'scanTicket', 'admin', s => { s['Users/admin'].emailVerified = false; s['NFTTickets/ticket'].status = 'VALID'; }, null, {eventId:'event'});
scenario('suspended admin cannot scan tickets', 'scanTicket', 'admin', s => { s['Users/admin'].status = 'suspended'; s['Users/admin'].emailVerified = false; s['NFTTickets/ticket'].status = 'VALID'; }, 'permission-denied', {eventId:'event'});
scenario('unverified organizer cannot scan tickets', 'scanTicket', 'organizer', s => { s['Users/organizer'] = {role:'organizer',status:'active',emailVerified:false}; s['NFTTickets/ticket'].status = 'VALID'; }, 'permission-denied', {eventId:'event'});

test('Firebase and PHP execute matching resale transactions and reject invalid operations atomically', async () => {
    const php = process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php';
    const phpResults = JSON.parse(execFileSync(php, [path.join(__dirname, 'resale-backend-fixture.php')], { input: JSON.stringify(scenarios), encoding: 'utf8' }));
    for (const [index, s] of scenarios.entries()) {
        const node = backend(s.records);
        let result, error;
        try { result = await node.call(s.action, s.uid, s.data); } catch (err) { error = err.code; if (!error) throw err; }
        assert.equal(error || null, s.error || null, s.name);
        assert.equal(phpResults[index].error || null, s.error || null, 'PHP: ' + s.name);
        if (s.error) {
            assert.deepEqual(node.data, s.records, 'atomic failure: '+s.name);
            assert.deepEqual(phpResults[index].records, s.records, 'PHP atomic failure: '+s.name);
        } else {
            if (s.action === 'purchaseResale') {
                assert.equal(result.totalAmount, 125);
                assert.equal(phpResults[index].result.totalAmount, 125);
            }
            for (const key of ['NFTTickets/ticket', 'ResaleListings/listing']) {
                assert.equal(node.data[key]?.status, phpResults[index].records[key]?.status, s.name + ': '+key);
                assert.equal(node.data[key]?.ownerUid, phpResults[index].records[key]?.ownerUid, s.name + ': owner');
            }
        }
    }
});
test('concurrent resale purchases have exactly one winner and retries do not create more transfers', async () => {
    const b = backend(records());
    const results = await Promise.allSettled(['buyer', 'other'].map(uid => b.call('purchaseResale', uid, { listingId: 'listing', expectedPrice: 105 })));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const winner = b.data['NFTTickets/ticket'].ownerUid;
    const count = Object.keys(b.data).length;
    await b.call('purchaseResale', winner, { listingId: 'listing', expectedPrice: 105 });
    assert.equal(Object.keys(b.data).length, count);
    assert.equal(b.data['NFTTickets/ticket'].transferHistory.length, 1);
});
test('buyer eligibility uses inclusive UTC+8 dates, cent prices, and fixed or percentage caps', () => {
    const event = { ...records()['Events/event'], resaleStartDate: '2026-10-29', resaleDeadline: '2026-10-29' };
    assert.equal(policy.unavailable(event, Date.parse('2026-10-29T23:59:59.999+08:00')), '');
    assert.match(policy.unavailable(event, Date.parse('2026-10-30T00:00:00+08:00')), /closed/);
    assert.equal(policy.limits(event, { sectionId: 'A' }).maximum, 110);
    assert.equal(policy.limits({ ...event, maxResalePrice: 80 }, { sectionId: 'A' }).maximum, 80);
    assert.equal(policy.price('0.01', 80), true);
    for (const value of ['0', '-1', '1.001', '1e2', '80.01', 'NaN']) assert.equal(policy.price(value, 80), false);
});
