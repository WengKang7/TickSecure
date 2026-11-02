const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const address = '0x' + '1'.repeat(40);
const context = vm.createContext({ TextEncoder, setTimeout });
vm.runInContext(fs.readFileSync('assets/js/demo-funding-client.js', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export async function', 'async function') + '\nglobalThis.fund = fundDemoWallet;', context);
function fixture(options = {}) {
    let active = true, count = 0;
    const calls = [], statuses = [], providerCalls = [];
    const run = () => context.fund({ walletAddress: address, recordId: options.noRecord ? undefined : 'ticket-operation', onlyIfNeeded: options.onlyIfNeeded, isActive: () => active, onStatus: text => statuses.push(text), wait: async () => {},
        provider: { request: async request => {
            providerCalls.push(request);
            if (request.method === 'eth_chainId') return '0xaa36a7';
            if (request.method === 'eth_accounts') return [options.wrongWallet ? '0x' + '2'.repeat(40) : address];
            if (request.method === 'eth_getBalance') return '0x2386f26fc10000'; // 0.01
            if (request.method === 'personal_sign') {
                if (options.cancel) throw Object.assign(Error('Cancelled'), { code: 4001 });
                if (options.logout) active = false;
                return 'signature';
            }
            throw Error('Unexpected provider request');
        } },
        invoke: async (data, config) => {
            calls.push({ data, name: config.name });
            if (config.name === 'getDemoFundingChallenge') return options.initial || { status: 'SIGN', message: 'Verify demo gas wallet' };
            if (options.pending) return { status: 'PENDING' };
            return { status: ++count === 1 ? 'PENDING' : 'FUNDED', walletAddress: address, amount: '0.01' };
        } });
    return { run, calls, statuses, providerCalls };
}
test('wallet connection signs a readable proof once then polls the same claim to confirmation', async () => {
    const p = fixture(); assert.equal((await p.run()).status, 'FUNDED');
    assert.equal(p.providerCalls.filter(call => call.method === 'personal_sign').length, 1);
    const signed = p.providerCalls.find(call => call.method === 'personal_sign');
    assert.equal(Buffer.from(signed.params[0].slice(2), 'hex').toString(), 'Verify demo gas wallet');
    assert.equal(signed.params[1], address);
    assert.equal(p.calls.filter(call => call.name === 'claimDemoFunding').length, 2);
    assert.match(p.statuses.at(-1), /0.01 SepoliaETH/);
});
test('cancelled signatures, changed wallets and logout cannot request a funding transfer', async () => {
    for (const options of [{ cancel: true }, { wrongWallet: true }, { logout: true }]) {
        const p = fixture(options); try { await p.run(); } catch (_) {}
        assert.equal(p.calls.some(call => call.name === 'claimDemoFunding'), false);
    }
});
test('unconfigured, empty, exhausted and sufficient responses never request wallet signatures', async () => {
    for (const status of ['UNAVAILABLE', 'EMPTY', 'LIMIT', 'ALREADY_CLAIMED', 'SUFFICIENT']) {
        const p = fixture({ initial: { status, message: 'Saved wallet' } }); await p.run();
        assert.equal(p.providerCalls.length, 0); assert.equal(p.calls.length, 1);
    }
});
test('already pending transfers are recovered without signing again or creating new funding requests', async () => {
    const p = fixture({ initial: { status: 'PENDING' }, pending: true });
    assert.equal((await p.run()).status, 'PENDING');
    assert.equal(p.providerCalls.length, 0); assert.equal(p.calls.filter(call => call.name === 'claimDemoFunding').length, 20);
    assert.match(p.statuses.at(-1), /no second funding transfer/);
});
test('funded buyers can mint without depending on the demo funding backend', async () => {
    const p = fixture({ onlyIfNeeded: true }); assert.equal((await p.run()).status, 'SUFFICIENT');
    assert.equal(p.calls.length, 0); assert.equal(p.providerCalls.some(call => call.method === 'personal_sign'), false);
});

test('a failed funding transfer stops the NFT flow before wallet transaction approval',async()=>{
    const p=fixture({initial:{status:'FAILED',walletAddress:address}});
    await assert.rejects(p.run(),/event organizer.*retry/);assert.equal(p.providerCalls.length,0);
});

test('wallet connection alone cannot choose or spend an organizer funding allowance',async()=>{
    const p=fixture({noRecord:true});assert.equal((await p.run()).status,'UNAVAILABLE');assert.equal(p.calls.length,0);assert.equal(p.providerCalls.length,0);
});
test('funding requests and polling stay bound to the selected ticket operation',async()=>{
    const p=fixture();await p.run();assert.ok(p.calls.length>1);for(const call of p.calls)assert.equal(call.data.recordId,'ticket-operation');
});
