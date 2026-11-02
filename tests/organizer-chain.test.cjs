const {test}=require('node:test');
const assert=require('node:assert/strict');
const H=require('./blockchain-test-helpers.cjs');
const {createBlockchainService}=require('../functions/blockchain');
const make=state=>{const db=H.database(state),p=H.provider();return {db,p,s:createBlockchainService(db,{projectId:'test-project',rpc:p.rpc,fail:H.fail,signer:H.signer})};};

function twoOrganizers(){
    const state=H.records();
    state['BlockchainSettings/sepolia'].contractAddress='0x'+'9'.repeat(40);
    state['BlockchainSettings/organizer_otherOrganizer']={...H.settings,organizerUid:'otherOrganizer',contractAddress:'0x'+'8'.repeat(40)};
    state['Events/eventB']={organizerUid:'otherOrganizer'};
    state['NFTTickets/ticketB']={...state['NFTTickets/ticket'],eventId:'eventB',organizerUid:'otherOrganizer',ownerUid:'bob'};
    state['BlockchainTransactions/mintB']={...H.mint,id:'mintB',ticketId:'ticketB',actorUid:'bob',actorWallet:H.bob,walletAddress:H.bob};
    return state;
}

test('Event A and Event B mint on their own organizer contracts, never the former admin contract',async()=>{
    const {s,p,db}=make(twoOrganizers());
    const a=await s.prepare('alice',{recordId:'mint',organizerUid:'otherOrganizer'}),b=await s.prepare('bob',{recordId:'mintB',organizerUid:'organizer'});
    assert.equal(a.contractAddress,H.contract);assert.equal(b.contractAddress,'0x'+'8'.repeat(40));
    assert.notEqual(a.contractAddress,db.records['BlockchainSettings/sepolia'].contractAddress);
    p.set(H.receipt(a));await s.verify('alice',{recordId:'mint',transactionHash:H.hash});
    const receiptB=H.receipt(b),hashB='0x'+'c'.repeat(64);receiptB.tx.hash=hashB;receiptB.receipt.transactionHash=hashB;p.set(receiptB);
    await s.verify('bob',{recordId:'mintB',transactionHash:hashB});
    assert.equal(db.records['NFTTickets/ticket'].contractAddress,a.contractAddress);
    assert.equal(db.records['NFTTickets/ticketB'].contractAddress,b.contractAddress);
    assert.equal(db.records['NFTTickets/ticket'].ownerUid,'alice');assert.equal(db.records['NFTTickets/ticketB'].ownerUid,'bob');
    assert.equal((await s.listOrganizer('organizer',{})).records.length,1);assert.equal((await s.listOrganizer('otherOrganizer',{})).records[0].ticketId,'ticketB');
});

test('missing organizer setup blocks new mints instead of falling back to the admin or another organizer',async()=>{
    const state=twoOrganizers();delete state['BlockchainSettings/organizer_organizer'];
    const {s}=make(state);await assert.rejects(s.prepare('alice',{recordId:'mint'}),/organizer.*setup/);
    assert.equal((await s.listBuyer('alice',{})).records[0].canSubmit,false);
    assert.equal((await s.prepare('bob',{recordId:'mintB'})).contractAddress,'0x'+'8'.repeat(40));
    assert.equal((await s.getSettings('organizer')).configured,false);assert.equal((await s.getSettings('otherOrganizer')).contractAddress,'0x'+'8'.repeat(40));
});

test('a public deployment hash cannot be registered to another organizer, even with a valid wallet proof',async()=>{
    const state=twoOrganizers(),p=H.provider(),db=H.database(state);
    const s=createBlockchainService(db,{projectId:'test-project',rpc:p.rpc,fail:H.fail,signer:H.signer});
    db.records['BlockchainDeployments/'+H.contract]={organizerUid:'organizer'};
    delete db.records['BlockchainSettings/organizer_otherOrganizer'];
    const config=await s.getSettings('otherOrganizer');
    p.set({tx:{hash:H.hash,from:H.issuer,to:null,input:config.deploymentBytecode,value:'0x0'},receipt:{transactionHash:H.hash,status:'0x1',contractAddress:H.contract,blockNumber:'0x10',blockHash:H.blockHash},height:'0x11',block:{hash:H.blockHash}});
    const walletSignature=await H.issuerWallet.signMessage(config.registrationMessagePrefix+H.hash);
    await assert.rejects(s.configure('otherOrganizer',{transactionHash:H.hash,walletSignature}),/already assigned/);
    assert.equal(db.records['BlockchainSettings/organizer_otherOrganizer'],undefined);
});

test('already minted legacy tickets keep their original contract and do not get minted a second time',async()=>{
    const state=twoOrganizers(),legacy=state['BlockchainSettings/sepolia'];
    Object.assign(state['BlockchainTransactions/mint'],{status:'CONFIRMED',verificationVersion:2,chainId:11155111,contractAddress:legacy.contractAddress,transactionHash:H.hash});
    const {s}=make(state);const operation=await s.prepare('alice',{recordId:'mint'});
    assert.equal(operation.alreadyRecorded,true);assert.equal(operation.contractAddress,legacy.contractAddress);
    const records=await s.listBuyer('alice',{});assert.equal(records.records[0].status,'CONFIRMED');assert.equal(records.records[0].canSubmit,false);
});

test('a signed legacy mint can still confirm after the organizer routing switch without resubmission',async()=>{
    const state=twoOrganizers(),legacy=state['BlockchainSettings/sepolia'];
    const expected={...H.policy.operation('test-project',legacy,H.mint,[H.mint],H.artifact,H.fail),actorWallet:H.alice};
    const auth=await H.signer.authorize(expected),prepared={...expected,...auth};
    state['BlockchainAuthorizations/'+H.policy.hash(auth.calldata).slice(2)]={...prepared,actorUid:'alice',recordId:'mint'};
    const {s,p,db}=make(state);p.set(H.receipt(prepared));
    await s.verify('alice',{recordId:'mint',transactionHash:H.hash});assert.equal(db.records['NFTTickets/ticket'].contractAddress,legacy.contractAddress);
});

test('forged organizer metadata on a ticket cannot redirect a buyer operation',async()=>{
    const state=twoOrganizers();state['NFTTickets/ticket'].organizerUid='otherOrganizer';
    await assert.rejects(make(state).s.prepare('alice',{recordId:'mint'}),/organizer could not be verified/);
});
