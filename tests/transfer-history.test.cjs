const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {transferReceipt,getTicketTransfers}=require('../functions/ticket-transfer-history');
const php=process.platform==='win32'?'C:/xampp/php/php.exe':'php';
const wa='0x'+'a'.repeat(40),wb='0x'+'b'.repeat(40),wc='0x'+'c'.repeat(40);
function records(){
    const result={};for(const name of ['alice','bob','charlie','outsider'])result['Users/'+name]={fullName:name.toUpperCase(),role:'buyer',status:'active',emailVerified:true,email:'private@example.com'};
    result['NFTTickets/ticket']={ownerUid:'charlie',eventId:'event',eventName:'Concert',seatId:'B03',categoryName:'VIP',sectionId:'B',qrSecret:'never-return',transferHistory:[
        {fromUid:'alice',toUid:'bob',fromWallet:wa,toWallet:wb,timestamp:'2026-10-29T05:00:00.000Z'},
        {fromUid:'bob',toUid:'charlie',fromWallet:wb,toWallet:wc,timestamp:'2026-10-29T06:00:00.000Z'}]};
    result['Events/event']={date:'2026-11-30',time:'20:00',venueName:'Hall'};
    for(const [id,from,to,time] of [['old1','alice','bob','05'],['old2','bob','charlie','06']])result['AuditLogs/'+id]={action:'ticket_transferred',entityType:'ticket',entityId:'ticket',actorUid:from,actorEmail:'private@example.com',details:{recipientUid:to},timestamp:`2026-10-29T${time}:00:00.003Z`};
    result['NFTTickets/second']={ownerUid:'bob',eventId:'event'};
    result['AuditLogs/new']={action:'ticket_transferred',entityType:'ticket',entityId:'second',actorUid:'alice',details:{recipientUid:'bob',transfer:{
        ...transferReceipt({id:'second',eventId:'event',eventName:'Original concert',seatId:'C01',walletAddress:wa},result['Events/event'],{fullName:'Alice at transfer'},{fullName:'Bob at transfer'},wb,'2026-10-29T07:00:00.000Z'),email:'private@example.com',qrSecret:'never-return'}},timestamp:'2026-10-29T07:00:00.003Z'};
    result['AuditLogs/unrelated']={action:'checkout',entityType:'ticket',entityId:'ticket',actorUid:'bob',details:{recipientUid:'alice'}};
    return result;
}
function database(records){
    const snapshot=key=>({id:key.split('/')[1],exists:!!records[key],data:()=>structuredClone(records[key])});
    const collection=(name,filters=[])=>({doc:id=>({get:async()=>snapshot(name+'/'+id)}),where:(field,op,value)=>collection(name,[...filters,[field,value]]),
        get:async()=>({docs:Object.keys(records).filter(key=>key.startsWith(name+'/')&&filters.every(([field,value])=>field.split('.').reduce((v,k)=>v?.[k],records[key])===value)).map(snapshot)})});
    return {collection};
}
const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
test('sender and receiver can read only their receipts, including old transfers after forwarding the ticket',async()=>{
    const state=records(),before=structuredClone(state),cases=[
        {uid:'alice',data:{}},{uid:'bob',data:{}},{uid:'charlie',data:{}},{uid:'outsider',data:{}},
        {uid:'bob',data:{ticketId:'ticket'}},{uid:'alice',data:{transferId:'new'}},
        {uid:'outsider',data:{transferId:'new'},error:'not-found'},
        {uid:'bob',data:{ticketId:'invalid/path'},error:'invalid-argument'}
    ].map(c=>({...c,action:'getTicketTransfers',records:state}));
    const phpResults=JSON.parse(execFileSync(php,[path.join(__dirname,'resale-backend-fixture.php')],{input:JSON.stringify(cases),encoding:'utf8'}));
    for(const [i,c] of cases.entries()){
        if(c.error){await assert.rejects(getTicketTransfers(database(state),c.uid,c.data,fail),e=>e.code===c.error);assert.equal(phpResults[i].error,c.error);continue;}
        const result=await getTicketTransfers(database(state),c.uid,c.data,fail);
        assert.deepEqual(result,phpResults[i].result);
        assert.doesNotMatch(JSON.stringify(result),/private@example|never-return|actorEmail|qrSecret|bookingId/);
        if(c.uid==='bob'&&!Object.keys(c.data).length){assert.deepEqual(result.records.map(r=>r.direction),['RECEIVED','SENT','RECEIVED']);assert.equal(result.records[0].toName,'Bob at transfer');assert.equal(result.records[0].legacy,false);assert.equal(result.records[1].isCurrentOwner,false);assert.equal(result.records[2].fromName,'ALICE');}
        if(c.uid==='alice'&&!Object.keys(c.data).length){assert.equal(result.records.length,2);assert.ok(result.records.every(r=>r.direction==='SENT'&&!r.isCurrentOwner));}
        if(c.uid==='charlie'){assert.equal(result.records.length,1);assert.equal(result.records[0].isCurrentOwner,true);}
        if(c.uid==='outsider')assert.deepEqual(result.records,[]);
    }
    assert.deepEqual(state,before);
});
test('history requires an active verified buyer and preserves recorded identities after profile changes',async()=>{
    const state=records();state['Users/alice'].fullName='Changed name';delete state['Users/alice'].email;
    const result=await getTicketTransfers(database(state),'bob',{transferId:'new'},fail);assert.equal(result.records[0].fromName,'Alice at transfer');
    for(const patch of [{status:'suspended'},{emailVerified:false},{role:'organizer'}]){
        const altered=records();Object.assign(altered['Users/bob'],patch);
        await assert.rejects(getTicketTransfers(database(altered),'bob',{},fail),e=>e.code==='permission-denied');
        const [p]=JSON.parse(execFileSync(php,[path.join(__dirname,'resale-backend-fixture.php')],{input:JSON.stringify([{action:'getTicketTransfers',uid:'bob',data:{},records:altered}]),encoding:'utf8'}));assert.equal(p.error,'permission-denied');
    }
});
test('a completed transfer stores a durable safe receipt in the same transaction for both participants',async()=>{
    const state=records();state['NFTTickets/ticket']={...state['NFTTickets/ticket'],ownerUid:'alice',status:'VALID',walletAddress:wa,transferHistory:[]};
    state['Events/event']={...state['Events/event'],status:'PUBLISHED',transferEnabled:true,maxTicketsPerBuyer:4};state['Users/bob'].walletAddress=wb;
    const [result]=JSON.parse(execFileSync(php,[path.join(__dirname,'resale-backend-fixture.php')],{input:JSON.stringify([{action:'transferTicket',uid:'alice',data:{ticketId:'ticket',recipientWallet:wb},records:state}]),encoding:'utf8'}));
    const id=result.result.transferId,snapshot=result.records['AuditLogs/'+id].details.transfer;
    assert.equal(snapshot.fromName,'ALICE');assert.equal(snapshot.toName,'BOB');assert.equal(snapshot.seatId,'B03');assert.equal(snapshot.venueName,'Hall');
    for(const uid of ['alice','bob']){
        const history=await getTicketTransfers(database(result.records),uid,{transferId:id},fail);
        assert.equal(history.records.length,1);assert.equal(history.records[0].direction,uid==='alice'?'SENT':'RECEIVED');
    }
});

class Element{
    constructor(){this.children=[];this.listeners={};this.dataset={};this.style={};this.hidden=false;this.value='';this.classList={toggle(){}};}
    append(...children){this.children.push(...children);}appendChild(child){this.children.push(child);}replaceChildren(...children){this.children=children;}
    setAttribute(){}addEventListener(name,fn){this.listeners[name]=fn;}
}
function page(options={}){
    const html=fs.readFileSync('buyer/ticket-transfers.php','utf8'),elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
    const tabs=['all','SENT','RECEIVED'].map(direction=>{const e=new Element();e.dataset.transferFilter=direction;return e;});let ready;
    const window={tsCurrentUser:{uid:'bob'},location:{search:''},addEventListener(name,fn){if(name==='ts-auth-ready')ready=fn;},tsTickets:{getTransfers:options.load||(()=>getTicketTransfers(database(records()),'bob',{},fail))}};
    const document={getElementById:id=>elements.get(id),createElement:()=>new Element(),querySelectorAll:()=>tabs};
    const context=vm.createContext({window,document,URLSearchParams,Intl});
    for(const file of ['ticket-display.js','transfer-display.js','ticket-transfer-history.js'])vm.runInContext(fs.readFileSync('assets/js/'+file,'utf8'),context);
    return {window,elements,tabs,ready:()=>ready()};
}
const textOf=node=>[node.textContent||'',...(node.children||[]).map(textOf)].join(' ');
test('history UI shows both identities, filters sent/received, and never gives a former owner an entry ticket',async()=>{
    const p=page();await p.ready();const list=p.elements.get('transfer-history-list');assert.equal(list.children.length,3);
    assert.match(textOf(list.children[0]),/Alice at transfer.*Bob at transfer/);assert.match(textOf(list.children[0]),/UTC\+8/);
    assert.match(textOf(list.children[1]),/receipt, not an entry ticket/);assert.doesNotMatch(textOf(list.children[1]),/View ticket/);
    p.tabs[1].listeners.click();assert.equal(list.children.length,1);assert.match(textOf(list.children[0]),/Sent ticket/);
    p.tabs[2].listeners.click();assert.equal(list.children.length,2);
    p.elements.get('transfer-search').value='C01';p.elements.get('transfer-search').listeners.input();assert.equal(list.children.length,1);
    const malicious={id:'safe',direction:'SENT',fromName:'<img src=x onerror=alert(1)>',toName:'Receiver',isCurrentOwner:false};
    const card=p.window.tsTransferDisplay.receipt(malicious);assert.match(textOf(card),/<img src=x/);assert.equal(card.innerHTML,undefined);
});
test('late history responses cannot repopulate a signed-out or switched account',async()=>{
    let finish;const p=page({load:()=>new Promise(resolve=>{finish=resolve;})});const pending=p.ready();
    p.window.tsCurrentUser=null;await p.ready();finish({records:[{direction:'SENT',fromName:'Private name'}]});await pending;
    assert.equal(p.elements.get('transfer-history-list').children.length,0);assert.equal(p.elements.get('transfer-count-sent').textContent,'0');
});
