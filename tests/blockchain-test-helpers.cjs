const {Wallet}=require('../functions/node_modules/ethers');
const policy=require('../functions/blockchain-policy');
const signing=require('../functions/blockchain-signer');
const artifact=require('../functions/blockchain-ticket-artifact.json');
const authorizer=new Wallet('0x'+'01'.repeat(32)); // Isolated deterministic test key; never configured on a public chain.
const alice='0x'+'2'.repeat(40),bob='0x'+'3'.repeat(40),charlie='0x'+'5'.repeat(40),contract='0x'+'4'.repeat(40),issuer='0x'+'1'.repeat(40),hash='0x'+'a'.repeat(64),blockHash='0x'+'b'.repeat(64);
const settings={contractVersion:2,chainId:11155111,contractAddress:contract,operatorAddress:issuer,signerAddress:authorizer.address.toLowerCase()};
const mint={id:'mint',ticketId:'ticket',actorUid:'alice',actorWallet:alice,transactionType:'MINT',walletAddress:alice,relatedEntityType:'booking',relatedEntityId:'booking',timestamp:'2026-10-30T00:00:00.000Z',status:'PENDING',transactionHash:''};
const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
function records(){const result={'BlockchainSettings/sepolia':settings,'BlockchainTransactions/mint':mint,'NFTTickets/ticket':{eventId:'event',organizerUid:'organizer',bookingId:'booking',ownerUid:'alice',walletAddress:alice,eventName:'Concert',seatId:'A01',qrData:'SECRET-QR'},'Bookings/booking':{buyerUid:'alice'},'Events/event':{organizerUid:'organizer'}};
    for(const [uid,role,wallet]of[['alice','buyer',alice],['bob','buyer',bob],['charlie','buyer',charlie],['outsider','buyer',issuer],['admin','admin',issuer],['organizer','organizer',issuer],['otherOrganizer','organizer',issuer]])result['Users/'+uid]={role,status:'active',emailVerified:true,walletAddress:wallet,email:'PRIVATE@example.test'};return structuredClone(result);}
function database(initial){let state=structuredClone(initial);const snapshot=(key,data=state)=>({id:key.split('/')[1],exists:!!data[key],data:()=>structuredClone(data[key])});
    const collection=(name,filters=[])=>({doc:id=>({key:name+'/'+id,get:async()=>snapshot(name+'/'+id)}),where:(field,op,value)=>collection(name,[...filters,[field,value]]),get:async()=>({docs:Object.keys(state).filter(k=>k.startsWith(name+'/')&&filters.every(([f,v])=>state[k][f]===v)).map(k=>snapshot(k))})});
    return {collection,get records(){return state;},runTransaction:async callback=>{const stage=structuredClone(state);let writing=false;
        const result=await callback({get:async ref=>{if(writing)throw Error('Read after write');return snapshot(ref.key,stage);},create:(ref,data)=>{writing=true;if(stage[ref.key])throw Error('Exists');stage[ref.key]=structuredClone(data);},update:(ref,data)=>{writing=true;if(!stage[ref.key])throw Error('Missing');Object.assign(stage[ref.key],structuredClone(data));}});state=stage;return result;}};
}
const signer={identity:async()=>({signerAddress:authorizer.address.toLowerCase()}),authorize:expected=>signing.authorize(expected,authorizer,2000000000)};
function receipt(prepared){return {tx:{hash,from:prepared.actorWallet,to:prepared.contractAddress,input:prepared.calldata,value:'0x0'},
    receipt:{transactionHash:hash,from:prepared.actorWallet,to:prepared.contractAddress,status:'0x1',blockNumber:'0x10',blockHash,logs:[{address:prepared.contractAddress,topics:[artifact.eventTopic,prepared.operationId,prepared.tokenId],data:'0x'+[{MINT:1,TRANSFER:2,RESALE:3}[prepared.transactionType].toString(16),prepared.fromWallet,prepared.walletAddress,prepared.recordHash].map(policy.word).join('')}]},block:{hash:blockHash},height:'0x11'};}
function provider(config=settings){let current={};const rpc=async(method,params=[])=>{
    if(method==='eth_chainId')return '0xaa36a7';if(method==='eth_getCode')return artifact.deployedBytecode;
    if(method==='eth_call'){if(params[0].data===artifact.selectors.owner)return '0x'+policy.word(config.operatorAddress);if(params[0].data===artifact.selectors.authorizationSigner)return '0x'+policy.word(config.signerAddress);return '0x'+'0'.repeat(64);}
    return {eth_getTransactionByHash:current.tx,eth_getTransactionReceipt:current.receipt,eth_blockNumber:current.height,eth_getBlockByNumber:current.block}[method]??null;
};return {rpc,set:value=>{current=value;}};}
module.exports={policy,artifact,authorizer,alice,bob,charlie,contract,issuer,hash,blockHash,settings,mint,fail,records,database,signer,receipt,provider};
