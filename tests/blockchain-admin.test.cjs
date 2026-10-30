const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {spawn}=require('node:child_process');
const issuer='0x'+'1'.repeat(40),receiver='0x'+'2'.repeat(40),contract='0x'+'3'.repeat(40),hash='0x'+'a'.repeat(64);
class Element{
    constructor(){this.children=[];this.listeners={};this.value='';this.hidden=false;}
    append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}addEventListener(name,fn){this.listeners[name]=fn;}
}
function page(options={}){
    const html=fs.readFileSync('admin/blockchain.php','utf8'),elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
    const events={},storage=new Map(),timers=[],calls={prepare:[],verify:[],send:[],confirm:[],configure:[]};
    let rows=[{id:'record',ticketId:'ticket',transactionType:'MINT',walletAddress:receiver,status:'PENDING',timestamp:'2026-10-30T00:00:00.000Z'}];
    const settings=options.undeployed?{configured:false,deploymentBytecode:'0x1234'}:{configured:true,contractAddress:contract,operatorAddress:issuer};
    const window={tsCurrentUser:null,addEventListener:(type,fn)=>events[type]=fn,tsBlockchain:{getTransactions:async()=>structuredClone(rows)},
        tsChainWallet:{connect:async()=>issuer,send:async request=>{calls.send.push(request);return hash;}},
        tsConfirmDecision:async request=>{calls.confirm.push(request);return options.decision?options.decision(request):options.cancel?null:{};}};
    const sepolia={getSettings:async()=>settings,prepare:async id=>{calls.prepare.push(id);return {operatorAddress:issuer,contractAddress:contract,walletAddress:receiver,calldata:'0x5678'};},
        verify:async(id,txHash)=>{calls.verify.push({id,hash:txHash});const status=options.verifyStatus||'CONFIRMED';rows=rows.map(r=>({...r,transactionHash:txHash,status,chainId:11155111,contractAddress:contract,verificationVersion:status==='CONFIRMED'?1:0}));return {status};},
        configure:async txHash=>{calls.configure.push(txHash);return {configured:true,contractAddress:contract,operatorAddress:issuer};}};
    const context=vm.createContext({window,sepolia,document:{getElementById:id=>elements.get(id),createElement:()=>new Element()},
        localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
        setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},console});
    const source=fs.readFileSync('assets/js/admin-blockchain.js','utf8').replace(/^import .*;\r?\n/,'');vm.runInContext(source,context);
    return {window,elements,calls,storage,timers,ready:async()=>{window.tsCurrentUser={uid:'admin',role:'admin',status:'active',emailVerified:false};await events['ts-auth-ready']();},events,
        click:id=>elements.get(id).listeners.click(),button:()=>elements.get('tx-table-body').children[0].children[5].children[0]};
}
const text=node=>[node.textContent||'',...node.children.map(text)].join(' ');

test('admin monitoring has no controls to publish or verify buyer ticket operations',async()=>{
    const p=page();await p.ready();const row=p.elements.get('tx-table-body').children[0];assert.match(text(row),/Buyer performs this action/);
    assert.equal(p.calls.prepare.length,0);assert.equal(p.calls.verify.length,0);assert.equal(p.calls.send.length,0);
    assert.equal(row.children[5].children.length,0);
    assert.equal(p.elements.has('chain-verification'),false);assert.equal(p.elements.has('chain-send-verification'),false);
});
test('admin deployment requires its own confirmation and uses only the deployment hash',async()=>{
    const cancelled=page({undeployed:true,cancel:true});await cancelled.ready();await cancelled.click('chain-deploy');assert.equal(cancelled.calls.send.length,0);
    const p=page({undeployed:true});await p.ready();await p.click('chain-deploy');assert.equal(p.calls.send.length,1);assert.equal(p.calls.send[0].to,undefined);assert.deepEqual(p.calls.configure,[hash]);assert.equal(p.calls.prepare.length,0);assert.equal(p.calls.verify.length,0);
});
test('losing admin access during deployment confirmation prevents submission',async()=>{
    let finish,opened;const decisionOpened=new Promise(resolve=>{opened=resolve;});
    const p=page({undeployed:true,decision:()=>new Promise(resolve=>{finish=resolve;opened();})});await p.ready();const pending=p.click('chain-deploy');await decisionOpened;
    p.window.tsCurrentUser=null;await p.events['ts-auth-ready']();finish({});await pending;assert.equal(p.calls.send.length,0);
});
test('dedicated local blockchain flag requires authentication and leaves other mutations disabled',async t=>{
    const net=require('node:net'),probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
    const php=process.platform==='win32'?'C:/xampp/php/php.exe':'php',root=path.join(__dirname,'..');
    const server=spawn(php,['-S','127.0.0.1:'+port,'-t',root],{windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,TICKSECURE_PHP_BACKEND:'0',TICKSECURE_PHP_BLOCKCHAIN:'1',TICKSECURE_PHP_CHECKOUT:'0',TICKSECURE_PHP_RESALE:'0',TICKSECURE_PHP_TRANSFER:'0'}});
    t.after(()=>server.kill());await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('PHP server did not start')),5000);server.once('error',reject);server.stderr.on('data',data=>{if(data.toString().includes('started')){clearTimeout(timer);resolve();}});});
    for(const action of ['getBlockchainSettings','configureBlockchain','prepareBlockchainOperation','verifyBlockchainOperation','getBuyerBlockchainOperations','getOrganizerBlockchainOperations','checkout','transferTicket','scanTicket']){
        const response=await fetch('http://127.0.0.1:'+port+'/api/backend.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data:{}})});
        assert.equal(response.status,['checkout','transferTicket','scanTicket'].includes(action)?410:401,action);
    }
});
