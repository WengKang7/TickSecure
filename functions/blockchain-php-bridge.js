'use strict';
// Called only by authenticated PHP via stdin. Credentials and buyer secrets are never returned.
const fs=require('node:fs');
const path=require('node:path');
const {initializeApp,cert}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {createBlockchainService}=require('./blockchain');
const methods=['getSettings','configure','prepare','verify','listBuyer','listOrganizer'];
let input='',db;process.stdin.on('data',chunk=>{input+=chunk;if(input.length>150000)process.exit(1);});
process.stdin.on('end',async()=>{
    try{
        const request=JSON.parse(input);
        if(!methods.includes(request.method)||typeof request.uid!=='string')throw Object.assign(Error('Invalid server request.'),{code:'invalid-argument'});
        const credentials=path.resolve(request.serviceAccountPath),webroot=path.resolve(__dirname,'../..');
        if(credentials.toLowerCase().startsWith(webroot.toLowerCase()+path.sep))throw Error('Credentials must remain outside the web root.');
        initializeApp({projectId:request.projectId,credential:cert(JSON.parse(fs.readFileSync(credentials,'utf8')))});
        const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
        db=getFirestore();const service=createBlockchainService(db,{projectId:request.projectId,fail});
        const result=await service[request.method](request.uid,request.data||{});process.stdout.write(JSON.stringify({data:result}));
    }catch(error){
        const known=['permission-denied','not-found','invalid-argument','failed-precondition','unavailable'];
        process.stdout.write(JSON.stringify({error:{code:known.includes(error.code)?error.code:'unavailable',
            message:known.includes(error.code)?error.message:'The blockchain service is unavailable. Check the server setup and retry verification using the same hash.'}}));
        process.exitCode=1;
    }finally{if(db)await db.terminate();}
});
