const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
class Element {
    constructor(){this.hidden=false;this.disabled=false;this.checked=false;this.textContent='';this.listeners={};this.value='';this.revealed=0;}
    scrollIntoView(){this.revealed++;}
    focus(){}
    addEventListener(name,fn){this.listeners[name]=fn;}
    click(){return this.listeners.click?.();}
}
function page(kind,request){
    const file=kind==='registration'?'buyer/face-registration.php':'verification/scanner.php';
    const html=fs.readFileSync(path.join(root,file),'utf8');
    const els=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
    const events={},calls=[],camera={start:async()=>{},stop(){},frames:async()=>['a','b','c']};
    const window={tsCurrentUser:{uid:kind==='registration'?'buyer':'organizer',role:kind==='registration'?'buyer':'organizer',status:'active'},
        addEventListener:(name,fn)=>events[name]=fn,
        tsFace:{camera:()=>camera,request:async(action,data)=>{calls.push([action,data]);return request(action,data);}}};
    const context=vm.createContext({window,document:{getElementById:id=>els[id],addEventListener(){},hidden:false},
        location:{search:'?ticketId=ticket'},URLSearchParams,confirm:()=>true,setTimeout,console});
    vm.runInContext(fs.readFileSync(path.join(root,'assets/js/face-'+(kind==='registration'?'registration':'checkin')+'.js'),'utf8'),context);
    return {els,window,events,calls,camera,tick:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('registration requires a ready camera and consent; shows ticket only after backend confirmation',async()=>{
    let saved=false;
    const p=page('registration',action=>{if(action==='enroll'){saved=true;return{registered:true};}return{registered:saved,eligible:true,message:saved?'Registered':'Register'};});
    await p.tick(); assert.equal(p.els['face-save'].disabled,true);
    await p.els['face-start'].click();assert.equal(p.els['face-save'].disabled,true);
    p.els['face-consent'].checked=true;p.els['face-consent'].listeners.change();assert.equal(p.els['face-save'].disabled,false);
    await p.els['face-save'].click();assert.equal(p.els['face-ticket'].hidden,false);assert.equal(p.els['face-ticket'].href,'ticket-detail.php?id=ticket');
    assert.equal(p.calls.filter(([a])=>a==='enroll').length,1);
});
test('capture failure does not enroll and camera is stopped',async()=>{
    const p=page('registration',()=>({registered:false,eligible:true}));await p.tick();
    let stopped=0;p.camera.stop=()=>stopped++;p.camera.frames=async()=>{throw Error('No face');};
    await p.els['face-start'].click();p.els['face-consent'].checked=true;p.els['face-consent'].listeners.change();
    await p.els['face-save'].click();assert.equal(p.calls.some(([a])=>a==='enroll'),false);assert.ok(stopped>0);
    assert.equal(p.els['face-error'].hidden,false);assert.equal(p.els['face-save'].disabled,true);
});
test('sign-out during capture prevents enrollment under another account',async()=>{
    const p=page('registration',()=>({registered:false,eligible:true}));await p.tick();
    let finish;p.camera.frames=()=>new Promise(resolve=>finish=resolve);
    await p.els['face-start'].click();p.els['face-consent'].checked=true;p.els['face-consent'].listeners.change();
    const pending=p.els['face-save'].click();p.window.tsCurrentUser=null;await p.events['ts-auth-ready']();finish(['a','b','c']);await pending;
    assert.equal(p.calls.some(([a])=>a==='enroll'),false);
});
async function prepare(p){
    p.els['qr-input'].value='qr';await p.els['verify-btn'].click();await p.els['checkin-face'].click();
}
async function consent(p){p.els['checkin-present'].checked=true;await p.els['checkin-present'].listeners.change();}
test('QR and camera alone do not admit; consent starts actual check-in automatically',async()=>{
    const p=page('checkin',a=>a==='beginCheckIn'?{challengeId:'one'}:{valid:true,reason:'Allowed',ticketId:'ticket'});
    await prepare(p);assert.equal(p.els['checkin-verify'],undefined);
    assert.deepEqual(p.calls.map(([a])=>a),['beginCheckIn']);assert.equal(p.els['checkin-success'].hidden,true);
    await consent(p);assert.equal(p.els['checkin-success'].hidden,false);
    assert.match(p.els['checkin-success-message'].textContent,/Face matched.*now used/);assert.equal(p.els['checkin-success'].revealed,1);
    assert.deepEqual(p.calls.map(([a])=>a),['beginCheckIn','completeCheckIn']);
    await consent(p);assert.equal(p.calls.length,2);
});
test('consent before camera waits for readiness then verifies exactly once',async()=>{
    const p=page('checkin',a=>a==='beginCheckIn'?{challengeId:'one'}:{valid:true,reason:'Allowed',ticketId:'ticket'});
    p.els['qr-input'].value='qr';await p.els['verify-btn'].click();await consent(p);assert.equal(p.calls.length,1);
    await p.els['checkin-face'].click();assert.equal(p.els['checkin-step'].textContent,'Entry allowed');
    await p.els['checkin-face'].click();assert.equal(p.calls.length,2);
});
test('success receipt displays server details safely and formats Malaysia check-in time',async()=>{
    const p=page('checkin',a=>a==='beginCheckIn'?{challengeId:'one'}:{valid:true,ticketId:'ticket-123',
        eventName:'Music <festival>',attendeeName:'Current owner',categoryName:'VIP',section:'North',seat:'A12',usedAt:'2026-11-06T08:30:00Z'});
    await prepare(p);await consent(p);
    assert.equal(p.els['checkin-result-event'].textContent,'Music <festival>');
    assert.equal(p.els['checkin-result-attendee'].textContent,'Current owner');
    assert.equal(p.els['checkin-result-category'].textContent,'VIP');assert.equal(p.els['checkin-result-section'].textContent,'North');
    assert.equal(p.els['checkin-result-seat'].textContent,'A12');assert.equal(p.els['checkin-result-ticket'].textContent,'ticket-123');
    assert.match(p.els['checkin-result-time'].textContent,/4:30:00.*pm.*MYT/i);
    assert.equal(p.els['checkin-result-status'].textContent,'Checked in · Used');
    assert.equal(p.els['checkin-success'].hidden,false);
    p.els['checkin-reset'].click();assert.equal(p.els['checkin-success'].hidden,true);
});
test('mismatch displays failure and cannot automatically retry the consumed challenge',async()=>{
    const p=page('checkin',a=>a==='beginCheckIn'?{challengeId:'one'}:{valid:false,reason:'Face mismatch'});
    await prepare(p);await consent(p);assert.equal(p.els['checkin-success'].hidden,true);
    assert.match(p.els['checkin-error'].textContent,/Verification failed.*mismatch/);assert.equal(p.els['checkin-error'].revealed,1);
    assert.equal(p.els['checkin-face'].hidden,true);await consent(p);assert.equal(p.calls.length,2);
});
test('automatic verification shows progress and reports errors without repeated submissions',async()=>{
    let rejectResult;
    const p=page('checkin',a=>a==='beginCheckIn'?{challengeId:'one'}:new Promise((_,reject)=>rejectResult=reject));
    await prepare(p);assert.match(p.els['checkin-hint'].textContent,/Confirm consent/);
    const pending=consent(p);await p.tick();assert.match(p.els['checkin-status'].textContent,/matching/);
    assert.equal(p.els['checkin-face'].disabled,true);await consent(p);assert.equal(p.calls.length,2);
    rejectResult(Error('This check-in request expired. Scan the QR again.'));await pending;
    assert.equal(p.els['checkin-success'].hidden,true);assert.match(p.els['checkin-error'].textContent,/Verification failed.*expired/);
});
test('preview result cannot display successful admission',async()=>{
    const p=page('checkin',a=>a==='beginCheckIn'?{challengeId:'one'}:{valid:true,testOnly:true,reason:'Preview'});
    await prepare(p);await consent(p);assert.deepEqual(p.calls.map(([a])=>a),['beginCheckIn','completeCheckIn']);
    assert.equal(p.els['checkin-success'].hidden,true);assert.match(p.els['checkin-error'].textContent,/not confirmed/);
});
test('sign-out during automatic capture prevents check-in submission',async()=>{
    const p=page('checkin',()=>({challengeId:'one'}));await prepare(p);
    let finish;p.camera.frames=()=>new Promise(resolve=>finish=resolve);const pending=consent(p);
    p.window.tsCurrentUser=null;p.events['ts-auth-ready']();finish(['a','b','c']);await pending;
    assert.equal(p.calls.some(([a])=>a==='completeCheckIn'),false);
});

test('late QR result after signout does not populate a different scanner session',async()=>{
    let done;const p=page('checkin',()=>new Promise(resolve=>done=resolve));p.els['qr-input'].value='qr';
    const pending=p.els['verify-btn'].click();p.window.tsCurrentUser=null;p.events['ts-auth-ready']();done({challengeId:'one'});await pending;
    assert.equal(p.els['checkin-face'].hidden,true);assert.equal(p.els['checkin-qr'].disabled,true);
});
test('camera stops tracks obtained after a closed page; no audio is requested',async()=>{
    let resolve,captureOptions,stops=0;const handlers={};
    const video={srcObject:null,play:async()=>{}};
    const window={addEventListener:(name,fn)=>handlers[name]=fn};
    const ctx=vm.createContext({window,document:{currentScript:{src:'http://localhost/ticksecure-ui/assets/js/face-client.js'},addEventListener(){}},
        navigator:{mediaDevices:{getUserMedia:options=>{captureOptions=options;return new Promise(done=>resolve=done);}}},URL,setTimeout});
    vm.runInContext(fs.readFileSync(path.join(root,'assets/js/face-client.js'),'utf8'),ctx);
    const camera=window.tsFace.camera(video),pending=camera.start();handlers.pagehide();resolve({getTracks:()=>[{stop:()=>stops++}]});
    await assert.rejects(pending,/closed/);assert.equal(captureOptions.audio,false);assert.equal(stops,1);assert.equal(video.srcObject,null);
});
