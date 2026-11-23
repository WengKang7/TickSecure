const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Model = require('../assets/js/seat-view-model');
const View = require('../assets/js/seat-view-3d');

function fixture() {
    const seats = Array.from({ length: 24 }, (_, i) => ({ id: `id${i}`, seatLabel: `Main-${i + 1}`, number: String(i + 1), status: i === 5 ? 'SOLD' : 'AVAILABLE',
        position: { x: 20 + i % 8 * 8, y: 35 + Math.floor(i / 8) * 14, width: i % 2 ? 4 : 6, height: 4, page: 1 } }));
    return { seats, geometry: { pages: { 1: { imageWidth: 800, imageHeight: 600, decorations: [{ name: 'STAGE', points: [{x:25,y:6},{x:75,y:6},{x:75,y:18},{x:25,y:18}] }] } }, layoutSeats: [
        { seatLabel: seats[0].seatLabel, position: seats[0].position },
        { id: 'must-not-be-selectable', seatLabel: 'Other-1', position: {x:90,y:35,width:4,height:4,page:1} }
    ] } };
}

test('3D category display names do not change physical matching or reservable IDs',()=>{
    const data=fixture();data.seats[0].displaySeatLabel='VIP-1';
    const scene=Model.createScene(data);
    assert.equal(scene.seats[0].label,'VIP-1');assert.equal(scene.seats[0].id,'id0');
    assert.equal(scene.seats.length,25);assert.equal(data.seats[0].seatLabel,'Main-1');
});
function fakeContext() {
    const calls = [];
    return { calls, createLinearGradient: () => ({ addColorStop() {} }), clearRect() {}, fillRect() {}, beginPath() {}, closePath() {}, stroke() {}, fill() {},
        save() {}, restore() {}, clip() {}, quadraticCurveTo(...values) { assert.ok(values.every(Number.isFinite)); },
        moveTo(x, y) { assert.ok(Number.isFinite(x) && Number.isFinite(y)); }, lineTo(x, y) { assert.ok(Number.isFinite(x) && Number.isFinite(y)); },
        fillText(text) { calls.push(text); }, measureText: text => ({ width: text.length * 6 }), setTransform() {} };
}

test('mini-map masks clicks over its overlay and adds no reservable seat IDs',()=>{
    const scene=Model.createScene(fixture(),1,{concertTheme:true});
    const state={concertTheme:true,minimap:true,focusId:'id0',selected:['id0'],orbit:{},look:{}};
    const hits=View.draw(fakeContext(),scene,state,900,600),mask=hits.at(-1);
    assert.equal(mask.id,null);assert.equal(View.hitTest(hits,820,490),null);
    assert.ok(hits.every(h=>h.id===null||scene.seats.some(s=>s.id===h.id)));
    assert.deepEqual(View.draw(fakeContext(),scene,{...state,viewSeatId:'id0'},900,600),[]);
});

test('concert scenery preserves real seat geometry and exact hit regions in overview and seat view', () => {
    const data = fixture(), original = structuredClone(data), scene = Model.createScene(data);
    for (const viewSeatId of [null, 'id0']) {
        const state = { selected:['id1'], viewSeatId, orbit:{}, look:{} };
        const normal = View.draw(fakeContext(), scene, state, 900, 600);
        const concert = View.draw(fakeContext(), scene, {...state, concertTheme:true}, 900, 600);
        assert.deepEqual(concert, normal);
        assert.ok(concert.every(hit => hit.id === null || data.seats.some(seat => seat.id === hit.id)));
    }
    assert.deepEqual(data, original);
});

test('concert stage uses three taller LED panels without moving physical chairs or the stage footprint', () => {
    const data = fixture(), before = structuredClone(data);
    const standard = Model.createScene(data), concert = Model.createScene(data, 1, {concertTheme:true});
    assert.deepEqual(concert.seats, standard.seats);
    assert.equal(concert.stage.x,standard.stage.x); assert.equal(concert.stage.z,standard.stage.z);
    assert.equal(concert.stage.width,standard.stage.width); assert.equal(concert.stage.depth,standard.stage.depth);
    assert.equal(concert.meshes.venueFaces.filter(f=>f.kind==='screen').length,3);
    assert.ok(concert.stage.visualHeight>3.95);
    for (const seat of concert.seats.filter(s=>s.id)) assert.ok(Model.seatCamera(concert,seat.id).eye.every(Number.isFinite));
    View.draw(fakeContext(),concert,{concertTheme:true,selected:[],orbit:{},look:{}},900,600);
    View.draw(fakeContext(),concert,{concertTheme:true,viewSeatId:'id0',selected:[],orbit:{},look:{}},900,600);
    assert.deepEqual(data,before);
});

test('event branding is deterministic, renders the event title, and LED motion leaves picking unchanged',()=>{
    const data=fixture();data.eventName='MandoWave Festival 2026';
    const scene=Model.createScene(data,1,{concertTheme:true}),ctx=fakeContext();
    assert.deepEqual(scene.branding,Model.createScene(data).branding);
    const state={concertTheme:true,selected:[],orbit:{},look:{}};
    const a=View.draw(ctx,scene,{...state,stageTime:0},900,600);
    const b=View.draw(fakeContext(),scene,{...state,stageTime:5},900,600);
    assert.ok(ctx.calls.includes(data.eventName));assert.deepEqual(a,b);
    const from=Model.overviewCamera(scene,1.5),to=Model.seatCamera(scene,'id0');
    assert.equal(Model.blendCamera(from,to,0),from);assert.equal(Model.blendCamera(from,to,1),to);
    for(const t of [.1,.5,.9]){const camera=Model.blendCamera(from,to,t);assert.ok([...camera.eye,...camera.forward,...camera.up,...camera.right,camera.fov].every(Number.isFinite));}
});

test('3D preserves the physical plan, deduplicates context and gives only event chairs selectable IDs', () => {
    const data = fixture(), before = structuredClone(data), scene = Model.createScene(data);
    assert.deepEqual(data, before);
    assert.equal(scene.seats.length, 25);
    assert.equal(scene.seats.at(-1).id, null);
    assert.equal(scene.seats.at(-1).status, 'CONTEXT');
    assert.deepEqual(scene.seats.slice(0,24).map(s => s.id), data.seats.map(s => s.id));
    assert.equal(scene.seats[0].z, scene.seats[1].z);
    assert.ok(Math.abs((scene.seats[1].x - scene.seats[0].x) / (scene.seats[8].z - scene.seats[0].z) - (8 / 104 * 800) / (14 / 106 * 600)) < 1e-10, 'image aspect ratio is retained');
    const chairWidths = scene.seats.map((_, index) => {
        const seat = scene.seats[index];
        const vertices = scene.meshes.faces.filter(f => f.seatIndex === index && f.part === 'backrest').flatMap(f => f.points);
        const localX = vertices.map(p => (p[0]-seat.x)*Math.cos(seat.angle)-(p[2]-seat.z)*Math.sin(seat.angle));
        return Math.max(...localX) - Math.min(...localX);
    });
    chairWidths.forEach(w => assert.ok(Math.abs(w - .86) < 1e-10, 'uneven OCR boxes become equal-sized chairs'));
});

test('seat cameras originate at the actual seat and face detected or explicitly picked stages on each page', () => {
    const data = fixture();
    data.seats.push({ id:'upper', seatLabel:'Upper-1', position:{x:52,y:40,width:4,height:4,page:2} });
    data.geometry.pages[2] = { imageWidth:600, imageHeight:900, stagePoint:{x:52,y:95}, decorations:[] };
    assert.deepEqual(Model.pages(data), [1,2]);
    for (const [page, id] of [[1,'id9'],[2,'upper']]) {
        const scene = Model.createScene(data, page), camera = Model.seatCamera(scene, id), seat = scene.seats.find(s => s.id === id);
        assert.equal(camera.eye[0], seat.x); assert.equal(camera.eye[2], seat.z);
        const stage = Model.project([scene.stage.x, scene.stage.height + 1.4, scene.stage.z], camera, 900, 600);
        assert.ok(Math.abs(stage.x - 450) < 1e-8 && Math.abs(stage.y - 300) < 1e-8);
        assert.equal(scene.stage.estimated, false);
        assert.equal(scene.seats.some(s => s.id === (page === 1 ? 'upper' : 'id9')), false);
    }
    assert.equal(Model.seatCamera(Model.createScene(data), 'not-a-seat'), null);
    data.geometry.pages[1].stagePoint = { x:52,y:100 };
    assert.ok(Model.createScene(data).stage.z > Model.createScene(data).seats[0].z, 'an explicit stage pick overrides OCR');
});

test('missing positions never become invented chairs and an inferred stage is explicitly marked', () => {
    const data = fixture(); data.geometry = {};
    data.seats.push({ id:'missing', seatLabel:'Missing' }, { id:'bad', position:{x:Infinity,y:20} });
    const scene = Model.createScene(data);
    assert.equal(scene.seats.length, 24); assert.equal(scene.stage.estimated, true);
    assert.equal(Model.createScene({ seats:[{id:'missing'}] }), null);
});

test('overview fits the whole venue on narrow and wide screens; eye-plane clipping stays finite', () => {
    const scene = Model.createScene(fixture());
    for (const [width,height] of [[360,400],[1000,650]]) {
        const camera = Model.overviewCamera(scene, width / height);
        for (const seat of scene.seats) {
            const p = Model.project([seat.x,1.5,seat.z],camera,width,height);
            assert.ok(p.x > 0 && p.x < width && p.y > 0 && p.y < height);
        }
        const p = Model.project(scene.meshes.stageLabel,camera,width,height);
        assert.ok(p.x > 0 && p.x < width && p.y > 0 && p.y < height);
    }
    const clipped = Model.clipNear([[-1,0,-1],[1,0,1],[1,1,1],[-1,1,-1]],.08);
    assert.equal(clipped.length,4); clipped.forEach(p => assert.ok(p.every(Number.isFinite) && p[2] >= .08 - 1e-12));
});

test('rendered overview picks exact seat IDs, contextual faces occlude, and seated views cannot select chairs', () => {
    const scene = Model.createScene(fixture()), ctx = fakeContext();
    const hits = View.draw(ctx,scene,{selected:['id9'],focusId:'id9'},1000,650);
    assert.ok(ctx.calls.includes('STAGE'));
    const target = hits.filter(h => h.id === 'id9').at(-1);
    const center = target.points.reduce((p, v) => ({x:p.x+v.x/target.points.length,y:p.y+v.y/target.points.length}),{x:0,y:0});
    assert.equal(View.hitTest(hits,center.x,center.y),'id9');
    assert.equal(hits.some(h => h.id === 'must-not-be-selectable'),false);
    assert.equal(View.hitTest([{id:'seat',points:target.points},{id:null,points:target.points}],center.x,center.y),null);
    assert.deepEqual(View.draw(ctx,scene,{viewSeatId:'id9'},1000,650),[]);
});

test('3D controls support keyboard previews, page changes, cancelled drags and disposal without leaking listeners', () => {
    const ctx = fakeContext(), frames = new Map(), selected = [], views = [], focused = [];
    class Element {
        constructor() { this.listeners = {}; this.style = {}; this.children = []; this.hidden = false; this.capture = null; }
        addEventListener(key, fn) { this.listeners[key] = fn; }
        removeEventListener(key) { delete this.listeners[key]; }
        setAttribute() {} replaceChildren(...children) { this.children = children; }
        getContext() { return ctx; } getBoundingClientRect() { return {left:0,top:0,width:900,height:600}; }
        setPointerCapture(id) { this.capture=id; } hasPointerCapture(id) { return this.capture===id; } releasePointerCapture() { this.capture=null; }
        focus() {} fire(key,event={}) { this.listeners[key]?.({preventDefault(){},...event}); }
    }
    const window = new Element(); window.tsSeatViewModel = Model; window.requestAnimationFrame = fn => { const id=frames.size+1;frames.set(id,fn);return id; }; window.cancelAnimationFrame = id => frames.delete(id);
    const scope = vm.createContext({window,document:{createElement:()=>new Element()}});
    vm.runInContext(fs.readFileSync('assets/js/seat-view-3d.js','utf8'),scope);
    const container = new Element(), controller = window.tsSeatView3D.mount(container,{onSeatSelect:id=>selected.push(id),onFocus:id=>focused.push(id),onViewChange:info=>views.push(info)});
    const data = fixture(); data.seats.push({id:'p2',seatLabel:'Upper-1',position:{x:50,y:50,page:2}});
    controller.update(data); for (const [id,fn] of frames) { frames.delete(id); fn(); }
    const canvas = container.children[0];
    canvas.fire('keydown',{key:'ArrowRight'}); assert.equal(focused.at(-1),'id0');
    canvas.fire('keydown',{key:'v'}); assert.equal(views.at(-1).viewSeatId,'id0'); assert.deepEqual(selected,[]);
    canvas.fire('keydown',{key:'Escape'}); assert.equal(views.at(-1).viewSeatId,null);
    canvas.fire('keydown',{key:'Enter'}); assert.deepEqual(selected,['id0']);
    canvas.fire('pointerdown',{button:0,pointerId:1,clientX:50,clientY:50});
    canvas.fire('pointermove',{pointerId:1,clientX:160,clientY:80});
    canvas.fire('pointercancel',{pointerId:1}); assert.deepEqual(selected,['id0']);
    assert.equal(controller.viewFrom('p2'),true); assert.equal(views.at(-1).page,2);
    controller.zoom(.5); controller.reset();
    assert.equal(views.at(-1).viewSeatId,null); assert.equal(focused.at(-1),null);
    assert.deepEqual(selected,['id0'], 'reset never changes seat selection');
    controller.setPage(1); assert.equal(views.at(-1).page,1); assert.equal(views.at(-1).viewSeatId,null);
    controller.dispose(); assert.equal(frames.size,0); assert.deepEqual(Object.keys(canvas.listeners),[]); assert.equal(container.children.length,0);
});
