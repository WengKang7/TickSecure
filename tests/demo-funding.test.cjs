const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Wallet, Transaction, keccak256 } = require('../functions/node_modules/ethers');
const { createHash } = require('node:crypto');
const { createDemoFundingService, organizerWallet, AMOUNT, DAILY_LIMIT } = require('../functions/demo-funding');
const funding = new Wallet('0x' + '11'.repeat(32)); // Test-only keys; never used on a public network.
const alice = new Wallet('0x' + '22'.repeat(32)), bob = new Wallet('0x' + '33'.repeat(32));
const digest = value => createHash('sha256').update(value).digest('hex');
const scoped = value => digest('organizer:'+value);
const hex = value => '0x' + BigInt(value).toString(16);
function database(initial) {
    let records = structuredClone(initial), tail = Promise.resolve();
    const snap = (key, state = records) => ({ exists: Object.hasOwn(state, key), data: () => structuredClone(state[key]) });
    const collection=(name,filters=[],limit=Infinity)=>({doc:key=>({key:name+'/'+key,get:async()=>snap(name+'/'+key)}),
        where:(field,op,value)=>collection(name,[...filters,[field,value]],limit),limit:count=>collection(name,filters,count),
        get:async()=>({docs:Object.keys(records).filter(key=>key.startsWith(name+'/')&&filters.every(([field,value])=>records[key][field]===value)).slice(0,limit).map(key=>({...snap(key),id:key.split('/')[1]}))})});
    return { get records() { return records; }, collection,
        runTransaction: action => {
            const run = tail.then(async () => {
                const stage = structuredClone(records); let writes = false;
                const result = await action({ get: async ref => { assert.equal(writes, false, 'Firestore requires all reads before writes'); return snap(ref.key, stage); },
                    create: (ref, value) => { writes = true; assert.equal(Object.hasOwn(stage, ref.key), false); stage[ref.key] = structuredClone(value); },
                    set: (ref, value) => { writes = true; stage[ref.key] = structuredClone(value); },
                    update: (ref, value) => { writes = true; assert.ok(stage[ref.key]); Object.assign(stage[ref.key], structuredClone(value)); } });
                records = stage; return result;
            }); tail = run.catch(() => {}); return run;
        } };
}
function fixture(options = {}) {
    const wallets=options.separateWallets?{organizer:organizerWallet(funding.privateKey,'organizer'),otherOrganizer:organizerWallet(funding.privateKey,'otherOrganizer')}:{organizer:funding};
    const addresses=new Set(Object.values(wallets).map(w=>w.address.toLowerCase())),nonces=new Map();
    const profile = wallet => ({ role: 'buyer', status: 'active', emailVerified: true, walletAddress: wallet.address });
    const db = database({ 'Users/alice': profile(alice), 'Users/bob': profile(bob), 'Users/admin': { role: 'admin', status: 'active' },'Users/organizer':{role:'organizer',status:'active',emailVerified:true},'Events/event':{organizerUid:'organizer'},'NFTTickets/alice-ticket':{eventId:'event'},'NFTTickets/bob-ticket':{eventId:'event'},'BlockchainTransactions/alice-mint':{ticketId:'alice-ticket',transactionType:'MINT',actorUid:'alice',actorWallet:alice.address},'BlockchainTransactions/bob-mint':{ticketId:'bob-ticket',transactionType:'MINT',actorUid:'bob',actorWallet:bob.address} });
    let clock = Date.parse('2026-11-01T03:00:00Z'), sequence = 0, balance = 1000000000000000000n;
    const transfers = new Map(), receipts = new Map(), calls = [];
    const rpc = async (method, params = []) => {
        calls.push({ method, params });
        switch (method) {
            case 'eth_chainId': return options.wrongChain ? '0x1' : '0xaa36a7';
            case 'eth_getBalance': return hex(addresses.has(params[0].toLowerCase()) ? options.empty ? 0n : balance : options.sufficient ? AMOUNT : 0n);
            case 'eth_getCode': return options.contractWallet ? '0x1234' : '0x';
            case 'eth_getTransactionCount': return hex(options.staleNonce ? 0 : nonces.get(params[0].toLowerCase())||0);
            case 'eth_estimateGas': if(options.estimateError)throw Error('simulation unavailable');return hex(options.estimatedGas||21000);
            case 'eth_feeHistory': return { baseFeePerGas: ['0x0', hex(options.expensive ? 2000000000 : 0)], reward: [['0x0']] };
            case 'eth_getTransactionReceipt': return receipts.get(params[0]) || null;
            case 'eth_blockNumber': return '0x11';
            case 'eth_getBlockByNumber': return { hash: options.reorg ? '0xwrong' : '0xblock' };
            case 'eth_sendRawTransaction': {
                const hash = keccak256(params[0]);
                // The transfer must be durably recorded before any broadcast.
                assert.ok(Object.values(db.records).some(row => row.rawTransaction === params[0] && row.status === 'PENDING'));
                if (!transfers.has(hash)) {
                    const tx = Transaction.from(params[0]);
                    assert.equal(tx.chainId, 11155111n); assert.equal(tx.value, options.legacyAmount || AMOUNT); assert.equal(tx.gasLimit,options.legacyAmount?21000n:(BigInt(options.estimatedGas||21000)*120n+99n)/100n);
                    assert.ok(tx.maxFeePerGas <= 100000000n); assert.ok(addresses.has(tx.from.toLowerCase()));
                    transfers.set(hash, tx); nonces.set(tx.from.toLowerCase(),tx.nonce+1); balance -= AMOUNT + tx.gasLimit * tx.maxFeePerGas;
                }
                if (!options.pending) receipts.set(hash, { transactionHash: hash, status: options.reverted ? '0x0' : '0x1', blockHash: '0xblock', blockNumber: '0x10' });
                if (options.broadcastError) throw Error('RPC timeout after acceptance');
                return hash;
            }
            default: throw Error('Unexpected RPC ' + method);
        }
    };
    const service = createDemoFundingService(db, { projectId: 'test-project', fail: (code, message) => { throw Object.assign(Error(message), { code }); },
        enabled: () => !options.disabled, wallet: async organizerUid => { if (options.noKey) throw Error('Missing'); return wallets[organizerUid]; },
        rpc, now: () => clock, nonce: () => String(++sequence) });
    async function proof(uid = 'alice', wallet = alice) {
        const challenge = await service.challenge(uid, { walletAddress: wallet.address, recordId: uid+'-mint' });
        return { walletAddress: wallet.address, recordId: uid+'-mint', signature: challenge.status === 'SIGN' ? await wallet.signMessage(challenge.message) : undefined };
    }
    return { service, db, proof, transfers, calls, receipts, wallets, advance: ms => { clock += ms; },
        async claim(uid = 'alice', wallet = alice) { return service.claim(uid, await proof(uid, wallet)); } };
}

test('verified wallet proof gets exactly one fixed Sepolia allowance and exposes no raw transaction or key', async () => {
    const p = fixture(); const result = await p.claim();
    assert.equal(result.status, 'PENDING'); assert.equal(result.amount, '0.0001');
    const done = await p.service.claim('alice', { walletAddress: alice.address, recordId: 'alice-mint' }); assert.equal(done.status, 'FUNDED');
    assert.equal(p.transfers.size, 1); assert.equal(Object.hasOwn(done, 'rawTransaction'), false); assert.doesNotMatch(JSON.stringify(done), /privateKey/);
    assert.equal(await p.service.claim('alice', { walletAddress: alice.address, recordId: 'alice-mint' }).then(r => r.status), 'FUNDED'); assert.equal(p.transfers.size, 1);
});

test('unverified, suspended, organizer, unknown accounts and unsaved wallets cannot request funding', async () => {
    for (const patch of [{ emailVerified: false }, { status: 'suspended' }, { role: 'organizer' }]) {
        const p = fixture(); Object.assign(p.db.records['Users/alice'], patch);
        await assert.rejects(p.proof(), error => error.code === 'permission-denied'); assert.equal(p.transfers.size, 0);
    }
    const p = fixture(); await assert.rejects(p.proof('unknown')); await assert.rejects(p.service.challenge('alice', { walletAddress: bob.address, recordId: 'bob-mint' }));
});

test('a copied address, forged proof, expired proof and challenge from another account cannot receive funds', async () => {
    const p = fixture(); const proof = await p.proof();
    await assert.rejects(p.service.claim('alice', { ...proof, signature: await bob.signMessage('forged') }), /Sign the demo/);
    await assert.rejects(p.service.claim('bob', proof));
    p.advance(300001); await assert.rejects(p.service.claim('alice', proof), /expired/); assert.equal(p.transfers.size, 0);
});

test('concurrent duplicate requests and ambiguous broadcast responses reuse the same signed transfer', async () => {
    const p = fixture({ broadcastError: true }); const proof = await p.proof();
    await Promise.all([p.service.claim('alice', proof), p.service.claim('alice', proof)]);
    await p.service.claim('alice', proof); assert.equal(p.transfers.size, 1);
    assert.equal(Object.keys(p.db.records).filter(key => key.startsWith('DemoFundingClaims/')).length, 1);
});

test('a wallet cannot collect again through another account, and an account cannot collect again with a new wallet', async () => {
    const p = fixture(); await p.claim(); await p.service.claim('alice', { walletAddress: alice.address, recordId: 'alice-mint' });
    p.db.records['Users/bob'].walletAddress = alice.address;
    p.db.records['BlockchainTransactions/bob-mint'].actorWallet=alice.address;
    const denied = await p.service.challenge('bob', { walletAddress: alice.address, recordId: 'bob-mint' }); assert.equal(denied.status, 'ALREADY_CLAIMED');
    p.db.records['Users/alice'].walletAddress = bob.address;
    p.db.records['BlockchainTransactions/alice-mint'].actorWallet=bob.address;
    const again = await p.service.challenge('alice', { walletAddress: bob.address, recordId: 'alice-mint' }); assert.equal(again.walletAddress, alice.address.toLowerCase());
    assert.equal(p.transfers.size, 1);
});

test('one pending funding transfer serializes different buyers and survives process recovery', async () => {
    const p = fixture({ pending: true }); await p.claim();
    const second = await p.claim('bob', bob); assert.equal(second.status, 'BUSY'); assert.equal(p.transfers.size, 1);
    const hash = [...p.transfers.keys()][0]; p.receipts.set(hash, { transactionHash: hash, status: '0x1', blockHash: '0xblock', blockNumber: '0x10' });
    await p.claim('bob', bob); assert.equal(p.transfers.size, 2);
    assert.equal([...p.transfers.values()][1].nonce, 1);
});

test('persisted nonce prevents reuse when a provider has a stale pending nonce', async () => {
    const p = fixture({ staleNonce: true }); await p.claim(); await p.service.claim('alice', { walletAddress: alice.address, recordId: 'alice-mint' }); await p.claim('bob', bob);
    assert.deepEqual([...p.transfers.values()].map(tx => tx.nonce), [0, 1]);
});

test('daily budget includes maximum gas and remains reserved across failures; another day does not reset personal allowances', async () => {
    const p = fixture(); const budgetKey = 'DemoFundingBudgets/'+scoped('2026-11-01');
    p.db.records[budgetKey] = { reservedWei: (DAILY_LIMIT - AMOUNT).toString() };
    assert.equal((await p.claim()).status, 'LIMIT'); assert.equal(p.transfers.size, 0);
    p.advance(24 * 60 * 60 * 1000); await p.claim(); await p.service.claim('alice', { walletAddress: alice.address, recordId: 'alice-mint' });
    p.advance(24 * 60 * 60 * 1000); assert.equal((await p.claim()).status, 'FUNDED'); assert.equal(p.transfers.size, 1);
});

test('disabled, unconfigured, empty, already funded, wrong-chain and contract-wallet cases do not broadcast', async () => {
    for (const [options, status] of [[{ disabled: true }, 'UNAVAILABLE'], [{ noKey: true }, 'UNAVAILABLE'], [{ empty: true }, 'EMPTY'], [{ sufficient: true }, 'SUFFICIENT']]) {
        const p = fixture(options); assert.equal((await p.service.challenge('alice', { walletAddress: alice.address, recordId: 'alice-mint' })).status, status); assert.equal(p.transfers.size, 0);
    }
    for (const options of [{ wrongChain: true }, { contractWallet: true }, { expensive: true }]) {
        const p = fixture(options); await assert.rejects(p.claim()); assert.equal(p.transfers.size, 0);
    }
});

test('reverted funding remains a consumed allowance and noncanonical receipts never mark it funded', async () => {
    const p = fixture({ reverted: true }); await p.claim();
    assert.equal((await p.service.claim('alice', { walletAddress: alice.address, recordId: 'alice-mint' })).status, 'FAILED'); assert.equal(p.transfers.size, 1);
    const reorg = fixture({ reorg: true }); await reorg.claim();
    assert.equal((await reorg.service.claim('alice', { walletAddress: alice.address, recordId: 'alice-mint' })).status, 'PENDING');
});

test('only organizers can read the funding wallet status, and signer/organizer wallets cannot be used as the treasury', async () => {
    const p = fixture(); await assert.rejects(p.service.settings('alice'));
    const settings = await p.service.settings('organizer'); assert.equal(settings.fundingWallet, funding.address.toLowerCase());
    assert.doesNotMatch(JSON.stringify(settings), /rawTransaction|privateKey/);
    p.db.records['BlockchainSettings/organizer_organizer'] = { signerAddress: funding.address };
    await assert.rejects(p.proof(), /separate demo funding wallet/);
});

test('lower allowance preserves an existing signed legacy transfer, actual amount and one-time protection', async () => {
    const legacyAmount=10000000000000000n,p=fixture({legacyAmount}),key=scoped('alice');
    const raw=await funding.signTransaction({type:2,chainId:11155111,nonce:0,to:alice.address,value:legacyAmount,gasLimit:21000,maxFeePerGas:1000000,maxPriorityFeePerGas:1000000});
    const hash=keccak256(raw);
    p.db.records['DemoFundingClaims/'+key]={uid:'alice',organizerUid:'organizer',recordId:'alice-mint',ticketId:'alice-ticket',eventId:'event',walletAddress:alice.address.toLowerCase(),fundingWallet:funding.address.toLowerCase(),amountWei:legacyAmount.toString(),status:'PENDING',rawTransaction:raw,transactionHash:hash};
    p.db.records['DemoFundingState/'+digest('organizer')]={pendingClaimId:key,nextNonce:'1'};
    p.db.records['DemoFundingWallets/'+scoped(alice.address.toLowerCase())]={uid:'alice',claimId:key};
    p.db.records['DemoFundingBudgets/'+scoped('2026-11-01')]={reservedWei:'10000000021000000'};
    const pending=await p.service.claim('alice',{walletAddress:alice.address,recordId:'alice-mint'});assert.equal(pending.amount,'0.01');
    const done=await p.service.claim('alice',{walletAddress:alice.address,recordId:'alice-mint'});assert.equal(done.status,'FUNDED');assert.equal(done.amount,'0.01');
    assert.equal(p.transfers.size,1);assert.equal([...p.transfers.keys()][0],hash);
    assert.equal(p.db.records['DemoFundingBudgets/'+scoped('2026-11-01')].reservedWei,'10000000021000000');
});

test('old allowance challenges cannot authorize a new reduced grant and are replaced with an accurate proof', async () => {
    const p=fixture(),key='DemoFundingChallenges/'+scoped('alice');
    p.db.records[key]={uid:'alice',organizerUid:'organizer',recordId:'alice-mint',walletAddress:alice.address.toLowerCase(),expiresAt:Date.now()+1e12,amountWei:'10000000000000000',message:'Old 0.01 allowance'};
    await assert.rejects(p.service.claim('alice',{walletAddress:alice.address,recordId:'alice-mint',signature:await alice.signMessage('Old 0.01 allowance')}),/allowance changed/);
    const challenge=await p.service.challenge('alice',{walletAddress:alice.address,recordId:'alice-mint'});
    assert.match(challenge.message,/Allowance: 0.0001 SepoliaETH/);assert.equal(p.transfers.size,0);
});

test('funding a new account estimates its actual execution gas rather than assuming 21000',async()=>{
    const p=fixture({estimatedGas:207391});await p.claim();
    const transfer=[...p.transfers.values()][0];assert.equal(transfer.gasLimit,248870n);
    const claim=Object.values(p.db.records).find(row=>row.rawTransaction);
    assert.equal(BigInt(claim.maximumGasWei),248870n*transfer.maxFeePerGas);
    assert.ok(p.calls.some(call=>call.method==='eth_estimateGas'));
    for(const options of[{estimatedGas:500001},{estimateError:true}]){
        const blocked=fixture(options);await assert.rejects(blocked.claim());assert.equal(blocked.transfers.size,0);
        assert.equal(Object.keys(blocked.db.records).some(key=>key.startsWith('DemoFundingClaims/')),false);
    }
});

test('only an organizer can retry a canonically failed grant once, using estimated gas and a new nonce',async()=>{
    const options={reverted:true,estimatedGas:207391},p=fixture(options),key=scoped('alice');
    await p.claim();await p.service.claim('alice',{walletAddress:alice.address,recordId:'alice-mint'});
    const oldHash=p.db.records['DemoFundingClaims/'+key].transactionHash;
    await assert.rejects(p.service.retryFailed('bob',{claimId:key}),/organizer/i);
    options.reverted=false;
    const settings=await p.service.settings('organizer');assert.equal(settings.failedClaims[0].retryAvailable,true);
    const retry=await p.service.retryFailed('organizer',{claimId:key});assert.equal(retry.status,'PENDING');
    assert.equal(p.transfers.size,2);assert.notEqual(retry.transactionHash,oldHash);
    const current=p.db.records['DemoFundingClaims/'+key];
    assert.equal(current.nonce,1);assert.equal(current.retryCount,1);assert.equal(current.previousAttempts[0].transactionHash,oldHash);
    assert.equal((await p.service.claim('alice',{walletAddress:alice.address,recordId:'alice-mint'})).status,'FUNDED');
    await assert.rejects(p.service.retryFailed('organizer',{claimId:key}));assert.equal(p.transfers.size,2);
});

test('pending, reorged, successful, budget-exhausted and concurrently retried grants cannot get duplicate retries',async()=>{
    const pending=fixture({pending:true});await pending.claim();await assert.rejects(pending.service.retryFailed('organizer',{claimId:scoped('alice')}));assert.equal(pending.transfers.size,1);
    const options={reverted:true},p=fixture(options),key=scoped('alice');
    await p.claim();await p.service.claim('alice',{walletAddress:alice.address,recordId:'alice-mint'});
    options.reorg=true;await assert.rejects(p.service.retryFailed('organizer',{claimId:key}),/canonical/);options.reorg=false;
    p.db.records['DemoFundingBudgets/'+scoped('2026-11-01')].reservedWei=DAILY_LIMIT.toString();
    await assert.rejects(p.service.retryFailed('organizer',{claimId:key}),/budget/);assert.equal(p.transfers.size,1);
    p.db.records['DemoFundingBudgets/'+scoped('2026-11-01')].reservedWei='0';options.reverted=false;
    const results=await Promise.allSettled([p.service.retryFailed('organizer',{claimId:key}),p.service.retryFailed('organizer',{claimId:key})]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(p.transfers.size,2);
});

test('organizer wallets, budgets, nonce locks and failure review stay independent',async()=>{
    const p=fixture({separateWallets:true,pending:true});
    p.db.records['Users/otherOrganizer']={role:'organizer',status:'active',emailVerified:true};
    p.db.records['Events/otherEvent']={organizerUid:'otherOrganizer'};
    p.db.records['NFTTickets/bob-ticket'].eventId='otherEvent';
    const a=await p.service.settings('organizer'),b=await p.service.settings('otherOrganizer');
    assert.notEqual(a.fundingWallet,b.fundingWallet);assert.notEqual(a.fundingWallet,funding.address.toLowerCase());
    await p.claim();await p.claim('bob',bob);
    const sent=[...p.transfers.values()];assert.equal(sent.length,2);assert.deepEqual(sent.map(tx=>tx.nonce),[0,0]);
    assert.equal(sent[0].from.toLowerCase(),a.fundingWallet);assert.equal(sent[1].from.toLowerCase(),b.fundingWallet);
    assert.ok(p.db.records['DemoFundingBudgets/'+digest('organizer:2026-11-01')]);
    assert.ok(p.db.records['DemoFundingBudgets/'+digest('otherOrganizer:2026-11-01')]);
    const claimId=scoped('alice');await assert.rejects(p.service.retryFailed('otherOrganizer',{claimId}),/not found/);
    assert.equal(Object.keys(p.db.records).some(key=>key==='DemoFundingState/sepolia'),false);
});

test('a buyer cannot choose another organizer or obtain funding without an eligible ticket operation',async()=>{
    const p=fixture();
    const noTicket=await p.service.challenge('alice',{walletAddress:alice.address,organizerUid:'organizer'});assert.equal(noTicket.status,'UNAVAILABLE');
    await assert.rejects(p.service.challenge('alice',{walletAddress:alice.address,recordId:'bob-mint',organizerUid:'organizer'}),e=>e.code==='permission-denied');
    await assert.rejects(p.service.settings('admin'),e=>e.code==='permission-denied');
    const proof=await p.proof();p.db.records['Events/event'].organizerUid='unknown';
    await assert.rejects(p.service.claim('alice',proof));assert.equal(p.transfers.size,0);
});

test('completed NFT operations do not consume a new allowance and root key derivation is stable',async()=>{
    const p=fixture();p.db.records['BlockchainTransactions/alice-mint'].status='CONFIRMED';
    assert.equal((await p.claim()).status,'SUFFICIENT');assert.equal(p.transfers.size,0);
    assert.equal(organizerWallet(funding.privateKey,'organizer').address,organizerWallet(funding.privateKey,'organizer').address);
    assert.notEqual(organizerWallet(funding.privateKey,'organizer').address,organizerWallet(funding.privateKey,'otherOrganizer').address);
    assert.throws(()=>organizerWallet('bad-key','organizer'));
});
