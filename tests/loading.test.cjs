const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element {
    constructor(tag='div'){this.tagName=tag;this.nodeType=1;this.children=[];this.attributes={};this.hidden=false;this.disabled=false;this.textContent='';this.className='';this.parentElement=null;}
    append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
    appendChild(node){this.append(node);}
    setAttribute(k,v){this.attributes[k]=String(v);}
    getAttribute(k){return this.attributes[k]??null;}
    removeAttribute(k){delete this.attributes[k];}
    hasAttribute(k){return k in this.attributes;}
    get isConnected(){return this.root || !!this.parentElement?.isConnected;}
    getClientRects(){return this.hidden||this.parentElement?.getClientRects().length===0?[]:[{}];}
    matches(selector){return selector.split(',').some(s=>{
        if(s[0]==='.')return this.className.split(' ').includes(s.slice(1));
        if(s==='a[href]')return this.tagName==='a'&&!!this.href;
        if(s.startsWith('button'))return this.tagName==='button';
        if(s.startsWith('input'))return this.tagName==='input'&&this.type==='submit';
        if(s.startsWith('a[role'))return this.tagName==='a'&&this.getAttribute('role')==='button';
        if(s==='[hidden]')return this.hidden;
        if(s==='[data-ts-inline-feedback][aria-busy="true"]')return this.hasAttribute('data-ts-inline-feedback')&&this.getAttribute('aria-busy')==='true';
        if(s==='[data-ts-inline-feedback]')return this.hasAttribute('data-ts-inline-feedback');
        if(s==='[aria-busy]')return this.hasAttribute('aria-busy');
        return false;
    });}
    closest(s){return this.matches(s)?this:this.parentElement?.closest(s)||null;}
    querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}
}
const flush=()=>new Promise(setImmediate);
function app(fetch=()=>Promise.resolve({ok:true})){
    const body=new Element('body');body.root=true;
    const events={},docEvents={},timers=new Map();let serial=0,observer;
    const document={body,hidden:false,querySelectorAll:s=>body.querySelectorAll(s),createElement:tag=>new Element(tag),addEventListener:(key,fn)=>docEvents[key]=fn};
    class Xhr {constructor(){this.events={};}open(...args){this.args=args;}send(body){this.body=body;}addEventListener(key,fn){this.events[key]=fn;}removeEventListener(key){delete this.events[key];}}
    const window={location:new URL('https://ticksecure.onrender.com/buyer/tickets.php'),fetch,XMLHttpRequest:Xhr,addEventListener:(key,fn)=>events[key]=fn};
    const c=vm.createContext({window,document,Element,URL,queueMicrotask,MutationObserver:class {constructor(fn){observer=fn;}observe(){}},
        setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
    vm.runInContext(fs.readFileSync('assets/js/loading.js','utf8'),c);
    return {window,document,body,events,docEvents,panel:body.children[0],
        tick(ms=180){for(const [id,t]of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}},
        mutate(node){observer([{target:node,addedNodes:[]}]);}};
}
test('concurrent fetch requests preserve responses and options; indicator clears after success and failure',async()=>{
    const requests=[];const p=app((...args)=>new Promise((resolve,reject)=>requests.push({args,resolve,reject})));
    const opts={signal:{},body:'unchanged'};const first=p.window.fetch('/api/one',opts),second=p.window.fetch('/api/two');
    assert.equal(p.panel.hidden,true);p.tick();assert.equal(p.panel.hidden,false);
    const response={ok:true};requests[0].resolve(response);assert.equal(await first,response);assert.equal(requests[0].args[1],opts);assert.equal(p.panel.hidden,false);
    const error=Error('Network failed');requests[1].reject(error);await assert.rejects(second,e=>e===error);assert.equal(p.panel.hidden,true);
});
test('fast, synchronous failures and long-lived listeners do not leave a spinner',async()=>{
    const p=app(()=>Promise.resolve('done'));await p.window.fetch('/api/fast');p.tick();assert.equal(p.panel.hidden,true);
    const failed=app(()=>{throw Error('Bad request');});assert.throws(()=>failed.window.fetch(null));failed.tick();assert.equal(failed.panel.hidden,true);
    const stream=app(()=>new Promise(()=>{}));stream.window.fetch('https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel');stream.tick();assert.equal(stream.panel.hidden,true);
});
test('disabled controls need explicit processing text or aria-busy; ordinary unavailable buttons stay unchanged',()=>{
    const p=app(),button=new Element('button');button.disabled=true;button.textContent='Sold out';p.body.append(button);p.mutate(button);assert.equal(button.hasAttribute('data-ts-loading'),false);
    button.textContent='Saving draft…';p.mutate(button);assert.equal(button.getAttribute('data-ts-loading'),'true');
    button.disabled=false;button.textContent='Save draft';p.mutate(button);assert.equal(button.hasAttribute('data-ts-loading'),false);
});
test('busy regions display shared feedback, while the face inline spinner prevents a duplicate indicator',()=>{
    const p=app(),region=new Element();p.body.append(region);region.setAttribute('aria-busy','true');p.mutate(region);p.tick();assert.equal(p.panel.hidden,false);
    region.setAttribute('data-ts-inline-feedback','');p.mutate(region);assert.equal(p.panel.hidden,true);
    region.setAttribute('aria-busy','false');p.mutate(region);p.tick();assert.equal(p.panel.hidden,true);
});
test('XHR completion clears loading without changing the upload body',()=>{
    const p=app(),xhr=new p.window.XMLHttpRequest(),body={file:'opaque'};xhr.open('POST','/api/upload');xhr.send(body);p.tick();assert.equal(p.panel.hidden,false);assert.equal(xhr.body,body);
    xhr.events.loadend();assert.equal(p.panel.hidden,true);
});
test('cancelled navigation never starts loading; accepted navigation resets on page restoration',async()=>{
    const p=app(),link=new Element('a');link.href='https://ticksecure.onrender.com/buyer/wallet.php';p.body.append(link);
    const event={target:link,button:0,defaultPrevented:true};p.docEvents.click(event);await flush();p.tick();assert.equal(p.panel.hidden,true);
    event.defaultPrevented=false;p.docEvents.click(event);await flush();p.tick();assert.equal(p.panel.hidden,false);
    p.events.pagehide();p.events.pageshow({persisted:true});assert.equal(p.panel.hidden,true);
});
test('all shared role and authentication layouts include the same versioned loading script',()=>{
    const source=fs.readFileSync('shared/ui.php','utf8');assert.equal((source.match(/ts_asset_url\('assets\/js\/loading.js'/g)||[]).length,3);
});


test('the loading indicator ignores its own mutations to avoid observer feedback loops',()=>{
    const p=app();let writes=0,value=p.panel.hidden;
    Object.defineProperty(p.panel,'hidden',{get:()=>value,set:next=>{value=next;writes++;}});
    p.mutate(p.panel);assert.equal(writes,0);
});
