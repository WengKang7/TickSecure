const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const T=require('../assets/js/staff-page-tools');
const {report}=require('../assets/js/organizer-sales');

test('reports exclude unsuccessful payments, reconcile category values and use Malaysia date boundaries',()=>{
    const data={events:[],availability:[{eventId:'a',remaining:6,reserved:2},{eventId:'b',remaining:8,reserved:1}],bookings:[
        {id:'1',eventId:'a',createdAt:'2026-10-31T16:00:00Z',status:'CONFIRMED',quantity:2,totalAmount:220,serviceCharge:20,categoryName:'VIP'},
        {id:'2',eventId:'a',createdAt:'2026-11-01T01:00:00Z',status:'FAILED',quantity:9,totalAmount:900},
        {id:'3',eventId:'b',createdAt:'2026-11-01T01:00:00Z',status:'CONFIRMED',quantity:1,totalAmount:100,serviceCharge:20},
        {id:'4',eventId:'a',createdAt:'2026-10-31T15:59:59Z',status:'CONFIRMED',quantity:5,totalAmount:500}
    ],tickets:[{eventId:'a',createdAt:'2026-11-01T00:00:00Z',status:'USED'},{eventId:'a',createdAt:'2026-11-01T00:00:00Z',status:'VALID'}]};
    const r=report(data,{event:'a',from:'2026-11-01',to:'2026-11-01'});
    assert.equal(r.sold,2);assert.equal(r.revenue,220);assert.equal(r.failed,1);assert.equal(r.available,6);assert.equal(r.reserved,2);
    assert.equal(r.verified,1);assert.equal(r.unverified,1);assert.deepEqual(r.categories,[{name:'VIP',total:200,percent:100}]);
    assert.deepEqual(r.days,[{day:'2026-11-01',count:1,total:220}]);
    assert.throws(()=>report(data,{from:'2026-12-01',to:'2026-11-01'}),/start date/);
    assert.equal(report({events:[],bookings:[],tickets:[],availability:[]}).revenue,0);
});

test('pagination reaches every row and clamps after filtering; CSV neutralizes formulas and quotes',()=>{
    const rows=Array.from({length:47},(_,i)=>i);
    assert.deepEqual([1,2,3].flatMap(p=>T.paginate(rows,p).rows),rows);
    assert.equal(T.paginate(rows.slice(0,2),3).page,1);
    assert.equal(T.paginate([],10).pages,1);
    assert.match(T.csv([['=SUM(1,2)','a"b','line\nbreak']]),/"'=SUM\(1,2\)","a""b","line\nbreak"/);
    assert.equal(T.mintStatus({}),'PENDING');assert.equal(T.esc('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');
});

function list(kind){
    const els=new Map(),get=id=>{if(!els.has(id))els.set(id,{value:'',textContent:'',dataset:{kind},classList:{toggle(){}},setAttribute(){}});return els.get(id);};
    let config;const listeners=[];
    const tabs=['OPEN','RESOLVED'].map(status=>({dataset:{complaintStatus:status},classList:{toggle(){}},setAttribute(){},addEventListener(_,f){listeners.push(f);}}));
    vm.runInNewContext(fs.readFileSync('assets/js/staff-lists.js','utf8'),{window:{tsStaffTools:{...T,table(c){config=c;}}},document:{getElementById:get,querySelectorAll:()=>tabs}});
    return {config,get,listeners};
}

test('NFT event/search/status filters combine, pending is honest, and summary reflects the filtered records',()=>{
    const p=list('nft'),a={id:'ticket-a',eventId:'a',eventName:'Concert A',walletAddress:'0xabc',mintingStatus:'MINTED'},b={id:'ticket-b',eventId:'b'};
    p.get('list-event').value='a';p.get('list-status').value='MINTED';p.get('list-search').value='abc';
    assert.equal(p.config.filter(a),true);assert.equal(p.config.filter(b),false);
    p.config.after([a]);assert.match(p.get('list-summary').textContent,/1 minted/);
    assert.match(p.config.row(b),/PENDING/);assert.match(p.config.row(a),/data-details="ticket-a"/);
});

test('attendees filter current entry state and category; complaint tabs and normal legacy priorities filter correctly',()=>{
    const p=list('attendees');p.get('list-status').value='USED';p.get('list-category').value='VIP';
    assert.equal(p.config.filter({status:'USED',category:'VIP'}),true);assert.equal(p.config.filter({status:'VALID',category:'VIP'}),false);
    const c=list('complaints');let renders=0;c.config.setup(()=>renders++);c.get('list-priority').value='NORMAL';
    assert.equal(c.config.filter({status:'OPEN',priority:'MEDIUM'}),true);c.listeners[1]();assert.equal(renders,1);
    assert.equal(c.config.filter({status:'OPEN',priority:'MEDIUM'}),false);assert.equal(c.config.filter({status:'RESOLVED',priority:'NORMAL'}),true);
});

test('audit date/role/activity filters combine and exports every filtered record',()=>{
    const p=list('audit');p.get('list-date').value='2026-11-01';p.get('list-role').value='ADMIN';p.get('list-activity').value='event_approved';
    const record={timestamp:'2026-10-31T16:00:00Z',actorRole:'admin',action:'event_approved',entityId:'a'};
    assert.equal(p.config.filter(record),true);assert.equal(p.config.filter({...record,actorRole:'buyer'}),false);
    assert.equal(p.config.csv(Array.from({length:45},()=>record)).length,46);
});

test('table controls paginate, filter, disable export on failure and discard late signed-out responses',async()=>{
    class Element {
        constructor(){this.listeners={};this.value='';this.disabled=false;this.innerHTML='';this.textContent='';this.tagName='INPUT';this.type='text';}
        addEventListener(name,fn){this.listeners[name]=fn;}
        append(child){this.child=child;}
        closest(){return card;}
        querySelectorAll(){return buttons;}
        querySelector(){return status;}
        fire(name){return this.listeners[name]?.();}
    }
    const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
    const card=new Element(),buttons=[new Element(),new Element(),new Element()],status=new Element(),events={};
    const window={tsCurrentUser:{uid:'admin',role:'admin',status:'active'},addEventListener(name,fn){events[name]=fn;}};
    const context=vm.createContext({window,document:{getElementById:get,createElement:()=>new Element()},Intl,Date,Set,Map});
    vm.runInContext(fs.readFileSync('assets/js/staff-page-tools.js','utf8'),context);
    let fail=false,resolveLate,calls=0;
    const rows=Array.from({length:47},(_,i)=>({id:i}));
    const controller=window.tsStaffTools.table({role:'admin',body:'body',columns:1,controls:['search'],exportButton:'export',
        load:async()=>{calls++;if(fail)throw Error('Offline');if(resolveLate===true)return new Promise(resolve=>{resolveLate=resolve;});return rows;},
        filter:r=>!get('search').value||String(r.id)===get('search').value,row:r=>`<tr><td>${r.id}</td></tr>`});
    await new Promise(setImmediate);
    assert.match(status.textContent,/47 records/);assert.equal(buttons[0].disabled,true);assert.equal(get('export').disabled,false);
    buttons[1].fire('click');buttons[1].fire('click');assert.match(get('body').innerHTML,/<td>46<\/td>/);assert.equal(buttons[1].disabled,true);
    get('search').value='4';get('search').fire('input');assert.match(status.textContent,/1 records · Page 1/);assert.equal(calls,1);
    fail=true;await controller.refresh();assert.equal(get('export').disabled,true);assert.match(get('body').innerHTML,/Offline/);
    fail=false;resolveLate=true;const pending=controller.refresh();window.tsCurrentUser=null;events['ts-auth-ready']();resolveLate(rows);await pending;
    assert.equal(get('body').innerHTML,'');assert.equal(get('export').disabled,true);
});
