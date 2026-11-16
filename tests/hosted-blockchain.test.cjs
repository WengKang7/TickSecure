const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
test('Render blockchain and funding actions use authenticated same-origin PHP',async()=>{
 const calls=[];
 const context=vm.createContext({
  window:{location:{hostname:'ticksecure.onrender.com'},tsFirebase:{backend:{compatible:true,endpoint:'/api/backend.php'}}},
  auth:{currentUser:{getIdToken:async()=> 'test-token'}},
  fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({data:{ready:true}})}},
  getFunctions:()=>{throw Error('Render must not call Firebase Functions for these actions')},app:{}
 });
 const source=fs.readFileSync('assets/js/backend-client.js','utf8').replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replaceAll('export ','');
 vm.runInContext(source,context);
 for(const name of ['createResaleListing','updateResalePrice','cancelResaleListing','suspendResaleListing','purchaseResale','transferTicket','getTicketTransfers','getBlockchainSettings','configureBlockchain','prepareBlockchainOperation','verifyBlockchainOperation','getBuyerBlockchainOperations','getOrganizerBlockchainOperations','getDemoFundingSettings','getDemoFundingChallenge','claimDemoFunding','retryDemoFunding']){
  await context.invokeTrustedBackend({}, {name});
  assert.equal(calls.at(-1).url,'/api/backend.php');
  assert.equal(calls.at(-1).options.headers.Authorization,'Bearer test-token');
  assert.equal(JSON.parse(calls.at(-1).options.body).action,name);
 }
});
