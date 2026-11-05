const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const seating=require('../design2/seating-model');
const Model=require('../assets/js/seat-view-model');

test('DESIGN2 adapts every real preview seat ID, position, status and stage to the original 3D model',()=>{
  const model=seating.sceneModel,scene=Model.createScene(model);
  assert.equal(scene.seats.length,165);
  assert.equal(scene.stage.estimated,false);
  for(const seat of seating.seats){
    const adapted=model.seats.find(s=>s.id===String(seat.id));
    assert.equal(adapted.status,seat.status.toUpperCase());
    assert.equal(adapted.position.x,seat.x/640*104);
    assert.equal(adapted.position.y,seat.y/598*106);
    assert.equal(scene.seats.find(s=>s.id===adapted.id).label,seat.label);
  }
  const camera=Model.seatCamera(scene,'40');
  assert.ok(camera.eye.every(Number.isFinite));
  assert.equal(model.seats.filter(s=>s.status==='AVAILABLE').length,seating.seats.filter(s=>s.status==='Available').length);
});
function fixture(fail=false){
  const elements=new Map(),calls=[],handlers={},listeners={};
  function element(id){return {id,hidden:false,checked:false,disabled:false,textContent:'',attributes:{},setAttribute(k,v){this.attributes[k]=v},replaceWith(next){elements.set(id,next)}}}
  function page(){for(const id of ['d2-three-board','d2-view-3d','d2-view-2d','d2-two-board','d2-people-controls','d2-people','d2-people-motion','d2-seat-overview','d2-3d-status','d2-3d-note','d2-3d-fallback','d2-3d-legend','d2-2d-legend','d2-focused-seat','d2-focused-label','d2-view-from-seat'])elements.set(id,element(id));}
  page();
  const controller={update:(m,s)=>calls.push(['update',m,s]),setVisible:v=>calls.push(['visible',v]),resize:()=>{},dispose:()=>calls.push(['dispose']),focus:id=>handlers.value.onFocus(id)};
  const window={addEventListener:(k,v)=>listeners[k]=v,tsSeatView3D:{mount:(host,callbacks)=>{calls.push(['mount',host]);handlers.value=callbacks;return fail?null:controller}}};
  vm.runInNewContext(fs.readFileSync('design2/seat-3d.js','utf8'),{window,document:{getElementById:id=>elements.get(id)}});
  const selection=[],focus=[];
  const config={model:seating.sceneModel,selected:[],mode:'3d',onSelect:id=>selection.push(id),onFocus:id=>focus.push(id)};
  return {elements,calls,handlers,window,controller,config,page,selection,focus,api:window.d2Seat3D};
}
test('selection and 2D/3D rerenders retain one original controller and the current camera host',()=>{
  const f=fixture();f.api.attach(f.config);
  const host=f.elements.get('d2-three-board');
  f.page();f.api.attach({...f.config,selected:['40']});
  assert.equal(f.elements.get('d2-three-board'),host);
  assert.equal(f.calls.filter(c=>c[0]==='mount').length,1);
  assert.deepEqual(f.calls.filter(c=>c[0]==='update').at(-1)[2],['40']);
  f.handlers.value.onSeatSelect('40');assert.deepEqual(f.selection,[40]);
  f.page();f.api.attach({...f.config,mode:'2d'});
  assert.equal(host.hidden,true);
  assert.equal(f.elements.get('d2-two-board').hidden,false);
  f.page();f.api.attach(f.config);
  assert.equal(host.hidden,false);
  assert.equal(f.calls.filter(c=>c[0]==='mount').length,1);
});
test('leaving the seat flow disposes the renderer, and unavailable canvas falls back to the 2D selector',()=>{
  const f=fixture();f.api.attach(f.config);f.elements.clear();f.api.attach(f.config);
  assert.equal(f.calls.filter(c=>c[0]==='dispose').length,1);
  const broken=fixture(true);let fallback=false;
  broken.api.attach({...broken.config,onFallback:()=>fallback=true});
  assert.equal(fallback,true);
  assert.equal(broken.elements.get('d2-three-board').hidden,true);
  assert.equal(broken.elements.get('d2-two-board').hidden,false);
  assert.equal(broken.elements.get('d2-view-3d').disabled,true);
  assert.equal(broken.elements.get('d2-3d-fallback').hidden,false);
});
