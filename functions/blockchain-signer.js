'use strict';
// Offline authorization signing only. This key never submits transactions or holds gas funds.
const fs=require('node:fs');
const path=require('node:path');
const {Wallet,Interface}=require('ethers');
const artifact=require('./blockchain-ticket-artifact.json');
const types={TicketOperation:[
    {name:'operationId',type:'bytes32'},{name:'kind',type:'uint8'},{name:'tokenId',type:'uint256'},
    {name:'from',type:'address'},{name:'to',type:'address'},{name:'recordHash',type:'bytes32'},
    {name:'actor',type:'address'},{name:'deadline',type:'uint256'}
]};
function wallet(){
    let key=process.env.TICKSECURE_BLOCKCHAIN_SIGNER_KEY;
    if(!key){
        const file=process.env.TICKSECURE_BLOCKCHAIN_SIGNER_KEY_FILE || 'C:/xampp/private/ticksecure-blockchain-authorizer.json';
        const absolute=path.resolve(file),webroot=path.resolve(__dirname,'../..');
        if(absolute.toLowerCase().startsWith(webroot.toLowerCase()+path.sep))throw Error('The blockchain signer key must be outside the web root.');
        key=JSON.parse(fs.readFileSync(absolute,'utf8')).privateKey;
    }
    return new Wallet(key);
}
async function authorize(expected,signer=wallet(),deadline=Math.floor(Date.now()/1000)+600){
    const operation={operationId:expected.operationId,kind:{MINT:1,TRANSFER:2,RESALE:3}[expected.transactionType],
        tokenId:expected.tokenId,from:expected.fromWallet,to:expected.walletAddress,recordHash:expected.recordHash,
        actor:expected.actorWallet,deadline};
    const signature=await signer.signTypedData({name:'TickSecureTickets',version:'2',chainId:11155111,verifyingContract:expected.contractAddress},types,operation);
    return {calldata:new Interface(artifact.abi).encodeFunctionData('recordOperation',[operation,signature]).toLowerCase(),
        deadline,signerAddress:signer.address.toLowerCase()};
}
const identity=()=>({signerAddress:wallet().address.toLowerCase()});
module.exports={authorize,identity,types};
if(require.main===module){
    let input='';process.stdin.on('data',data=>{input+=data;if(input.length>20000)process.exit(1);});
    process.stdin.on('end',async()=>{try{const request=JSON.parse(input);const result=request.action==='identity'?identity():await authorize(request.expected);process.stdout.write(JSON.stringify(result));}
        catch(_){process.stdout.write(JSON.stringify({error:'The blockchain authorization signer is not configured. Complete the server setup.'}));process.exitCode=1;}});
}
