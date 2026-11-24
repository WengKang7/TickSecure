const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
async function page(options={}){
 const nodes=new Map(),events={},timers=new Map(),intervals=new Map(),calls={reload:0,sync:0,logout:0,redirect:[]};let serial=0;
 const el=id=>{if(!nodes.has(id))nodes.set(id,{hidden:id==='verification-tick',disabled:false,textContent:'',style:{},setAttribute(){},addEventListener(n,fn){this[n]=fn;}});return nodes.get(id);};
 const user={uid:'buyer',email:'buyer@gmail.com',emailVerified:!!options.verified,async reload(){calls.reload++;if(options.reload)await options.reload();}};
 const document={hidden:!!options.hidden,getElementById:el,addEventListener(n,fn){events['doc:'+n]=fn;}};
 const window={location:{search:'',replace:url=>calls.redirect.push(url),reload(){}},tsFirebase:{auth:{currentUser:user}},
  tsAuth:{async syncEmailVerification(){calls.sync++;return user.emailVerified;},async logout(){calls.logout++;window.tsFirebase.auth.currentUser=null;}},
  addEventListener(n,fn){(events[n]??=[]).push(fn);},setInterval(fn,ms){const id=++serial;intervals.set(id,{fn,ms});return id;},clearInterval:id=>intervals.delete(id),
  setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)};
 const source=fs.readFileSync('auth/verify-email.php','utf8').match(/<script type="module">([\s\S]*?)<\/script>/)[1];
 vm.runInNewContext(source,{window,document,URLSearchParams,Date,localStorage:{getItem(){return null;},setItem(){}}});
 events['doc:DOMContentLoaded']();await flush();
 return {window,document,user,calls,el,events,timers,intervals,async tick(){for(const t of [...intervals.values()])if(t.ms===5000)t.fn();await flush();}};
}
test('unverified waiting checks only Auth and preserves the resend countdown',async()=>{
 const p=await page();await p.tick();assert.equal(p.calls.reload,2);assert.equal(p.calls.sync,0);assert.equal(p.calls.logout,0);
 assert.match(p.el('verification-resend').textContent,/Resend in 60s/);assert.equal(p.calls.redirect.length,0);
});
test('verification from another tab automatically shows a tick then redirects once after sign-out',async()=>{
 const p=await page();p.user.emailVerified=true;await p.tick();
 assert.equal(p.calls.sync,1);assert.equal(p.calls.logout,1);assert.equal(p.el('verification-tick').hidden,false);
 assert.equal(p.el('verification-mail').hidden,true);assert.equal(p.el('verification-heading').textContent,'Email verified');
 assert.equal(p.el('verification-complete').hidden,true);assert.equal(p.calls.redirect.length,0);
 assert.equal(p.timers.size,1);const t=[...p.timers.values()][0];assert.equal(t.ms,1500);t.fn();
 assert.deepEqual(p.calls.redirect,['login.php?verified=1']);assert.equal(p.intervals.size,0);
});
test('hidden tabs pause automatic checks and returning to the page checks immediately',async()=>{
 const p=await page({hidden:true});await p.tick();assert.equal(p.calls.reload,0);
 p.document.hidden=false;p.user.emailVerified=true;p.events.focus[0]();await flush();assert.equal(p.calls.logout,1);
});
test('overlapping manual and automatic checks coalesce and account changes discard late results',async()=>{
 let release;const pending=new Promise(r=>release=r);const p=await page({verified:true,reload:()=>pending});
 p.el('verification-complete').click();await p.tick();assert.equal(p.calls.reload,1);
 p.window.tsFirebase.auth.currentUser={uid:'different-user'};release();await flush();
 assert.equal(p.calls.sync,0);assert.equal(p.calls.logout,0);assert.equal(p.calls.redirect.length,0);
});
test('leaving clears timers and a late verification response cannot sign out or redirect',async()=>{
 let release;const pending=new Promise(r=>release=r);const p=await page({verified:true,reload:()=>pending});
 p.events.pagehide[0]();release();await flush();assert.equal(p.intervals.size,0);assert.equal(p.timers.size,0);
 assert.equal(p.calls.logout,0);assert.equal(p.calls.redirect.length,0);
});
test('a manual unverified check remains available as a fallback',async()=>{
 const p=await page();await p.el('verification-complete').click();await flush();
 assert.match(p.el('verification-progress').textContent,/not verified yet/);assert.equal(p.el('verification-complete').disabled,false);
});
