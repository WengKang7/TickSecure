const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {createBlockchainService}=require('../functions/blockchain');
const H=require('./blockchain-test-helpers.cjs');
const {policy,artifact,alice,bob,charlie,contract,issuer,hash,settings,mint,fail,records,database,signer,receipt,provider}=H;
const service=(db,p=provider())=>({s:createBlockchainService(db,{projectId:'test-project',rpc:p.rpc,fail,signer}),p});
async function prepared(state=records(),uid='alice',recordId='mint'){const db=database(state),{s,p}=service(db);const operation=await s.prepare(uid,{recordId});p.set(receipt(operation));return {db,s,p,operation};}
test('only the responsible buyer can authorize operations; admins and organizers have no submission permission',async()=>{
    const state=records(),db=database(state),{s}=service(db);
    for(const uid of ['admin','organizer','outsider','bob']){await assert.rejects(s.prepare(uid,{recordId:'mint'}),e=>e.code==='permission-denied');await assert.rejects(s.verify(uid,{recordId:'mint',transactionHash:hash}),e=>e.code==='permission-denied');}
    assert.deepEqual(db.records,state);const operation=await s.prepare('alice',{recordId:'mint'});assert.equal(operation.actorWallet,alice);assert.ok(operation.deadline);assert.ok(operation.calldata.startsWith(artifact.selectors.recordOperation));
    const auth=db.records['BlockchainAuthorizations/'+policy.hash(operation.calldata).slice(2)];assert.equal(auth.actorUid,'alice');assert.equal(auth.recordHash,operation.recordHash);assert.doesNotMatch(JSON.stringify(operation),/privateKey|mnemonic|PRIVATE@|SECRET-QR/);
});
test('buyer confirmation persists real hashes and token metadata atomically and repeated verification is idempotent',async()=>{
    const {db,s}=await prepared();const result=await s.verify('alice',{recordId:'mint',transactionHash:hash});assert.equal(result.status,'CONFIRMED');
    assert.equal(db.records['BlockchainTransactions/mint'].verificationVersion,2);assert.equal(db.records['NFTTickets/ticket'].transactionHash,hash);assert.equal(db.records['NFTTickets/ticket'].mintingStatus,'MINTED');
    const before=structuredClone(db.records);await s.verify('alice',{recordId:'mint',transactionHash:hash});assert.deepEqual(db.records,before);
});
test('mismatched sender, value, calldata, event, receipt and canonical block never confirm a ticket',async()=>{
    for(const modify of [f=>{f.tx.from=issuer;},f=>{f.tx.value='0x1';},f=>{f.tx.input+='00';},f=>{f.receipt.logs=[];},f=>{f.block.hash='0x'+'c'.repeat(64);},f=>{f.tx.hash='0x'+'d'.repeat(64);} ]){
        const {db,s,p,operation}=await prepared(),before=structuredClone(db.records),f=receipt(operation);modify(f);p.set(f);await assert.rejects(s.verify('alice',{recordId:'mint',transactionHash:hash}));assert.deepEqual(db.records,before);
    }
});
test('submitted hashes remain pending until two confirmations and reverted transactions do not mint',async()=>{
    for(const [mutate,status]of [[f=>{f.receipt=null;},'SUBMITTED'],[f=>{f.height='0x10';},'SUBMITTED'],[f=>{f.receipt.status='0x0';},'FAILED']]){
        const {db,s,p,operation}=await prepared(),f=receipt(operation);mutate(f);p.set(f);const result=await s.verify('alice',{recordId:'mint',transactionHash:hash});assert.equal(result.status,status);assert.equal(db.records['BlockchainTransactions/mint'].transactionHash,hash);assert.equal(db.records['NFTTickets/ticket'].mintingStatus,undefined);
    }
});
test('the sender performs transfers and the resale buyer performs resale; operation order and original mint hash are preserved',async()=>{
    const first=await prepared();await first.s.verify('alice',{recordId:'mint',transactionHash:hash});let state=structuredClone(first.db.records);
    const transfer={...mint,id:'transfer',transactionType:'TRANSFER',actorUid:'alice',actorWallet:alice,walletAddress:bob,relatedEntityType:'ticket',relatedEntityId:'ticket',timestamp:'2026-10-30T01:00:00.000Z'};state['BlockchainTransactions/transfer']=transfer;state['NFTTickets/ticket'].ownerUid='bob';
    const second=await prepared(state,'alice','transfer');await assert.rejects(second.s.prepare('bob',{recordId:'transfer'}),e=>e.code==='permission-denied');const transferHash='0x'+'e'.repeat(64),f=receipt(second.operation);f.tx.hash=transferHash;f.receipt.transactionHash=transferHash;second.p.set(f);await second.s.verify('alice',{recordId:'transfer',transactionHash:transferHash});
    state=structuredClone(second.db.records);const resale={...mint,id:'resale',transactionType:'RESALE',actorUid:'charlie',actorWallet:charlie,walletAddress:charlie,relatedEntityType:'resale',relatedEntityId:'listing',timestamp:'2026-10-30T02:00:00.000Z'};state['BlockchainTransactions/resale']=resale;state['NFTTickets/ticket'].ownerUid='charlie';
    const third=await prepared(state,'charlie','resale');await assert.rejects(third.s.prepare('bob',{recordId:'resale'}),e=>e.code==='permission-denied');const resaleHash='0x'+'f'.repeat(64),g=receipt(third.operation);g.tx.hash=resaleHash;g.receipt.transactionHash=resaleHash;third.p.set(g);await third.s.verify('charlie',{recordId:'resale',transactionHash:resaleHash});
    assert.equal(third.db.records['NFTTickets/ticket'].transactionHash,hash);assert.equal(third.db.records['NFTTickets/ticket'].blockchainLastTransactionHash,resaleHash);assert.equal(third.db.records['NFTTickets/ticket'].ownerUid,'charlie');
    const unordered=records();unordered['BlockchainTransactions/transfer']=transfer;await assert.rejects(service(database(unordered)).s.prepare('alice',{recordId:'transfer'}),/earlier blockchain/);
});
test('buyer/organizer views are scoped by account and event, and profile wallet spoofing grants no access',async()=>{
    const state=records();state['Users/outsider'].walletAddress=alice;const db=database(state),{s}=service(db);
    assert.equal((await s.listBuyer('outsider',{})).records.length,0);assert.equal((await s.listBuyer('alice',{})).records[0].canSubmit,true);
    assert.equal((await s.listOrganizer('organizer',{})).records.length,1);assert.equal((await s.listOrganizer('otherOrganizer',{})).records.length,0);assert.equal((await s.listOrganizer('organizer',{})).records[0].canSubmit,false);
    const safe=await s.listBuyer('alice',{});assert.doesNotMatch(JSON.stringify(safe),/PRIVATE@|SECRET-QR|actorUid|calldata|signature|privateKey/);
    await assert.rejects(s.listBuyer('outsider',{bookingId:'booking'}),e=>e.code==='not-found');
    const buyerSettings=await s.getSettings('alice');assert.equal(buyerSettings.deploymentBytecode,undefined);await assert.rejects(s.configure('alice',{transactionHash:hash}),e=>e.code==='permission-denied');
    for(const patch of [{status:'suspended'},{emailVerified:false}]){const altered=records();Object.assign(altered['Users/alice'],patch);await assert.rejects(service(database(altered)).s.prepare('alice',{recordId:'mint'}),e=>e.code==='permission-denied');}
});
test('legacy records resolve their responsible buyer from bookings, transfer history and resale purchases',async()=>{
    const state=records();delete state['BlockchainTransactions/mint'].actorUid;delete state['BlockchainTransactions/mint'].actorWallet;const result=await prepared(state);assert.equal(result.operation.actorWallet,alice);
    const before=records();before['BlockchainTransactions/mint']={...before['BlockchainTransactions/mint'],status:'CONFIRMED',verificationVersion:2,chainId:11155111,contractAddress:contract,transactionHash:hash};
    const transfer={...mint,id:'old',transactionType:'TRANSFER',walletAddress:bob,timestamp:'2026-10-30T01:00:00.000Z'};delete transfer.actorUid;delete transfer.actorWallet;before['BlockchainTransactions/old']=transfer;before['NFTTickets/ticket'].ownerUid='bob';before['NFTTickets/ticket'].transferHistory=[{fromUid:'alice',fromWallet:alice,toUid:'bob',toWallet:bob,timestamp:transfer.timestamp}];
    const transferred=await prepared(before,'alice','old');assert.equal(transferred.operation.actorWallet,alice);
});
test('admin setup verifies constructor signer and cannot replace a registered contract',async()=>{
    const state=records();state['Users/admin'].emailVerified=false;delete state['BlockchainSettings/sepolia'];const db=database(state),p=provider(),s=service(db,p).s;
    const setup=await s.getSettings('admin');assert.equal(setup.deploymentBytecode,artifact.bytecode+policy.word(settings.signerAddress));assert.equal((await s.getSettings('alice')).deploymentBytecode,undefined);
    const f={tx:{hash,from:issuer,to:null,input:setup.deploymentBytecode,value:'0x0'},receipt:{transactionHash:hash,status:'0x1',contractAddress:contract,blockNumber:'0x10',blockHash:H.blockHash},height:'0x11',block:{hash:H.blockHash}};p.set(f);
    const result=await s.configure('admin',{transactionHash:hash});assert.equal(result.contractVersion,2);assert.equal(result.signerAddress,settings.signerAddress);
    const locked=records();locked['BlockchainSettings/sepolia'].contractAddress=bob;const other=service(database(locked),p);await assert.rejects(other.s.configure('admin',{transactionHash:hash}),/already registered/);
});
test('admin email verification is optional; role, active status and other roles verification remain enforced',async()=>{
    for(const value of [false,undefined]){const state=records();if(value===undefined)delete state['Users/admin'].emailVerified;else state['Users/admin'].emailVerified=value;
        const s=service(database(state)).s;assert.equal((await s.getSettings('admin')).configured,true);await assert.rejects(s.prepare('admin',{recordId:'mint'}),e=>e.code==='permission-denied');}
    for(const patch of [{status:'suspended'},{status:'deleted'},{role:'buyer',emailVerified:false}]){const state=records();Object.assign(state['Users/admin'],patch);await assert.rejects(service(database(state)).s.getSettings('admin'),e=>e.code==='permission-denied');}
    for(const uid of ['alice','organizer'])for(const value of [false,undefined]){const state=records();if(value===undefined)delete state['Users/'+uid].emailVerified;else state['Users/'+uid].emailVerified=value;
        await assert.rejects(service(database(state)).s.getSettings(uid),e=>e.code==='permission-denied');}
});
test('MetaMask sends only on Sepolia, transfers zero ETH value and rejects a changed wallet',async()=>{
    const calls=[],account={value:alice},chain={value:'0xaa36a7'},window={ethereum:{request:async request=>{calls.push(request);return request.method==='eth_chainId'?chain.value:request.method==='eth_sendTransaction'?hash:[account.value];}}};
    vm.runInContext(fs.readFileSync('assets/js/blockchain-wallet.js','utf8'),vm.createContext({window}));await window.tsChainWallet.connect();await window.tsChainWallet.send({from:alice,to:contract,data:'0x1234'});
    assert.equal(calls.find(r=>r.method==='eth_sendTransaction').params[0].value,'0x0');account.value=bob;await assert.rejects(window.tsChainWallet.send({from:alice,to:contract,data:'0x1234'}),/wallet changed/);
    account.value=alice;chain.value='0x1';await assert.rejects(window.tsChainWallet.send({from:alice,to:contract,data:'0x1234'}),/network changed/);assert.equal(calls.filter(r=>r.method==='eth_sendTransaction').length,1);
});
