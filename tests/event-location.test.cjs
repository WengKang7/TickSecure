const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
class Element {
    constructor(){this.hidden=false;this.textContent='';this.children=[];this.attributes={};}
    append(...nodes){this.children.push(...nodes);}
    removeAttribute(key){delete this.attributes[key];delete this[key];}
}
function page({preview=false,unavailable=false}={}) {
    const ids=['event-location-map','event-location-link','event-location-empty','event-location-status','event-location-name','event-location-address'];
    const elements=new Map(ids.map(id=>[id,new Element()])),calls={maps:[],markers:[],tiles:[],removed:0},events={};
    const map={setView(point,zoom){calls.view={point:[...point],zoom};return this;},remove(){calls.removed++;}};
    const L={map(board,options){calls.maps.push(options);return map;},
        marker(point,options){calls.markers.push({point:[...point],options});return {addTo(){return this;},bindPopup(node){calls.popup=node;}};},
        tileLayer(url,options){calls.tiles.push({url,options});return {on(type,fn){calls.tileError=fn;return this;},addTo(){}};}};
    const window={location:{search:preview?'?preview=1':''},L:unavailable?undefined:L,addEventListener:(name,fn)=>events[name]=fn};
    vm.runInNewContext(fs.readFileSync('assets/js/event-location.js','utf8'),{window,URLSearchParams,document:{getElementById:id=>elements.get(id),createElement:()=>new Element()}});
    return {api:window.tsEventLocation,elements,calls,events};
}
const venue={name:'Hall <live>',address:'Main road',location:{latitude:3.139,longitude:101.6869}};
test('event map uses the saved admin pin, attribution and safe text without changing the location',()=>{
    const p=page();p.api.show(venue);
    assert.deepEqual(p.calls.view,{point:[3.139,101.6869],zoom:16});assert.equal(p.calls.markers[0].options.draggable,false);
    assert.match(p.calls.tiles[0].options.attribution,/OpenStreetMap/);assert.match(p.calls.tiles[0].url,/tile.openstreetmap.org/);
    assert.equal(p.calls.popup.children[0].textContent,'Hall <live>');assert.equal(p.elements.get('event-location-address').textContent,'Main road');
    assert.match(p.elements.get('event-location-link').href,/mlat=3.139&mlon=101.6869/);assert.equal(p.elements.get('event-location-map').hidden,false);
    assert.equal(p.calls.maps[0].scrollWheelZoom,false);
});
test('missing or invalid coordinates never produce a guessed map pin',()=>{
    for(const location of [undefined,{latitude:null,longitude:null},{latitude:'3',longitude:'101'},{latitude:91,longitude:0},{latitude:0,longitude:Infinity}]){
        const p=page();p.api.show({...venue,location});assert.equal(p.calls.maps.length,0);assert.equal(p.elements.get('event-location-link').hidden,true);
    }
    const p=page();p.api.show({...venue,location:{latitude:0,longitude:0}});assert.equal(p.calls.maps.length,1);
});
test('unavailable library keeps address and external location link usable',()=>{
    const p=page({unavailable:true});p.api.show(venue);assert.equal(p.elements.get('event-location-map').hidden,true);
    assert.equal(p.elements.get('event-location-link').hidden,false);assert.match(p.elements.get('event-location-status').textContent,/could not load/);
});
test('changing event or clearing authentication removes old marker and location link',()=>{
    const p=page();p.api.show(venue);p.api.clear('Loading');assert.equal(p.calls.removed,1);
    assert.equal(p.elements.get('event-location-map').hidden,true);assert.equal(p.elements.get('event-location-link').href,undefined);
    assert.equal(p.elements.get('event-location-name').textContent,'Venue information');
});
test('organizer preview map disables navigation, dragging, zoom and marker activation',()=>{
    const p=page({preview:true});p.api.show(venue);
    for(const name of ['dragging','zoomControl','touchZoom','doubleClickZoom','boxZoom','keyboard'])assert.equal(p.calls.maps[0][name],false,name);
    assert.equal(p.calls.markers[0].options.interactive,false);assert.equal(p.elements.get('event-location-link').hidden,true);assert.equal(p.calls.popup,undefined);
});
test('tile failure gives a useful message and page cleanup releases the map',()=>{
    const p=page();p.api.show(venue);p.calls.tileError();assert.match(p.elements.get('event-location-status').textContent,/Map tiles could not load/);
    p.events.pagehide();assert.equal(p.calls.removed,1);
});
