const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const rows=[
    {id:'a',organizerUid:'organizerA',eventId:'eventA',eventName:'Concert A',ticketId:'ticketA',status:'ACTIVE',resalePrice:105,originalPrice:100,maxAllowedPrice:110},
    {id:'a-suspended',organizerUid:'organizerA',eventId:'eventA',eventName:'Concert A',ticketId:'ticketA2',status:'SUSPENDED',riskFlag:'Review price'},
    {id:'b',organizerUid:'organizerB',eventId:'eventB',eventName:'Private concert B',ticketId:'ticketB',status:'ACTIVE'}
];

// Execute the existing service query so the page test covers account scoping
// at the data boundary as well as the rendered filters and counters.
function resaleService(uid){
    const source=fs.readFileSync('assets/js/firestore-crud.js','utf8');
    const code=source.slice(source.indexOf('export const ResaleService'),source.indexOf('export const BlockchainService'))
        .replace('export const ResaleService =','globalThis.resale =');
    const context={db:{},auth:{currentUser:{uid}},profile:async()=>({id:uid,role:'organizer'}),withResaleAliases:row=>row,
        collection:(_db,name)=>name,where:(field,operator,value)=>({field,value}),query:(collection,...filters)=>({collection,filters}),
        getDocs:async query=>({docs:rows.filter(row=>query.filters.every(filter=>row[filter.field]===filter.value)).map(row=>({id:row.id,data:()=>row}))})};
    vm.runInNewContext(code,context);return context.resale;
}

function monitor(options={}){
    const markup=fs.readFileSync('organizer/secondary-market.php','utf8');
    const elements=new Map([...markup.matchAll(/id="([^"]+)"/g)].map(match=>[match[1],{
        value:match[1]==='resale-risk-filter'?'ALL':'',listeners:{},
        addEventListener(type,listener){this.listeners[type]=listener;},querySelectorAll(){return [];}
    }]));
    const calls=[];let ready;
    const profile={uid:options.uid||'organizerA',role:'organizer',status:'active'};
    const service=resaleService(profile.uid);
    const window={tsCurrentUser:profile,addEventListener:(_type,callback)=>{ready=callback;},
        tsResale:{getListings:async filters=>{calls.push(filters);return options.load?options.load(filters):service.getListings(filters);}}};
    vm.runInNewContext(markup.match(/<script type="module">([\s\S]*?)<\/script>/)[1],{
        window,document:{getElementById:id=>elements.get(id)},console:{error(){}}
    });
    return {elements,calls,window,ready:()=>ready({detail:profile}),auth:profile=>{window.tsCurrentUser=profile;return ready({detail:profile});}};
}

test('each organizer sees only their own resale rows and scoped counters',async()=>{
    for(const uid of ['organizerA','organizerB']){
        const p=monitor({uid});await p.ready();
        assert.equal(p.calls[0].organizerUid,uid);
        const html=p.elements.get('resale-table-body').innerHTML;
        assert.match(html,uid==='organizerA'?/Concert A/:/Private concert B/);
        assert.doesNotMatch(html,uid==='organizerA'?/Private concert B|ticketB/:/Concert A|ticketA/);
        assert.equal(p.elements.get('resale-kpi-active').textContent,1);
        assert.equal(p.elements.get('resale-kpi-suspended').textContent,uid==='organizerA'?1:0);
    }
    await assert.rejects(resaleService('organizerA').getListings({organizerUid:'organizerB'}),/own events only/);
    assert.equal((await resaleService('organizerA').getListings({eventId:'eventB'})).length,0);
});

test('moved search, risk filters and refresh keep the existing monitoring behavior',async()=>{
    const p=monitor();await p.ready();
    const risk=p.elements.get('resale-risk-filter'),search=p.elements.get('resale-search'),table=p.elements.get('resale-table-body');
    risk.value='FLAGGED';risk.listeners.change();assert.match(table.innerHTML,/ticketA2/);assert.doesNotMatch(table.innerHTML,/>ticketA</);
    risk.value='COMPLIANT';risk.listeners.change();assert.match(table.innerHTML,/>ticketA</);assert.doesNotMatch(table.innerHTML,/ticketA2/);
    risk.value='ALL';search.value='no match';search.listeners.input();assert.match(table.innerHTML,/No resale listings match/);
    await p.elements.get('resale-refresh').listeners.click();assert.equal(p.calls.length,2);assert.ok(p.calls.every(call=>call.organizerUid==='organizerA'));
});

test('late resale responses cannot render after sign-out or an account switch',async()=>{
    let finish;const p=monitor({load:()=>new Promise(resolve=>{finish=resolve;})});
    const loading=p.ready();await p.auth(null);finish(rows);await loading;
    assert.doesNotMatch(p.elements.get('resale-table-body').innerHTML,/Concert A|Private concert B/);
});

test('navigation exposes monitoring for organizers and removes the old admin entry',()=>{
    const php=process.platform==='win32'?'C:/xampp/php/php.exe':'php';
    const output=execFileSync(php,['-r',"require 'shared/ui.php'; echo json_encode([ts_sidebar_links('admin','','..'),ts_sidebar_links('organizer','secondary','..')]);"],{encoding:'utf8'});
    const [admin,organizer]=JSON.parse(output);
    assert.doesNotMatch(admin,/Resale Monitoring|admin\/resale.php/);assert.match(organizer,/Resale Monitoring/);assert.match(organizer,/organizer\/secondary-market.php/);
    assert.match(fs.readFileSync('admin/resale.php','utf8'),/Location: dashboard.php/);
});
