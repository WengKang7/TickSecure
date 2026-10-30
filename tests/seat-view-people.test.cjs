const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Model=require('../assets/js/seat-view-model');
const People=require('../assets/js/seat-view-people');
const View=require('../assets/js/seat-view-3d');

function fixture() {
    return {seats:Array.from({length:18},(_,i)=>({id:'s'+i,seatLabel:'Main-'+i,number:String(i),status:i===3?'SOLD':'AVAILABLE',
        position:{x:20+i%6*10,y:35+Math.floor(i/6)*16,width:5,height:4,page:1}})),geometry:{imageWidth:800,imageHeight:600,
        layoutSeats:[{id:'private-context-id',seatLabel:'Other',position:{x:86,y:40,width:5,height:4,page:1}}]}};
}
function context() {
    const coordinates=[];
    return {coordinates,clearRect(){},fillRect(){},beginPath(){},closePath(){},fill(){},stroke(){},save(){},restore(){},clip(){},setTransform(){},
        createLinearGradient(...values){assert.ok(values.every(Number.isFinite));return {addColorStop(){}};},
        moveTo(...v){assert.ok(v.every(Number.isFinite));coordinates.push(...v);},lineTo(...v){assert.ok(v.every(Number.isFinite));},
        quadraticCurveTo(...v){assert.ok(v.every(Number.isFinite));},fillText(){},measureText:text=>({width:text.length*6})};
}

test('audience is optional, excludes selected/viewing seats, and never changes inventory or contextual IDs',()=>{
    const data=fixture(),before=structuredClone(data),scene=Model.createScene(data),savedScene=structuredClone(scene);
    assert.deepEqual(People.seatIndices(scene),[]);
    const indices=People.seatIndices(scene,{showPeople:true,viewSeatId:'s7',selected:['s8']});
    assert.ok(indices.includes(6) && indices.includes(1),'neighbouring seats are represented');
    assert.ok(!indices.includes(7) && !indices.includes(8));
    assert.ok(indices.includes(3),'sample placement is independent of bookings');
    const faces=People.buildFaces(scene,indices,0);
    assert.ok(faces.length>0);
    assert.equal(scene.seats.at(-1).id,null);
    assert.ok(faces.every(f=>!('id' in f) && f.kind==='person'));
    assert.deepEqual(data,before); assert.deepEqual(scene,savedScene);
    const allSelected=scene.seats.filter(s=>s.id).map(s=>s.id);
    assert.deepEqual(People.seatIndices({...scene,seats:scene.seats.filter(s=>s.id)},{showPeople:true,selected:allSelected}),[]);
});

test('nearby audience is bounded for 5,000 seats and never creates extra chair locations',()=>{
    const scene={seats:Array.from({length:5000},(_,i)=>({id:'s'+i,label:String(i),x:i%100,z:Math.floor(i/100),angle:0}))};
    assert.equal(People.seatIndices(scene,{showPeople:true}).length,72);
    const seated=People.seatIndices(scene,{showPeople:true,viewSeatId:'s2500'});
    assert.equal(seated.length,32); assert.ok(seated.includes(2501)); assert.ok(seated.includes(2400));
    assert.ok(!seated.includes(2500)); assert.equal(new Set(seated).size,seated.length);
});

test('animated poses move gently and deterministically, with finite seated geometry',()=>{
    const scene=Model.createScene(fixture()),a=People.buildFaces(scene,[0],0),b=People.buildFaces(scene,[0],1.5);
    assert.deepEqual(a,People.buildFaces(scene,[0],0)); assert.notDeepEqual(a,b);
    for(const face of b) for(const p of face.points) {
        assert.ok(p.every(Number.isFinite)); assert.ok(p[1]>=0 && p[1]<2.1);
        assert.ok(Math.hypot(p[0]-scene.seats[0].x,p[2]-scene.seats[0].z)<1.1);
    }
    const small=People.buildFaces(scene,[0],1.5,scene.seats.map(()=>12));
    assert.ok(small.length<a.length,'distant people omit small body details');
    assert.deepEqual(People.buildFaces(scene,[0],0,scene.seats.map(()=>0)),[]);
});

test('people preserve exact picking and clip correctly in overview, sideways and near-eye views',()=>{
    const scene=Model.createScene(fixture()),valid=new Set(scene.seats.map(s=>s.id));
    const hits=View.draw(context(),scene,{showPeople:true,selected:['s7'],focusId:'s7'},900,600);
    assert.ok(hits.every(h=>valid.has(h.id)));
    const label=hits.filter(h=>h.id==='s7').at(-1),p=label.points.reduce((a,b)=>({x:a.x+b.x/4,y:a.y+b.y/4}),{x:0,y:0});
    assert.equal(View.hitTest(hits,p.x,p.y),'s7');
    for(const yaw of [-1.3,0,1.3]) assert.deepEqual(View.draw(context(),scene,{showPeople:true,viewSeatId:'s7',look:{yaw},peopleTime:2},380,400),[]);
});

function mounted(reduced=false) {
    const ctx=context(),frames=new Map(),infos=[],times=[];let next=0,observer;
    class Element {
        constructor(){this.listeners={};this.style={};this.children=[];this.hidden=false;}
        addEventListener(k,f){this.listeners[k]=f;} removeEventListener(k){delete this.listeners[k];}
        setAttribute(){} replaceChildren(...children){this.children=children;} getContext(){return ctx;}
        getBoundingClientRect(){return {left:0,top:0,width:900,height:600};} fire(k,event={}){this.listeners[k]?.(event);}
    }
    const window=new Element(),document=new Element(),preference=new Element(),container=new Element();
    preference.matches=reduced; window.matchMedia=()=>preference;document.createElement=()=>new Element();
    window.tsSeatViewModel=Model;window.tsSeatViewPeople={...People,buildFaces(...args){times.push(args[2]);return People.buildFaces(...args);}};
    window.requestAnimationFrame=fn=>{frames.set(++next,fn);return next;};window.cancelAnimationFrame=id=>frames.delete(id);
    const scope=vm.createContext({window,document,IntersectionObserver:class {constructor(fn){observer=fn;}observe(){}disconnect(){observer=null;}}});
    vm.runInContext(fs.readFileSync('assets/js/seat-view-3d.js','utf8'),scope);
    const view=window.tsSeatView3D.mount(container,{onViewChange:info=>infos.push(info)});
    view.update(fixture());
    return {view,window,document,preference,container,frames,infos,times,
        intersect(value){observer([{isIntersecting:value}]);},
        step(time){for(const [id,fn] of [...frames]){frames.delete(id);fn(time);}}};
}

test('animation runs only when enabled, can pause without hiding people, and releases all work on disposal',()=>{
    const p=mounted();p.step(0);assert.equal(p.frames.size,0);assert.equal(p.times.length,0);
    p.view.setPeople(true);p.step(100);assert.equal(p.frames.size,1);
    p.step(110);assert.equal(p.times.length,1,'frame rate is capped');
    p.step(200);assert.ok(p.times.at(-1)>p.times[0]);
    p.view.setPeopleMotion(false);p.step(300);const paused=p.times.at(-1);
    assert.equal(p.frames.size,0);assert.equal(p.infos.at(-1).showPeople,true);
    p.view.zoom(.9);p.step(500);assert.equal(p.times.at(-1),paused);
    p.view.setPeopleMotion(true);p.step(600);p.step(700);assert.ok(p.times.at(-1)>paused);
    p.view.setPeople(false);p.step(800);assert.equal(p.frames.size,0);
    p.view.setPeople(true);p.step(900);p.view.dispose();
    assert.equal(p.frames.size,0);assert.equal(p.container.children.length,0);
    assert.deepEqual(Object.keys(p.window.listeners),[]);assert.deepEqual(Object.keys(p.document.listeners),[]);assert.deepEqual(Object.keys(p.preference.listeners),[]);
});

test('reduced motion, hidden tabs, off-screen and 2D views suspend the loop and resume without jumping',()=>{
    const p=mounted(true);p.step(0);p.view.setPeople(true);p.step(100);
    assert.equal(p.frames.size,0);assert.equal(p.infos.at(-1).reducedMotion,true);assert.equal(p.times.at(-1),0);
    p.preference.fire('change',{matches:false});p.step(200);p.step(300);assert.equal(p.frames.size,1);
    const before=p.times.at(-1);p.document.hidden=true;p.document.fire('visibilitychange');assert.equal(p.frames.size,0);
    p.document.hidden=false;p.document.fire('visibilitychange');p.step(10000);assert.equal(p.times.at(-1),before);
    p.intersect(false);assert.equal(p.frames.size,0);p.intersect(true);p.step(10100);assert.equal(p.frames.size,1);
    p.container.hidden=true;p.view.setVisible(false);assert.equal(p.frames.size,0);
    p.container.hidden=false;p.view.setVisible(true);p.step(10200);assert.equal(p.frames.size,1);
    p.preference.fire('change',{matches:true});p.step(10300);assert.equal(p.frames.size,0);
    assert.equal(p.infos.at(-1).peopleMotion,false);p.view.dispose();
});
