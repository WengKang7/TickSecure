const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync,spawn}=require('node:child_process');
const root=path.join(__dirname,'..'),php=process.platform==='win32'?'C:/xampp/php/php.exe':'php';
const senderWallet='0x'+'a'.repeat(40),recipientWallet='0x'+'b'.repeat(40);

function records() {
    return {
        'Users/sender':{role:'buyer',status:'active',emailVerified:true,walletAddress:senderWallet},
        'Users/recipient':{role:'buyer',status:'active',emailVerified:true,walletAddress:recipientWallet},
        'NFTTickets/ticket':{ownerUid:'sender',walletAddress:senderWallet,eventId:'event',eventName:'Concert',status:'VALID',transferHistory:[],seatId:'B03'},
        'Events/event':{status:'PUBLISHED',transferEnabled:true,maxTicketsPerBuyer:2}
    };
}
test('PHP transfer atomically changes the owner and rejects ineligible transfers without writes',()=>{
    const cases=[];
    const add=(name,edit,error,request={})=>{const data=records();edit?.(data);cases.push({name,action:'transferTicket',uid:'sender',records:data,error,data:{ticketId:'ticket',recipientWallet,...request}});};
    add('eligible transfer');
    add('unknown wallet',s=>delete s['Users/recipient'],'failed-precondition');
    add('duplicate wallet',s=>{s['Users/duplicate']={...s['Users/recipient']};},'failed-precondition');
    add('same owner',null,'failed-precondition',{recipientWallet:senderWallet});
    add('wrong owner',s=>{s['NFTTickets/ticket'].ownerUid='someone-else';},'permission-denied');
    add('used ticket',s=>{s['NFTTickets/ticket'].status='USED';},'permission-denied');
    add('listed ticket',s=>{s['NFTTickets/ticket'].status='LISTED_FOR_RESALE';},'permission-denied');
    add('suspended recipient',s=>{s['Users/recipient'].status='suspended';},'permission-denied');
    add('unverified recipient',s=>{s['Users/recipient'].emailVerified=false;},'permission-denied');
    add('disabled transfers',s=>{s['Events/event'].transferEnabled=false;},'failed-precondition');
    add('cancelled event',s=>{s['Events/event'].status='CANCELLED';},'failed-precondition');
    add('recipient at limit',s=>{for(let i=0;i<2;i++)s['NFTTickets/owned'+i]={ownerUid:'recipient',eventId:'event',status:'VALID'};},'failed-precondition');
    const results=JSON.parse(execFileSync(php,[path.join(__dirname,'resale-backend-fixture.php')],{input:JSON.stringify(cases),encoding:'utf8'}));
    for(const [i,result] of results.entries()) {
        const c=cases[i];assert.equal(result.error,c.error,c.name);
        if(c.error){assert.deepEqual(result.records,c.records,c.name+' is atomic');continue;}
        assert.equal(result.result.recipientUid,'recipient');
        const ticket=result.records['NFTTickets/ticket'];
        assert.equal(ticket.ownerUid,'recipient');assert.equal(ticket.walletAddress,recipientWallet);assert.equal(ticket.status,'VALID');
        assert.equal(ticket.transferHistory.length,1);assert.equal(ticket.transferHistory[0].fromUid,'sender');
        assert.equal(ticket.transferHistory[0].toUid,'recipient');assert.equal(ticket.seatId,'B03');
        for(const collection of ['Notifications','AuditLogs','BlockchainTransactions']) assert.equal(Object.keys(result.records).filter(k=>k.startsWith(collection+'/')).length,1);
    }
});

function client(host='localhost',emulator=false,signedIn=true) {
    const requests=[],callables=[];
    const source=fs.readFileSync(path.join(root,'assets/js/backend-client.js'),'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm,'').replace(/^export /gm,'');
    const scope=vm.createContext({app:{},auth:{currentUser:signedIn?{getIdToken:async()=>'test-token'}:null},
        window:{location:{hostname:host},tsFirebase:{backend:{mode:'firebase',compatible:true,endpoint:'/api/backend.php'},emulator:{enabled:emulator}}},
        getFunctions:()=>({}),httpsCallable:(_,name)=>async data=>{callables.push({name,data});return {data:{}};},
        fetch:async(url,options)=>{requests.push({url,...options});return {ok:true,json:async()=>({data:{recipientUid:'recipient'}})};}});
    vm.runInContext(source+'\nthis.invoke=invokeTrustedBackend;',scope);
    return {invoke:scope.invoke,requests,callables};
}
test('localhost transfers use authenticated PHP while emulator and remote hosting retain callable Functions',async()=>{
    for(const name of ['transferTicket','getTicketTransfers']) {
    for(const host of ['localhost','127.0.0.1','[::1]']) {
        const c=client(host);await c.invoke({ticketId:'ticket',recipientWallet},{name});
        assert.equal(c.requests.length,1);assert.equal(c.callables.length,0);assert.equal(c.requests[0].headers.Authorization,'Bearer test-token');
        assert.deepEqual(JSON.parse(c.requests[0].body),{action:name,data:{ticketId:'ticket',recipientWallet}});
    }
    for(const [host,emulator] of [['tickets.example.com',false],['localhost',true]]) {
        const c=client(host,emulator);await c.invoke({ticketId:'ticket',recipientWallet},{name});
        assert.equal(c.requests.length,0);assert.equal(c.callables.length,1);
    }
    const guest=client('localhost',false,false);await assert.rejects(guest.invoke({},{name}),/signed in/);assert.equal(guest.requests.length,0);
    }
});

test('dedicated transfer opt-in still requires authentication and does not enable unrelated actions',async t=>{
    const net=require('node:net'),probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
    const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
    const server=spawn(php,['-S','127.0.0.1:'+port,'-t',root],{windowsHide:true,stdio:['ignore','ignore','pipe'],
        env:{...process.env,TICKSECURE_PHP_BACKEND:'0',TICKSECURE_PHP_TRANSFER:'1',TICKSECURE_PHP_PASSWORD_RESET:'0',TICKSECURE_PHP_CHECKOUT:'0',TICKSECURE_PHP_RESALE:'0'}});
    t.after(()=>server.kill());
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('PHP server did not start')),5000);server.once('error',error=>{clearTimeout(timer);reject(error);});server.stderr.on('data',data=>{if(data.toString().includes('started')){clearTimeout(timer);resolve();}});});
    for(const action of ['transferTicket','getTicketTransfers','scanTicket','checkout','moderateEvent','purchaseResale']) {
        const response=await fetch('http://127.0.0.1:'+port+'/api/backend.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data:{}})});
        assert.equal(response.status,['transferTicket','getTicketTransfers'].includes(action)?401:410,action);
        const body=await response.json();assert.equal(body.error.code,['transferTicket','getTicketTransfers'].includes(action)?'unauthenticated':'php_backend_disabled');
    }
});

function page(options={}) {
    const html=fs.readFileSync(path.join(root,'buyer/ticket-transfer.php'),'utf8');
    const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{disabled:false,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}}]));
    let ready;const calls=[];
    const window={tsCurrentUser:{uid:'sender',fullName:'Sender'},location:{search:'?ticketId=ticket',href:''},addEventListener(name,fn){if(name==='ts-auth-ready')ready=fn;},
        tsDecision:async()=>options.cancel?null:{},
        tsTicketDisplay:{eventDate:()=> '30 Nov 2026'},
        tsTickets:{getTicket:async()=>({id:'ticket',ownerUid:'sender',status:'VALID',eventName:'Concert',seatId:'B03'}),transferTicket:async(id,wallet)=>{calls.push({id,wallet});if(options.error)throw Error(options.error);return {transferId:'receipt'};}},
        tsValidation:{clearFieldErrors(){},runAll(){return true;},val(){return recipientWallet;},el(){return {};},showGlobalError(){}}};
    const document={getElementById:id=>elements.get(id)};
    const source=fs.readFileSync(path.join(root,'assets/js/ticket-transfer.js'),'utf8');
    vm.runInNewContext(source,{window,document,URLSearchParams,console});
    return {window,elements,calls,ready:()=>ready(),click:()=>elements.get('btn-submit').listeners.click({preventDefault(){}})};
}
test('cancel does not transfer; confirmed transfers open a detailed receipt rather than the inaccessible old ticket',async()=>{
    const cancelled=page({cancel:true});await cancelled.ready();await cancelled.click();assert.deepEqual(cancelled.calls,[]);assert.equal(cancelled.window.location.href,'');
    const p=page();await p.ready();await p.click();assert.deepEqual(p.calls,[{id:'ticket',wallet:recipientWallet}]);assert.equal(p.window.location.href,'ticket-transfers.php?transferId=receipt');
    const failed=page({error:'internal'});await failed.ready();await failed.click();assert.match(failed.elements.get('transfer-error').textContent,/transfer service/i);assert.equal(failed.elements.get('btn-submit').disabled,false);assert.equal(failed.window.location.href,'');
});
