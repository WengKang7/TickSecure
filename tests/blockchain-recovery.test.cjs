const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./blockchain-test-helpers.cjs');
const { createBlockchainService } = require('../functions/blockchain');
const { execFileSync } = require('node:child_process');
const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
const make = (db, rpc = H.provider().rpc) => createBlockchainService(db, { projectId: 'test-project', rpc, fail: H.fail, signer: H.signer });

test('buyer and organizer refresh reconcile a mined hash without authorizing or sending another transaction', async () => {
    for (const role of ['buyer', 'organizer']) {
        const db = H.database(H.records()), provider = H.provider(), calls = [];
        const service = make(db, async (...args) => { calls.push(args[0]); return provider.rpc(...args); });
        const prepared = await service.prepare('alice', { recordId: 'mint' });
        const mined = H.receipt(prepared);
        provider.set({ ...mined, receipt: null });
        await service.verify('alice', { recordId: 'mint', transactionHash: H.hash });
        assert.equal(db.records['BlockchainTransactions/mint'].status, 'SUBMITTED');
        const authorizations = Object.keys(db.records).filter(key => key.startsWith('BlockchainAuthorizations/'));
        provider.set(mined); calls.length = 0;
        const result = await (role === 'buyer' ? service.listBuyer('alice', { ticketId: 'ticket' })
            : service.listOrganizer('organizer', { ticketId: 'ticket' }));
        assert.equal(result.records[0].status, 'CONFIRMED');
        assert.equal(db.records['NFTTickets/ticket'].mintingStatus, 'MINTED');
        assert.deepEqual(Object.keys(db.records).filter(key => key.startsWith('BlockchainAuthorizations/')), authorizations);
        assert.ok(calls.includes('eth_getTransactionReceipt'));
        assert.ok(!calls.some(method => /send|sign/i.test(method)));
    }
});

test('recovery checks are bounded, unavailable providers preserve hashes and unrelated users cannot trigger checks', async () => {
    const state = H.records();
    Object.assign(state['BlockchainTransactions/mint'], { status: 'SUBMITTED', transactionHash: H.hash });
    for (let i = 1; i <= 3; i++) {
        state['NFTTickets/ticket' + i] = { ...state['NFTTickets/ticket'] };
        state['BlockchainTransactions/mint' + i] = { ...state['BlockchainTransactions/mint'], id: 'mint' + i, ticketId: 'ticket' + i };
    }
    const db = H.database(state), calls = [];
    const service = make(db, async method => { calls.push(method); throw Object.assign(Error('Provider unavailable'), { code: 'unavailable' }); });
    const result = await service.listBuyer('alice', {});
    assert.equal(calls.filter(method => method === 'eth_getTransactionByHash').length, 2);
    assert.match(result.recoveryWarning, /could not be checked/);
    assert.equal(db.records['BlockchainTransactions/mint'].transactionHash, H.hash);
    assert.equal(db.records['BlockchainTransactions/mint'].status, 'SUBMITTED');
    calls.length = 0;
    assert.equal((await service.listBuyer('outsider', { ticketId: 'ticket' })).records.length, 0);
    assert.equal(calls.length, 0);
    await assert.rejects(service.listOrganizer('otherOrganizer', { ticketId: 'ticket' }), /not found/);
});

test('single-ticket and booking history avoid enumerating unrelated account documents', async () => {
    for (const filters of [{ ticketId: 'ticket' }, { bookingId: 'booking' }, { recordId: 'mint' }]) {
        const state = H.records();
        for (let i = 0; i < 101; i++) {
            state['NFTTickets/unrelated' + i] = { ownerUid: 'alice', bookingId: 'unrelated' + i };
            state['Bookings/unrelated' + i] = { buyerUid: 'alice' };
            state['AuditLogs/unrelated' + i] = { actorUid: 'alice' };
        }
        const db = H.database(state), queries = [];
        const original = db.collection;
        const wrap = (name, q, filters = []) => ({ doc: id => q.doc(id),
            where: (...args) => wrap(name, q.where(...args), [...filters, args]),
            get: async () => { const result = await q.get(); queries.push({ name, filters, docs: result.docs.length }); return result; } });
        db.collection = name => wrap(name, original(name));
        const result = await make(db).listBuyer('alice', filters);
        assert.equal(result.records.length, 1);
        assert.ok(!queries.some(q => ['NFTTickets', 'Bookings', 'AuditLogs', 'ResaleListings'].includes(q.name)));
        assert.ok(queries.reduce((sum, q) => sum + q.docs, 0) <= 2);
    }
});

test('transfers reject unfinished mint/history atomically and a recipient cannot forward a pending handover', () => {
    const seed = () => require('./confirmed-ticket-fixture.cjs')({
        'Users/alice': { role: 'buyer', status: 'active', emailVerified: true, walletAddress: H.alice },
        'Users/bob': { role: 'buyer', status: 'active', emailVerified: true, walletAddress: H.bob },
        'Users/charlie': { role: 'buyer', status: 'active', emailVerified: true, walletAddress: H.charlie },
        'Events/event': { status: 'PUBLISHED', transferEnabled: true, maxTicketsPerBuyer: 4 },
        'NFTTickets/ticket': { eventId: 'event', ownerUid: 'alice', walletAddress: H.alice, status: 'VALID', transferHistory: [] }
    });
    const invoke = (records, uid = 'alice', recipientWallet = H.bob) => JSON.parse(execFileSync(php, ['tests/resale-backend-fixture.php'], {
        input: JSON.stringify([{ action: 'transferTicket', uid, data: { ticketId: 'ticket', recipientWallet }, records }]), encoding: 'utf8'
    }))[0];
    for (const mutate of [
        s => { s['NFTTickets/ticket'].mintingStatus = 'PENDING'; },
        s => { s['BlockchainTransactions/pending'] = { ticketId: 'ticket', status: 'PENDING', transactionType: 'TRANSFER' }; },
        s => { delete s['BlockchainTransactions/confirmed-mint-ticket']; },
        s => { s['NFTTickets/ticket'].blockchainWalletAddress = H.charlie; }
    ]) {
        const state = seed(); mutate(state);
        const result = invoke(state);
        assert.equal(result.error, 'failed-precondition');
        assert.deepEqual(result.records, state);
    }
    const first = invoke(seed());
    assert.equal(first.error, undefined);
    assert.equal(first.records['NFTTickets/ticket'].blockchainStatus, 'PENDING');
    const second = invoke(first.records, 'bob', H.charlie);
    assert.equal(second.error, 'failed-precondition');
    assert.deepEqual(second.records, first.records);
});
