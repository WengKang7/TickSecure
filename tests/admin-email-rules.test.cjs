const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function evaluate(file,name,profile,signedIn=true){
    const source=fs.readFileSync(file,'utf8'),body=source.match(new RegExp('function '+name+'\\(\\)\\s*\\{([\\s\\S]*?)\\}'))[1];
    const path='/databases/(default)/documents/Users/$(request.auth.uid)';
    const code=body.replaceAll('firestore.exists('+path+')','hasProfile()').replaceAll('firestore.get('+path+').data','profile');
    return vm.runInNewContext('(function(){'+code+'})()',{profile,signedIn:()=>signedIn,hasProfile:()=>signedIn&&!!profile,currentRole:()=>profile?.role,currentStatus:()=>profile?.status,currentEmailVerified:()=>profile?.emailVerified===true});
}
test('Firebase account predicates exempt active admins and retain verification/status checks for other roles',()=>{
    for(const [file,active] of [['firestore.rules','isActiveAccount'],['storage.rules','hasActiveProfile']]){
        for(const emailVerified of [true,false,undefined]){
            const admin={role:'admin',status:'active',emailVerified};assert.equal(evaluate(file,active,admin),true);assert.equal(evaluate(file,'isAdmin',admin),true);
            for(const role of ['buyer','organizer']){const profile={role,status:'active',emailVerified};assert.equal(evaluate(file,active,profile),emailVerified===true);assert.equal(evaluate(file,'isAdmin',profile),false);}
            for(const status of ['suspended','deleted','pending']){const profile={role:'admin',status,emailVerified};assert.equal(evaluate(file,active,profile),false);assert.equal(evaluate(file,'isAdmin',profile),false);}
        }
        assert.equal(evaluate(file,active,null),false);assert.equal(evaluate(file,'isAdmin',{role:'admin',status:'active'},false),false);
    }
});
