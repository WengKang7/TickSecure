const {test} = require('node:test');
const assert = require('node:assert/strict');
const model = require('../design2/seating-model.js');
const initial = {category:0,quantity:2,seats:[]};

test('the curved venue has 165 unique seats, three category allocations and real gaps between rows',()=>{
  assert.equal(model.seats.length,165);
  assert.equal(new Set(model.seats.map(s=>s.id)).size,165);
  for(const category of [0,1,2]){
    assert.ok(model.available(category).length>0);
    assert.ok(model.available(category).every(s=>s.status==='Available'));
  }
  assert.ok(model.seats.find(s=>s.row==='A').y>model.seats.find(s=>s.row==='J').y);
  assert.ok(model.seats.every(s=>s.x>0&&s.x<640&&s.y>0&&s.y<598));
});
test('selecting and removing seats preserves quantity limits without mutating the previous selection',()=>{
  const [a,b,c]=model.available(0);
  const first=model.select(initial,a.id), second=model.select(first,b.id);
  assert.deepEqual(initial.seats,[]);
  assert.equal(model.valid(first),false);
  assert.equal(model.valid(second),true);
  const excess=model.select(second,c.id);
  assert.match(excess.error,/up to 2/);
  assert.deepEqual(excess.seats,second.seats);
  assert.deepEqual(model.select(second,a.id).seats,[b.id]);
});
test('choosing a different category starts a matching selection and never mixes category prices',()=>{
  const a=model.available(0)[0], b=model.available(1)[0];
  const next=model.select({category:0,quantity:1,seats:[a.id]},b.id);
  assert.equal(next.category,1);
  assert.deepEqual(next.seats,[b.id]);
  assert.equal(model.valid(next),true);
  assert.equal(model.valid({category:1,quantity:2,seats:[a.id,b.id]}),false);
});
test('sold, held, missing, duplicate or incomplete selections cannot proceed to checkout',()=>{
  for(const seat of model.seats.filter(s=>s.status!=='Available')){
    assert.match(model.select(initial,seat.id).error,/not available/);
    assert.equal(model.valid({category:seat.category,quantity:1,seats:[seat.id]}),false);
  }
  assert.match(model.select(initial,9999).error,/not available/);
  const a=model.available(0)[0];
  assert.equal(model.valid({category:0,quantity:2,seats:[a.id,a.id]}),false);
  assert.equal(model.valid({category:0,quantity:0,seats:[]}),false);
  assert.equal(model.valid(initial),false);
});
