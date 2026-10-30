const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const wallet='0x'+'2'.repeat(40),contract='0x'+'4'.repeat(40),hash='0x'+'a'.repeat(64);
class Element{constructor(){this.children=[];this.listeners={};this.value='';this.hidden=false;}append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}addEventListener(name,fn){this.listeners[name]=fn;}}
function page(options={}){
    const role=options.role||'buyer',html=fs.readFileSync(role+'/blockchain.php','utf8'),elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
    let rows=[{id:'mint',ticketId:'ticket',eventName:'Concert',transactionType:'MINT',actorWallet:wallet,walletAddress:wallet,status:'PENDING',canSubmit:true,performedByYou:role==='buyer',isCurrentOwner:role==='buyer'}];
    const events={},storage=new Map(),timers=[],calls={prepare:[],verify:[],send:[],decision:[]};
    const window={tsCurrentUser:null,location:{search:''},addEventListener:(type,fn)=>events[type]=fn,
        tsChainWallet:{connect:async()=>options.wallet||wallet,send:async request=>{calls.send.push(request);return hash;}},
        tsConfirmDecision:async request=>{calls.decision.push(request);return options.decision?options.decision(request):options.cancel?null:{};}};
    const sepolia={listBuyer:options.load|| (async()=>({records:rows,configured:true})),listOrganizer:async()=>({records:rows.map(r=>({...r,canSubmit:false})),configured:true}),
        prepare:async id=>{calls.prepare.push(id);return {recordId:id,actorWallet:wallet,walletAddress:wallet,contractAddress:contract,calldata:'0x1234',deadline:2000000000};},
        verify:async(id,txHash)=>{calls.verify.push({id,hash:txHash});const status=options.pending?'SUBMITTED':'CONFIRMED';rows=rows.map(r=>({...r,status,transactionHash:txHash,chainId:11155111,verificationVersion:status==='CONFIRMED'?2:0}));return {status};}};
    const context=vm.createContext({window,sepolia,URLSearchParams,document:{getElementById:id=>elements.get(id),createElement:()=>new Element(),querySelector:()=>({dataset:{chainRole:role}})},
        localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}});
    vm.runInContext(fs.readFileSync('assets/js/blockchain-display.js','utf8'),context);vm.runInContext(fs.readFileSync('assets/js/buyer-blockchain.js','utf8').replace(/^import .*;\r?\n/,''),context);
    return {window,elements,calls,storage,events,ready:async()=>{window.tsCurrentUser={uid:role,role,status:'active'};await events['ts-auth-ready']();},
        button:()=>elements.get('buyer-chain-list').children[0].children.find(child=>child.listeners?.click)};
}
const text=node=>[node.textContent||'',...node.children.map(text)].join(' ');
test('buyer cancellation prevents wallet submission and choosing the wrong wallet cannot sign',async()=>{
    const p=page({cancel:true});await p.ready();await p.button().listeners.click();assert.equal(p.calls.prepare.length,1);assert.equal(p.calls.send.length,0);assert.equal(p.calls.verify.length,0);assert.equal(p.calls.decision[0].requireAdmin,undefined);
    const wrong=page({wallet:'0x'+'9'.repeat(40)});await wrong.ready();await wrong.button().listeners.click();assert.equal(wrong.calls.send.length,0);assert.match(wrong.elements.get('buyer-chain-error').textContent,/required for this operation/);
});
test('buyer signs from their own wallet and sees the confirmed full transaction hash',async()=>{
    const p=page();await p.ready();await p.button().listeners.click();assert.equal(p.calls.send.length,1);assert.equal(p.calls.send[0].from,wallet);assert.equal(p.calls.send[0].to,contract);assert.equal(p.calls.verify[0].hash,hash);
    assert.match(text(p.elements.get('buyer-chain-list')),/Confirmed on Sepolia/);assert.match(text(p.elements.get('buyer-chain-list')),new RegExp(hash));assert.equal(p.storage.size,0);
});
test('a submitted buyer transaction can be verified again without another wallet transaction',async()=>{
    const p=page({pending:true});await p.ready();await p.button().listeners.click();assert.equal(p.storage.size,1);assert.match(p.button().textContent,/Verify my transaction/);await p.button().listeners.click();assert.equal(p.calls.send.length,1);assert.equal(p.calls.verify.length,2);
});
test('logout during confirmation cancels submission and stale blockchain data never reaches another account',async()=>{
    let finish,opened;const open=new Promise(resolve=>{opened=resolve;});const p=page({decision:()=>new Promise(resolve=>{finish=resolve;opened();})});await p.ready();const pending=p.button().listeners.click();await open;
    p.window.tsCurrentUser=null;await p.events['ts-auth-ready']();finish({});await pending;assert.equal(p.calls.send.length,0);assert.equal(p.elements.get('buyer-chain-confirmed').textContent,'0');
    let complete;const late=page({load:()=>new Promise(resolve=>{complete=resolve;})}),loading=late.ready();late.window.tsCurrentUser=null;await late.events['ts-auth-ready']();complete({records:[{id:'secret',eventName:'Private event'}],configured:true});await loading;assert.doesNotMatch(text(late.elements.get('buyer-chain-list')),/Private event/);
});
test('organizer blockchain view contains no buyer submission controls',async()=>{
    const p=page({role:'organizer'});await p.ready();assert.equal(p.button(),undefined);assert.equal(p.calls.prepare.length,0);assert.equal(p.calls.verify.length,0);assert.equal(p.calls.send.length,0);
});
