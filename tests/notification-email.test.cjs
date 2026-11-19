const {test}=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),vm=require('node:vm');

test('email delivery policies use fake transport and never send real messages',()=>{
    const output=execFileSync('C:/xampp/php/php.exe',['tests/notification-email.test.php'],{encoding:'utf8'});
    assert.match(output,/9 email checks passed\. No real emails sent/);
});

test('only an active administrator can create a notification; caller cannot specify its email destination',()=>{
    const records={'Users/admin':{role:'admin',status:'active'},'Users/buyer':{role:'buyer',status:'active',emailVerified:true},
        'Users/inactive':{role:'admin',status:'suspended'}};
    const data={recipientUid:'buyer',message:'Event approved',type:'event_approved',to:'forged@example.com'};
    const cases=['buyer','inactive','admin'].map(uid=>({action:'createNotification',uid,data,records}));
    const results=JSON.parse(execFileSync('C:/xampp/php/php.exe',['tests/resale-backend-fixture.php'],{input:JSON.stringify(cases),encoding:'utf8'}));
    for(const result of results.slice(0,2)){assert.equal(result.error,'permission-denied');assert.deepEqual(result.records,records);}
    const created=Object.entries(results[2].records).filter(([key])=>key.startsWith('Notifications/'));
    assert.equal(created.length,1);assert.equal(created[0][1].recipientUid,'buyer');assert.equal(created[0][1].to,undefined);
});

function service(host,emulator=false){
    const source=fs.readFileSync('assets/js/firestore-crud.js','utf8');
    const definition=source.slice(source.indexOf('export const NotificationService'),source.indexOf('// USER SERVICE')).replace('export const NotificationService','globalThis.service');
    const calls=[];const c=vm.createContext({window:{location:{hostname:host},tsFirebase:{emulator:{enabled:emulator}}},
        usingLocalPhpBackend:()=>false,invokeTrustedBackend:async(data,config)=>calls.push({data,config}),
        db:{},iso:()=> 'now',collection:()=> 'Notifications',addDoc:async(ref,data)=>calls.push({ref,data})});
    vm.runInContext(definition,c);return {api:c.service,calls};
}
test('Render and localhost send notification creation to authenticated PHP; emulator retains existing storage',async()=>{
    for(const host of ['ticksecure.onrender.com','localhost']){
        const s=service(host);await s.api.create('buyer','Saved','info');
        assert.equal(s.calls.length,1);assert.equal(s.calls[0].config.name,'createNotification');
        assert.equal(s.calls[0].data.recipientUid,'buyer');assert.equal(s.calls[0].data.message,'Saved');
    }
    const s=service('localhost',true);await s.api.create('buyer','Saved');
    assert.equal(s.calls.length,1);assert.equal(s.calls[0].ref,'Notifications');assert.equal(s.calls[0].config,undefined);
});
