const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const context = vm.createContext({ setTimeout });
vm.runInContext(fs.readFileSync('assets/js/booking-mint.js', 'utf8').replace('export function', 'function') + '\nglobalThis.factory = createBookingMinter;', context);
const address = '0x' + '1'.repeat(40), contract = '0x' + '2'.repeat(40);
const tx = id => '0x' + (id === 'b' ? 'b' : 'a').repeat(64);
const record = id => ({ id, ticketId: id, transactionType: 'MINT', performedByYou: true, canSubmit: true, status: 'PENDING' });
function fixture(options = {}) {
    const data = options.records || [record('a'), record('b')], updates = [], calls = { sends: [], verifies: [], prepares: [], filters: [] };
    const saved = options.saved || new Map(); let active = true;
    const client = {
        listBuyer: async filters => { calls.filters.push(filters); return { configured: options.configured !== false, records: data }; },
        prepare: async id => { calls.prepares.push(id); if (options.prepare) return options.prepare(id); return { actorWallet: address, walletAddress: address, contractAddress: contract, calldata: '0x1234', deadline: Date.now() / 1000 + 600 }; },
        verify: async (id, hash) => { calls.verifies.push({ id, hash }); return options.verify ? options.verify(id, hash) : { status: 'CONFIRMED' }; }
    };
    const wallet = { connect: async () => { if (options.onConnect) options.onConnect(() => { active = false; }); return options.address || address; },
        send: async request => { calls.sends.push(request); return options.send ? options.send(calls.sends.length, () => { active = false; }) : tx(calls.sends.length === 1 ? 'a' : 'b'); } };
    const storage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
    const minter = context.factory({ client, wallet, storage, locks: options.locks, isActive: uid => active && uid === 'buyer', onUpdate: state => updates.push(state), wait: async () => {} });
    return { minter, calls, updates, saved, deactivate: () => { active = false; }, run: () => minter.run('booking', 'buyer') };
}

test('checkout automatically submits only the purchasers mint records sequentially and verifies them', async () => {
    const p = fixture({ records: [record('a'), { ...record('x'), transactionType: 'TRANSFER' }, { ...record('y'), performedByYou: false }, record('b')] });
    await p.run();
    assert.equal(p.calls.filters[0].bookingId, 'booking');
    assert.deepEqual(p.calls.prepares, ['a', 'b']); assert.equal(p.calls.sends.length, 2);
    assert.equal(p.calls.sends[0].from, address); assert.equal(p.calls.sends[0].to, contract);
    assert.equal(p.updates.at(-1).state, 'complete'); assert.equal(p.updates.at(-1).confirmed, 2); assert.equal(p.saved.size, 0);
});

test('cancellation stops the queue and confirmed tickets are skipped on continuation', async () => {
    const records = [record('a'), record('b')];
    const p = fixture({ records, send: async n => { if (n === 2) throw Object.assign(Error('cancelled'), { code: 4001 }); return tx('a'); } });
    await assert.rejects(p.run(), error => error.code === 4001);
    assert.equal(p.calls.verifies.length, 1);
    records[0] = { ...records[0], status: 'CONFIRMED', verificationVersion: 2, transactionHash: tx('a') };
    const resumed = fixture({ records }); await resumed.run();
    assert.deepEqual(resumed.calls.prepares, ['b']); assert.equal(resumed.calls.sends.length, 1);
});

test('an unavailable receipt preserves the submitted hash and a fresh page verifies it without resending', async () => {
    const p = fixture({ records: [record('a')], verify: async () => { throw Error('RPC unavailable'); } });
    await assert.rejects(p.run(), /RPC unavailable/);
    assert.equal(p.saved.get('ticksecure:buyer-chain:buyer:a'), tx('a'));
    const resumed = fixture({ records: [record('a')], saved: p.saved }); await resumed.run();
    assert.equal(resumed.calls.sends.length, 0); assert.equal(resumed.calls.prepares.length, 0);
    assert.equal(resumed.calls.verifies[0].hash, tx('a')); assert.equal(resumed.saved.size, 0);
});

test('pending confirmation never submits another ticket until it settles', async () => {
    const p = fixture({ verify: async () => ({ status: 'SUBMITTED' }) }); await p.run();
    assert.equal(p.calls.sends.length, 1); assert.equal(p.calls.verifies.length, 25);
    assert.equal(p.updates.at(-1).state, 'pending'); assert.equal(p.saved.size, 1);
});

test('wrong wallets, missing setup and blocked records cannot submit transactions', async () => {
    for (const options of [{ address: contract }, { configured: false }, { records: [{ ...record('a'), canSubmit: false, blockedReason: 'Blocked' }] }]) {
        const p = fixture(options); await assert.rejects(p.run()); assert.equal(p.calls.sends.length, 0);
    }
});

test('logout while connecting prevents submission; logout during send still saves recovery hash', async () => {
    const p = fixture({ onConnect: deactivate => deactivate() }); await p.run(); assert.equal(p.calls.sends.length, 0);
    const sent = fixture({ send: async (n, deactivate) => { deactivate(); return tx('a'); } });
    await sent.run(); assert.equal(sent.saved.get('ticksecure:buyer-chain:buyer:a'), tx('a'));
    assert.equal(sent.calls.verifies.length, 0);
});

test('already recorded operations are verified and reverted transactions stop without claiming mint success', async () => {
    const existing = fixture({ records: [record('a')], prepare: async () => ({ alreadyRecorded: true, transactionHash: tx('a') }) });
    await existing.run(); assert.equal(existing.calls.sends.length, 0); assert.equal(existing.calls.verifies.length, 1);
    const failed = fixture({ verify: async () => ({ status: 'FAILED' }) });
    await assert.rejects(failed.run(), /reverted/); assert.equal(failed.calls.sends.length, 1); assert.equal(failed.saved.size, 0);
    assert.ok(!failed.updates.some(state => state.state === 'complete'));
});

test('duplicate invocation and another tab holding the booking lock cannot start extra submissions', async () => {
    let release; const p = fixture({ send: () => new Promise(resolve => { release = resolve; }) });
    const first = p.run(); while (!release) await new Promise(resolve => setImmediate(resolve));
    await p.run(); assert.equal(p.calls.sends.length, 1); p.deactivate(); release(tx('a')); await first;
    const otherTab = fixture({ locks: { request: async (key, options, callback) => callback(null) } });
    await assert.rejects(otherTab.run(), /another tab/); assert.equal(otherTab.calls.sends.length, 0);
});

test('a known in-flight hash can recover even before the new organizer contract is configured',async()=>{
    const saved=new Map([['ticksecure:buyer-chain:buyer:a',tx('a')]]);
    const p=fixture({configured:false,records:[{...record('a'),configured:false,canSubmit:false}],saved});
    await p.run();assert.equal(p.calls.sends.length,0);assert.equal(p.calls.prepares.length,0);assert.equal(p.calls.verifies.length,1);
});
