import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {network} from 'hardhat';
import {BrowserProvider,ContractFactory,Interface,Wallet} from 'ethers';
const require=createRequire(import.meta.url),H=require('../../tests/blockchain-test-helpers.cjs');
const {createBlockchainService}=require('../../functions/blockchain.js');
const signing=require('../../functions/blockchain-signer.js');
const artifact=JSON.parse(fs.readFileSync(new URL('../../functions/blockchain-ticket-artifact.json',import.meta.url)));
test('buyers execute signed mint/transfer/resale on a real EVM; admin, wrong-wallet, forged, expired and replayed transactions fail',async t=>{
    const connection=await network.create('default');t.after(()=>connection.close());
    const provider=new BrowserProvider(connection.provider),admin=await provider.getSigner(0),alice=await provider.getSigner(1),bob=await provider.getSigner(2);
    const authorizationSigner=Wallet.createRandom(),contract=await new ContractFactory(artifact.abi,artifact.bytecode,admin).deploy(authorizationSigner.address);await contract.waitForDeployment();
    const address=(await contract.getAddress()).toLowerCase(),aliceWallet=(await alice.getAddress()).toLowerCase(),bobWallet=(await bob.getAddress()).toLowerCase();
    assert.ok(H.policy.runtimeMatches(await provider.getCode(address),artifact));
    const initial=H.records();initial['BlockchainSettings/sepolia']={...H.settings,contractAddress:address,operatorAddress:(await admin.getAddress()).toLowerCase(),signerAddress:authorizationSigner.address.toLowerCase()};
    initial['BlockchainTransactions/mint']={...H.mint,walletAddress:aliceWallet,actorWallet:aliceWallet};
    const db=H.database(initial),signer={identity:async()=>({signerAddress:authorizationSigner.address.toLowerCase()}),authorize:expected=>signing.authorize(expected,authorizationSigner,2000000000)};
    const rpc=(method,params=[])=>connection.provider.request({method,params}),s=createBlockchainService(db,{projectId:'test-project',rpc,fail:H.fail,signer});
    const iface=new Interface(artifact.abi);
    for(const [index,type] of ['MINT','TRANSFER','RESALE'].entries()){
        const id=index?'op'+index:'mint',receiver=index===1?bobWallet:aliceWallet;
        if(index){db.records['BlockchainTransactions/'+id]={...H.mint,id,transactionType:type,walletAddress:receiver,actorUid:'alice',actorWallet:aliceWallet,timestamp:'2026-10-30T0'+index+':00:00.000Z'};db.records['NFTTickets/ticket'].ownerUid=index===1?'bob':'alice';}
        const prepared=await s.prepare('alice',{recordId:id});
        await assert.rejects(s.prepare('admin',{recordId:id}),e=>e.code==='permission-denied');
        await assert.rejects(admin.sendTransaction({to:address,data:prepared.calldata}));
        await assert.rejects(bob.sendTransaction({to:address,data:prepared.calldata}));
        if(index===0){
            const decoded=iface.decodeFunctionData('recordOperation',prepared.calldata),badSignature='0x'+'11'.repeat(65);
            await assert.rejects(alice.sendTransaction({to:address,data:iface.encodeFunctionData('recordOperation',[decoded[0],badSignature])}));
            const expired=await signing.authorize(prepared,authorizationSigner,1);await assert.rejects(alice.sendTransaction({to:address,data:expired.calldata}));
        }
        const sent=await alice.sendTransaction({to:address,data:prepared.calldata});await sent.wait();await rpc('evm_mine');
        const result=await s.verify('alice',{recordId:id,transactionHash:sent.hash});assert.equal(result.status,'CONFIRMED');
        assert.equal((await contract.ownerOf(prepared.tokenId)).toLowerCase(),receiver);assert.equal(await contract.operations(prepared.operationId),prepared.recordHash);
        assert.equal(db.records['BlockchainTransactions/'+id].transactionHash,sent.hash);assert.equal(db.records['BlockchainTransactions/'+id].verificationVersion,2);
        await assert.rejects(alice.sendTransaction({to:address,data:prepared.calldata}));
        if(index===0)await assert.rejects(alice.sendTransaction({to:address,data:iface.encodeFunctionData('transferFrom',[aliceWallet,bobWallet,prepared.tokenId])}));
    }
    assert.equal(db.records['NFTTickets/ticket'].transactionHash,db.records['BlockchainTransactions/mint'].transactionHash);
    assert.equal(db.records['NFTTickets/ticket'].blockchainLastTransactionHash,db.records['BlockchainTransactions/op2'].transactionHash);
});
