'use strict';
const policy=require('./blockchain-policy');
const artifact=require('./blockchain-ticket-artifact.json');
const signing=require('./blockchain-signer');
async function sepoliaRpc(method,params=[]){
    const url=process.env.TICKSECURE_SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com';
    if(!url.startsWith('https://'))throw Object.assign(Error('The Sepolia provider must use HTTPS.'),{code:'failed-precondition'});
    try{const response=await fetch(url,{method:'POST',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
        const body=await response.json();if(!response.ok||body.error||!Object.hasOwn(body,'result'))throw Error();return body.result;
    }catch(_){throw Object.assign(Error('The Sepolia provider is unavailable. Retry verification using the same hash.'),{code:'unavailable'});}
}
function createBlockchainService(db,{projectId,rpc=sepoliaRpc,fail,signer=signing}){
    const stamp=()=>new Date().toISOString();
    const read=async(collection,id)=>{const doc=await db.collection(collection).doc(id).get();return doc.exists?{...doc.data(),id:doc.id}:null;};
    const query=async(collection,field,value)=>{const result=await db.collection(collection).where(field,'==',value).get();return result.docs.map(doc=>({...doc.data(),id:doc.id}));};
    const id=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(value))fail('invalid-argument','Select a valid blockchain record.');return value;};
    const txHash=value=>{if(typeof value!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(value))fail('invalid-argument','Enter a valid transaction hash.');return value.toLowerCase();};
    // Administrators are exempt from email verification; all roles still require active accounts.
    function assertAccount(user,roles){if(!user||!roles.includes(user.role)||user.status!=='active'||(user.role!=='admin'&&user.emailVerified!==true))fail('permission-denied','An active, authorized '+roles.join(' or ')+' account is required.');}
    async function account(uid,roles){const user=await read('Users',uid);assertAccount(user,roles);return user;}
    function assertSetup(config){if(!config?.contractAddress||config.chainId!==11155111||config.contractVersion!==2)fail('failed-precondition','An administrator must finish the buyer-enabled Sepolia setup first.');}
    async function identity(){try{return await signer.identity();}catch(_){fail('failed-precondition','The server authorization signer is not configured. Complete the server setup.');}}
    async function chain(config){
        if(await rpc('eth_chainId')!=='0xaa36a7')fail('failed-precondition','The provider must connect to Sepolia.');
        if(config){const [code,owner,authorizer]=await Promise.all([rpc('eth_getCode',[config.contractAddress,'latest']),
            rpc('eth_call',[{to:config.contractAddress,data:artifact.selectors.owner},'latest']),rpc('eth_call',[{to:config.contractAddress,data:artifact.selectors.authorizationSigner},'latest'])]);
            if(!policy.runtimeMatches(code,artifact)||policy.lower(owner)!=='0x'+policy.word(config.operatorAddress)||policy.lower(authorizer)!=='0x'+policy.word(config.signerAddress))
                fail('failed-precondition','The ticket contract or signer does not match the registered deployment.');}
    }
    async function actor(record,ticket){
        if(record.actorUid&&policy.address(record.actorWallet))return {uid:record.actorUid,wallet:policy.lower(record.actorWallet)};
        if(record.transactionType==='MINT'){
            const booking=record.relatedEntityType==='booking'?await read('Bookings',record.relatedEntityId):null;
            return booking?.buyerUid?{uid:booking.buyerUid,wallet:policy.lower(record.walletAddress)}:null;
        }
        if(record.transactionType==='TRANSFER'){
            const step=(ticket.transferHistory||[]).find(step=>step.type!=='RESALE'&&step.timestamp===record.timestamp&&policy.lower(step.toWallet)===policy.lower(record.walletAddress));
            return step?.fromUid?{uid:step.fromUid,wallet:policy.lower(step.fromWallet)}:null;
        }
        if(record.transactionType==='RESALE'){
            const listing=record.relatedEntityType==='resale'?await read('ResaleListings',record.relatedEntityId):null;
            return listing?.buyerUid&&listing.ticketId===record.ticketId?{uid:listing.buyerUid,wallet:policy.lower(record.walletAddress)}:null;
        }
        return null;
    }
    async function context(uid,recordId){
        await account(uid,['buyer']);if(!projectId)fail('failed-precondition','The Firebase project ID is not configured.');
        const [config,record]=await Promise.all([read('BlockchainSettings','sepolia'),read('BlockchainTransactions',id(recordId))]);assertSetup(config);
        if(!record)fail('not-found','Blockchain record not found.');
        const ticket=await read('NFTTickets',id(record.ticketId));if(!ticket)fail('not-found','Related ticket not found.');
        const performer=await actor(record,ticket);
        if(performer?.uid!==uid||!policy.address(performer.wallet))fail('permission-denied','Only the buyer responsible for this operation can submit or verify it.');
        const history=await query('BlockchainTransactions','ticketId',record.ticketId);
        const expected={...policy.operation(projectId,config,record,history,artifact,fail),actorWallet:performer.wallet};
        if(expected.actorWallet!==(record.transactionType==='TRANSFER'?expected.fromWallet:expected.walletAddress))fail('failed-precondition','The buyer wallet does not match this operation.');
        return {config,record,ticket,expected};
    }
    async function canonicalReceipt(hash){
        const [tx,receipt,height]=await Promise.all([rpc('eth_getTransactionByHash',[hash]),rpc('eth_getTransactionReceipt',[hash]),rpc('eth_blockNumber')]);
        if(tx&&policy.lower(tx.hash)!==hash)fail('invalid-argument','The provider returned a different transaction hash.');
        const block=receipt?await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]):null;return {tx,receipt,height,block};
    }
    async function list(uid,data,organizer=false){
        await account(uid,[organizer?'organizer':'buyer']);
        const filter=data.ticketId?id(data.ticketId):'',bookingId=data.bookingId?id(data.bookingId):'';
        const config=await read('BlockchainSettings','sepolia'),tickets=new Map(),candidates=new Map(),cache=new Map();
        const add=rows=>rows.forEach(row=>{if(!filter||row.ticketId===filter)candidates.set(row.id,row);});
        async function ticketRows(ticketId){if(!cache.has(ticketId))cache.set(ticketId,await query('BlockchainTransactions','ticketId',ticketId));add(cache.get(ticketId));}
        if(organizer){
            for(const event of await query('Events','organizerUid',uid))for(const ticket of await query('NFTTickets','eventId',event.id)){
                tickets.set(ticket.id,ticket);if(!filter||ticket.id===filter)await ticketRows(ticket.id);
            }
        }else{
            if(bookingId){const booking=await read('Bookings',bookingId);if(booking?.buyerUid!==uid)fail('not-found','Booking not found for your account.');}
            const [owned,performed,bookings,logs,resales]=await Promise.all([query('NFTTickets','ownerUid',uid),query('BlockchainTransactions','actorUid',uid),
                query('Bookings','buyerUid',uid),query('AuditLogs','actorUid',uid),query('ResaleListings','buyerUid',uid)]);
            add(performed);
            for(const ticket of owned){tickets.set(ticket.id,ticket);if(!filter||ticket.id===filter)await ticketRows(ticket.id);}
            for(const booking of bookings)if(!bookingId||booking.id===bookingId)add(await query('BlockchainTransactions','relatedEntityId',booking.id));
            for(const log of logs)if(log.action==='ticket_transferred'&&(!filter||log.entityId===filter))await ticketRows(log.entityId);
            for(const listing of resales)if(!filter||listing.ticketId===filter)add(await query('BlockchainTransactions','relatedEntityId',listing.id));
        }
        const records=[];
        for(const record of candidates.values()){
            let ticket=tickets.get(record.ticketId);if(!ticket){ticket=await read('NFTTickets',record.ticketId);if(!ticket)continue;tickets.set(record.ticketId,ticket);}
            if(bookingId&&ticket.bookingId!==bookingId)continue;
            const performer=await actor(record,ticket),isCurrentOwner=ticket.ownerUid===uid;
            if(!organizer&&performer?.uid!==uid&&!isCurrentOwner)continue;
            let blockedReason='',canSubmit=!organizer&&performer?.uid===uid&&!policy.verified(record,config||{});
            if(canSubmit){try{assertSetup(config);const history=cache.get(record.ticketId)||await query('BlockchainTransactions','ticketId',record.ticketId);cache.set(record.ticketId,history);policy.operation(projectId,config,record,history,artifact,fail);}
                catch(error){canSubmit=false;blockedReason=error.message;}}
            const safe={};for(const key of ['transactionType','walletAddress','transactionHash','contractAddress','tokenId','timestamp','failureReason','confirmedAt'])safe[key]=typeof record[key]==='string'?record[key]:'';
            records.push({...safe,id:record.id,ticketId:record.ticketId,eventName:ticket.eventName||'Ticket',categoryName:ticket.categoryName||'',seatId:ticket.seatId||'',
                actorWallet:performer?.wallet||'',chainId:record.chainId===11155111?11155111:null,network:record.chainId===11155111?'Sepolia':'Not submitted',
                status:record.status==='CONFIRMED'&&!policy.verified(record,config||{})?'LEGACY':record.status||'PENDING',verificationVersion:record.verificationVersion||0,
                confirmations:Number(record.confirmations)||0,isCurrentOwner,canSubmit,blockedReason,performedByYou:performer?.uid===uid});
        }
        records.sort((a,b)=>a.timestamp<b.timestamp?-1:a.timestamp>b.timestamp?1:a.id<b.id?-1:1);
        return {records,configured:!!config?.contractAddress&&config.contractVersion===2,network:'Sepolia'};
    }
    return {
        async getSettings(uid){
            const user=await account(uid,['buyer','admin','organizer']),config=await read('BlockchainSettings','sepolia');
            const result={chainId:11155111,network:'Sepolia',contractVersion:config?.contractVersion||0,confirmationsRequired:2,
                configured:!!config?.contractAddress&&config.contractVersion===2,migrationRequired:!!config?.contractAddress&&config.contractVersion!==2,
                contractAddress:config?.contractAddress||'',operatorAddress:config?.operatorAddress||'',signerAddress:config?.signerAddress||'',deploymentHash:config?.deploymentHash||''};
            if(user.role==='admin'&&!config?.contractAddress){try{const server=await identity();result.signerAddress=server.signerAddress;result.deploymentBytecode=artifact.bytecode+policy.word(server.signerAddress);}catch(error){result.setupMessage=error.message;}}
            return result;
        },
        async configure(uid,data){
            await account(uid,['admin']);const server=await identity(),hash=txHash(data.transactionHash);await chain();
            const {tx,receipt,block,height}=await canonicalReceipt(hash);
            if(!tx||!receipt)fail('unavailable','Deployment is pending. Verify the same hash again shortly.');
            if(tx.to!==null||policy.lower(tx.input)!==policy.lower(artifact.bytecode+policy.word(server.signerAddress))||BigInt(tx.value||'0x0')!==0n
                ||!policy.address(tx.from)||receipt.status!=='0x1'||!policy.address(receipt.contractAddress)||policy.lower(receipt.transactionHash)!==hash
                ||!block||policy.lower(block.hash)!==policy.lower(receipt.blockHash))fail('invalid-argument','This is not a verified buyer-enabled TickSecure deployment.');
            if(BigInt(height)-BigInt(receipt.blockNumber)+1n<2n)fail('unavailable','Waiting for two Sepolia confirmations. Verify the same hash again shortly.');
            const config={chainId:11155111,network:'Sepolia',contractVersion:2,contractAddress:policy.lower(receipt.contractAddress),operatorAddress:policy.lower(tx.from),
                signerAddress:server.signerAddress,deploymentHash:hash,deploymentBlock:Number(BigInt(receipt.blockNumber)),configuredBy:uid,configuredAt:stamp()};
            await chain(config);
            await db.runTransaction(async transaction=>{const ref=db.collection('BlockchainSettings').doc('sepolia');
                const [user,previous]=await Promise.all([transaction.get(db.collection('Users').doc(uid)),transaction.get(ref)]);assertAccount(user.exists?user.data():null,['admin']);
                if(previous.exists&&policy.lower(previous.data().contractAddress)!==config.contractAddress)fail('failed-precondition','A contract is already registered. Its records need an explicit migration first.');
                if(!previous.exists)transaction.create(ref,config);});
            return {configured:true,...config};
        },
        async prepare(uid,data){
            const {config,record,expected}=await context(uid,data.recordId);await chain(config);
            if(policy.verified(record,config))return {...expected,recordId:record.id,transactionHash:record.transactionHash,alreadyRecorded:true};
            const recorded=policy.lower(await rpc('eth_call',[{to:config.contractAddress,data:artifact.selectors.operations+policy.word(expected.operationId)},'latest']));
            if(recorded!=='0x'+'0'.repeat(64)){
                if(recorded!==expected.recordHash)fail('failed-precondition','This operation has conflicting on-chain data.');
                return {...expected,recordId:record.id,transactionHash:record.transactionHash||'',alreadyRecorded:true};
            }
            let authorization;try{authorization=await signer.authorize(expected);}catch(_){fail('failed-precondition','The server signer is unavailable. Contact the administrator.');}
            if(authorization.signerAddress!==config.signerAddress)fail('failed-precondition','The server signer does not match the contract.');
            const ref=db.collection('BlockchainAuthorizations').doc(policy.hash(authorization.calldata).slice(2));
            await db.runTransaction(async transaction=>{
                const [user,current,previous]=await Promise.all([transaction.get(db.collection('Users').doc(uid)),transaction.get(db.collection('BlockchainTransactions').doc(record.id)),transaction.get(ref)]);
                assertAccount(user.exists?user.data():null,['buyer']);if(!current.exists)fail('not-found','Blockchain record not found.');
                for(const key of ['ticketId','transactionType','walletAddress','timestamp','actorUid','actorWallet'])if(current.data()[key]!==record[key])fail('failed-precondition','The blockchain operation changed.');
                if(!previous.exists)transaction.create(ref,{recordId:record.id,actorUid:uid,...expected,...authorization,createdAt:stamp()});
                else if(previous.data().actorUid!==uid)fail('permission-denied','Authorization belongs to another buyer.');
            });
            return {...expected,...authorization,recordId:record.id,transactionHash:record.status==='FAILED'?'':record.transactionHash||'',alreadyRecorded:false};
        },
        async verify(uid,data){
            const hash=txHash(data.transactionHash),{config,record,expected}=await context(uid,data.recordId);await chain(config);
            const {tx,receipt,block,height}=await canonicalReceipt(hash);if(!tx)fail('unavailable','This hash is not visible yet. Verify it again without resubmitting.');
            const authorization=await read('BlockchainAuthorizations',policy.hash(policy.lower(tx.input||tx.data)).slice(2));
            if(!authorization||authorization.actorUid!==uid||authorization.recordId!==record.id||authorization.recordHash!==expected.recordHash
                ||authorization.actorWallet!==expected.actorWallet||authorization.contractAddress!==config.contractAddress)fail('invalid-argument','The hash does not match an authorization issued to this buyer.');
            expected.calldata=authorization.calldata;
            const result=policy.verifyTransaction(tx,receipt,block,height,expected,config,artifact,fail);
            const patch={...expected,...result,transactionHash:hash,network:'Sepolia',actorUid:uid,actorWallet:expected.actorWallet,
                verificationVersion:result.status==='CONFIRMED'?2:0,lastCheckedAt:stamp()};delete patch.calldata;
            if(result.status==='CONFIRMED')patch.confirmedAt=record.confirmedAt||stamp();
            await db.runTransaction(async transaction=>{
                const ref=db.collection('BlockchainTransactions').doc(record.id),ticketRef=db.collection('NFTTickets').doc(record.ticketId);
                const [user,current,ticket,setting]=await Promise.all([transaction.get(db.collection('Users').doc(uid)),transaction.get(ref),transaction.get(ticketRef),transaction.get(db.collection('BlockchainSettings').doc('sepolia'))]);
                assertAccount(user.exists?user.data():null,['buyer']);if(!current.exists||!ticket.exists||setting.data()?.contractAddress!==config.contractAddress)fail('failed-precondition','The operation changed. Refresh before retrying.');
                const fresh=current.data();for(const key of ['ticketId','transactionType','walletAddress','timestamp','actorUid','actorWallet'])if(fresh[key]!==record[key])fail('failed-precondition','The blockchain operation changed.');
                if(policy.verified(fresh,config)){if(policy.lower(fresh.transactionHash)!==hash)fail('failed-precondition','The operation is already confirmed with a different hash.');return;}
                if(fresh.status==='SUBMITTED'&&fresh.transactionHash&&fresh.transactionHash!==hash&&result.status!=='CONFIRMED')fail('failed-precondition','A replacement must confirm before replacing the submitted hash.');
                transaction.update(ref,patch);
                if(result.status==='CONFIRMED'){
                    const ticketPatch={blockchainLastTransactionHash:hash,blockchainLastOperationId:record.id,blockchainWalletAddress:expected.walletAddress,
                        blockchainStatus:'CONFIRMED',blockchainNetwork:'Sepolia',chainId:11155111,contractAddress:config.contractAddress,tokenId:expected.tokenId};
                    if(record.transactionType==='MINT')Object.assign(ticketPatch,{mintingStatus:'MINTED',transactionHash:hash});transaction.update(ticketRef,ticketPatch);
                }
            });
            return {recordId:record.id,transactionHash:hash,...result};
        },
        listBuyer:(uid,data)=>list(uid,data),listOrganizer:(uid,data)=>list(uid,data,true)
    };
}
module.exports={createBlockchainService,sepoliaRpc};
