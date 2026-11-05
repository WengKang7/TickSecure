const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function setup(options = {}) {
    class Element {
        constructor() { this.value = ''; this.textContent = ''; this.children = []; this.dataset = {}; this.listeners = {}; this.hidden = false; this.classList = {add(){},remove(){}}; }
        addEventListener(name, callback) { this.listeners[name] = callback; }
        appendChild(child) { this.children.push(child); return child; }
        append(...children) { this.children.push(...children); }
        replaceChildren(...children) { this.children = children; }
        setAttribute(name, value) { this[name] = value; }
        focus() { this.focused = true; }
        click() { return this.listeners.click?.(); }
    }
    const elements = new Map([...read('admin/venue-new.php').matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], new Element()]));
    const el = id => elements.get(id);
    el('venue-location-map').dataset.endpoint = '../api/venue-geocoding.php';
    el('venue-location-map').dataset.tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const calls = [], maps = [], markers = [], listeners = {};
    class LeafletMap {
        constructor() { this.listeners = {}; this.layers = new Set(); maps.push(this); }
        setView(point, zoom) { this.center = point; this.zoom = zoom; return this; }
        on(name, callback) { this.listeners[name] = callback; return this; }
        hasLayer(marker) { return this.layers.has(marker); }
    }
    class Marker {
        constructor(point) { this.point = point; this.listeners = {}; markers.push(this); }
        addTo(map) { this.map = map; map.layers.add(this); return this; }
        on(name, callback) { this.listeners[name] = callback; return this; }
        setLatLng(point) { this.point = point; return this; }
        getLatLng() { return {lat:this.point[0],lng:this.point[1]}; }
        remove() { this.map.layers.delete(this); this.map = null; }
    }
    const leaflet = {map:()=>new LeafletMap(),marker:point=>new Marker(point),tileLayer:()=>({addTo(){}})};
    const window = {tsCurrentUser:options.user === undefined ? {role:'admin',status:'active'} : options.user,
        tsFirebase:{auth:{currentUser:{getIdToken:async()=> 'admin-token'}}},
        L:options.noLibrary ? undefined : leaflet,
        addEventListener:(name,callback)=>{listeners[name]=callback;}};
    const document = {getElementById:el,createElement:()=>new Element(),head:new Element()};
    const fetch = async (url, request) => {
        const payload=JSON.parse(request.body); calls.push({type:payload.action,request:payload,headers:request.headers,url});
        if (options.unavailable) return {ok:false,json:async()=>({error:'Another location lookup is running. Wait a moment and try again.'})};
        const data=payload.action === 'search'
            ? (options.search ? await options.search(payload) : {results:[{name:'Meridian Hall',address:'1 Main Road, Kuala Lumpur',latitude:3.1,longitude:101.7}]})
            : (options.reverse ? await options.reverse(payload) : {results:[{name:'3 Test Road',address:'3 Test Road, Kuala Lumpur',latitude:3.3,longitude:101.4}]});
        return {ok:true,json:async()=>data};
    };
    vm.runInNewContext(read('assets/js/venue-location.js'),{window,document,fetch,AbortController,setTimeout,clearTimeout,console});
    return {el,window,calls,maps,markers,listeners};
}
test('explicit search safely lists results and selecting one fills both fields and coordinates', async () => {
    const p=setup(); await tick();
    assert.equal(p.calls.length,0); assert.equal(p.el('venue-location-search').disabled,false);
    p.el('venue-location-query').value='Meridian'; await p.el('venue-location-search').click();
    assert.equal(p.calls.length,1); assert.equal(p.calls[0].request.action,'search');
    const result=p.el('venue-location-results').children[0]; result.click();
    assert.equal(p.el('venue-name').value,'Meridian Hall'); assert.match(p.el('venue-address').value,/Main Road/);
    assert.deepEqual({...p.window.tsVenueLocation.getSelection()},{latitude:3.1,longitude:101.7});
    assert.equal(p.window.tsVenueLocation.isBusy(),false);
});
test('map clicks and dragging reverse-geocode the exact selected point', async () => {
    const p=setup(); await tick();
    p.maps[0].listeners.click({latlng:{lat:3.2,lng:101.5}}); await tick();
    assert.equal(p.calls[0].type,'reverse'); assert.equal(p.el('venue-name').value,'3 Test Road');
    p.markers[0].point=[3.3,101.4]; p.markers[0].listeners.dragend(); await tick();
    assert.equal(p.calls[1].type,'reverse'); assert.equal(p.el('venue-name').value,'3 Test Road');
    assert.deepEqual({...p.window.tsVenueLocation.getSelection()},{latitude:3.3,longitude:101.4});
    assert.equal(p.calls[1].headers.Authorization,'Bearer admin-token');
    assert.equal(p.calls[1].url,'../api/venue-geocoding.php');
    p.el('venue-location-clear').click(); assert.equal(p.window.tsVenueLocation.getSelection(),null); assert.equal(p.markers[0].map,null);
});
test('provider text is rendered as text, and Enter triggers search without a form submission', async () => {
    const p=setup({search:async()=>({results:[{name:'<img src=x onerror=alert(1)>',address:'<script>unsafe</script>',latitude:3,longitude:101}]})}); await tick();
    p.el('venue-location-query').value='Test hall'; let prevented=false;
    p.el('venue-location-query').listeners.keydown({key:'Enter',preventDefault(){prevented=true;}}); await tick();
    assert.equal(prevented,true); const result=p.el('venue-location-results').children[0];
    assert.equal(result.children[0].textContent,'<img src=x onerror=alert(1)>'); assert.equal(result.children[0].children.length,0);
    assert.equal(result.children[1].textContent,'<script>unsafe</script>');
});
test('late reverse lookups cannot replace newer pin details, and typing during a lookup preserves manual corrections', async () => {
    const pending=[];
    const p=setup({reverse:()=>new Promise(resolve=>pending.push(resolve))}); await tick();
    p.maps[0].listeners.click({latlng:{lat:3,lng:101}}); await tick();
    p.maps[0].listeners.click({latlng:{lat:4,lng:102}}); await tick();
    p.el('venue-name').value='My corrected venue'; p.el('venue-name').listeners.input();
    pending[1]({results:[{name:'New venue',address:'New address, City'}]}); await tick();
    pending[0]({results:[{name:'Old venue',address:'Old address, City'}]}); await tick();
    assert.equal(p.el('venue-address').value,'New address, City'); assert.equal(p.el('venue-name').value,'My corrected venue');
    assert.equal(p.window.tsVenueLocation.getSelection().latitude,4);
});
test('lookup failure clears old details, keeps the exact pin and allows manual entry', async () => {
    const p=setup({reverse:async()=>{throw Error('Map unavailable');}}); await tick();
    p.el('venue-address').value='Old venue'; p.maps[0].listeners.click({latlng:{lat:2,lng:100}}); await tick();
    assert.equal(p.el('venue-address').value,''); assert.equal(p.window.tsVenueLocation.isBusy(),false);
    assert.equal(p.window.tsVenueLocation.getSelection().latitude,2); assert.match(p.el('venue-location-status').textContent,/enter the venue details manually/);
});
test('missing map library and non-admin sessions do not call the location service; sign-out invalidates pending lookups', async () => {
    for (const options of [{noLibrary:true},{user:{role:'buyer',status:'active'}}]) {
        const p=setup(options); await tick(); assert.equal(p.maps.length,0); assert.equal(p.el('venue-location-search').disabled,true);
    }
    let finish;
    const p=setup({reverse:()=>new Promise(resolve=>{finish=resolve;})}); await tick();
    p.maps[0].listeners.click({latlng:{lat:1,lng:100}}); await tick();
    p.window.tsCurrentUser=null; p.listeners['ts-auth-ready'](); finish({results:[{address:'Late address'}]}); await tick();
    assert.equal(p.el('venue-address').value,''); assert.equal(p.el('venue-location-search').disabled,true);
});
test('shared service limits show an actionable message and allow manual entry', async () => {
    const p=setup({unavailable:true}); await tick();
    p.maps[0].listeners.click({latlng:{lat:3,lng:101}}); await tick();
    assert.match(p.el('venue-location-status').textContent,/Wait a moment and try again/);
    assert.equal(p.window.tsVenueLocation.isBusy(),false);
});
test('venue creation persists selected coordinates, accepts manual-only details and rejects invalid pins before writing', async () => {
    const crud=read('assets/js/firestore-crud.js'); const writes=[];
    const context=vm.createContext({db:{},collection:(_,name)=>name,addDoc:async(_,data)=>{writes.push(data);return {id:'new-venue'};},
        uid:()=> 'admin',iso:()=> 'now',AuditService:{log:async()=>{}}});
    vm.runInContext(crud.slice(crud.indexOf('export const VenueService ='),crud.indexOf('export const EventService =')).replace('export const VenueService =','globalThis.venue ='),context);
    await context.venue.createVenue({name:'Hall',address:'Venue address',location:{latitude:3,longitude:101,unexpected:'ignore'}});
    assert.equal(writes[0].capacity,0); assert.deepEqual({...writes[0].location},{latitude:3,longitude:101});
    await context.venue.createVenue({name:'Manual hall',address:'Manual address'}); assert.equal('location' in writes[1],false);
    for (const location of [{latitude:91,longitude:1},{latitude:0,longitude:181},{latitude:'3',longitude:1},{latitude:NaN,longitude:1}]) {
        await assert.rejects(context.venue.createVenue({location}),/valid venue location/);
    }
    assert.equal(writes.length,2);
});
test('Add Venue saves without a capacity input, waits for lookup completion and keeps the blueprint workflow', async () => {
    const page=read('admin/venue-new.php'); assert.doesNotMatch(page,/name="venueCapacity"/);
    const code=page.match(/<script type="module">([\s\S]*?)<\/script>/)[1]; let ready,click,busy=true,data,errors=0;
    const window={location:{},tsVenueLocation:{isBusy:()=>busy,getSelection:()=>({latitude:1,longitude:2})},
        tsValidation:{clearFieldErrors(){},showGlobalError(){errors++;},val:(_,field)=>field==='venueName'?'Hall name':'Full address',runAll:()=>true,el:()=>({})},
        tsVenues:{createVenue:async value=>{data=value;return 'venue-123';}}};
    const button={addEventListener:(_,fn)=>{click=fn;}};
    vm.runInNewContext(code,{window,document:{addEventListener:(_,fn)=>{ready=fn;},getElementById:id=>id==='save-venue-btn'?button:{}}}); ready();
    await click({preventDefault(){}}); assert.equal(data,undefined); assert.equal(errors,1);
    busy=false; await click({preventDefault(){}}); assert.equal(data.capacity,0); assert.equal(data.location.latitude,1);
    assert.equal(window.location.href,'venue-layout.php?id=venue-123&step=1');
});
