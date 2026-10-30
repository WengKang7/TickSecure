'use strict';
// Generates only a backend permission-signing key. Buyer wallets and seed phrases are never read.
const fs=require('node:fs'),path=require('node:path');
const {Wallet}=require('../functions/node_modules/ethers');
try{
    const file=path.resolve(process.env.TICKSECURE_BLOCKCHAIN_SIGNER_KEY_FILE||'C:/xampp/private/ticksecure-blockchain-authorizer.json');
    const webroot=path.resolve(__dirname,'../..');
    const outside=target=>!target.toLowerCase().startsWith(webroot.toLowerCase()+path.sep);
    if(!outside(file))throw Error();
    if(!fs.existsSync(file)){
        if(!process.argv.includes('--apply')){process.stdout.write(JSON.stringify({configured:false,nextStep:'Run this script with --apply to create the backend authorization key outside htdocs.'}));process.exit(0);}
        fs.mkdirSync(path.dirname(file),{recursive:true});if(!outside(fs.realpathSync(path.dirname(file))))throw Error();
        const wallet=Wallet.createRandom();fs.writeFileSync(file,JSON.stringify({privateKey:wallet.privateKey,createdAt:new Date().toISOString()},null,2),{flag:'wx',mode:0o600});
    }
    if(!outside(fs.realpathSync(file)))throw Error();
    const wallet=new Wallet(JSON.parse(fs.readFileSync(file,'utf8')).privateKey);
    process.stdout.write(JSON.stringify({configured:true,signerAddress:wallet.address.toLowerCase(),buyerKeysAccessed:false}));
}catch(_){process.stderr.write('Authorization signer setup failed. Check the private directory and configuration. Existing keys are never overwritten.\n');process.exitCode=1;}
