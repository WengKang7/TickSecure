'use strict';
// Read-only diagnostics. Never returns credentials, signatures or raw transfers.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const serverRequire=require('node:module').createRequire(path.resolve(__dirname,'../functions/package.json'));
const {initializeApp,cert}=serverRequire('firebase-admin/app');
const {getFirestore}=serverRequire('firebase-admin/firestore');
const {Transaction,formatEther}=require('../functions/node_modules/ethers');
const {sepoliaRpc:rpc}=require('../functions/blockchain');
const target=String(process.argv[2]||'').toLowerCase();
if(!/^0x[0-9a-f]{40}$/.test(target)){process.stderr.write('Supply the public buyer wallet address.\n');process.exit(1);}
const deadline=setTimeout(()=>{process.stderr.write('Read-only diagnostics timed out.\n');process.exit(1);},25000);
let db;
(async()=>{
    const php=process.env.TICKSECURE_PHP_PATH||(process.platform==='win32'?'C:/xampp/php/php.exe':'php');
    const config=JSON.parse(execFileSync(php,['-r','require $argv[1]; echo json_encode(firebase_backend_config());',path.resolve(__dirname,'../api/firebase-admin.php')],{encoding:'utf8',windowsHide:true}));
    initializeApp({projectId:config.projectId,credential:cert(JSON.parse(fs.readFileSync(config.serviceAccountPath,'utf8')))});
    db=getFirestore();db.settings({preferRest:true});
    const claims=await db.collection('DemoFundingClaims').where('walletAddress','==',target).limit(3).get();
    for(const doc of claims.docs){
        const claim=doc.data(),tx=Transaction.from(claim.rawTransaction);
        const [receipt,code,balance,fundingBalance,estimate]=await Promise.all([
            rpc('eth_getTransactionReceipt',[claim.transactionHash]),rpc('eth_getCode',[target,'latest']),
            rpc('eth_getBalance',[target,'latest']),rpc('eth_getBalance',[claim.fundingWallet,'latest']),
            rpc('eth_estimateGas',[{from:claim.fundingWallet,to:target,value:'0x'+tx.value.toString(16)}]).catch(()=>null)
        ]);
        process.stdout.write(JSON.stringify({claimId:doc.id,status:claim.status,wallet:target,fundingWallet:claim.fundingWallet,
            amount:formatEther(claim.amountWei),transactionHash:claim.transactionHash,nonce:tx.nonce,
            sentGasLimit:tx.gasLimit.toString(),receiptStatus:receipt?.status,gasUsed:receipt?.gasUsed,
            recipientCode:code,recipientBalance:formatEther(BigInt(balance)),fundingBalance:formatEther(BigInt(fundingBalance)),
            currentEstimatedTransferGas:estimate?BigInt(estimate).toString():null})+'\n');
    }
    if(!claims.size)process.stdout.write('No matching funding claim.\n');
})().catch(()=>{process.stderr.write('Read-only funding inspection failed. Check local Firebase configuration and connectivity.\n');process.exitCode=1;})
.finally(async()=>{clearTimeout(deadline);if(db)await db.terminate();});
