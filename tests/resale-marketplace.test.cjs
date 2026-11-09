const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/resale.php','utf8').match(/<script type="module">([\s\S]*?)<\/script>/)[1];
class Element {
    constructor(){this.value='';this.innerHTML='';this.textContent='';this.listeners={};}
    addEventListener(name,callback){this.listeners[name]=callback;}
    querySelectorAll(){return [];}
}
async function page(listings,lookup){
    const elements=new Map(['resale-grid','resale-search','resale-event-filter','resale-category-filter','resale-price-sort','resale-results-count'].map(id=>[id,new Element()]));
    let ready;const calls=[];
    const window={location:{href:'http://localhost/ticksecure-ui/public/resale.php'},addEventListener:(_,fn)=>ready=fn,
        tsResale:{getActiveListings:async()=>listings},tsEvents:{getEvent:async id=>{calls.push(id);return lookup(id);}}};
    vm.runInNewContext(source,{window,document:{getElementById:id=>elements.get(id)},URL,Intl,console});
    await ready();return {elements,calls,grid:()=>elements.get('resale-grid').innerHTML};
}
const listing={id:'one',eventId:'event',eventName:'Snapshot',categoryName:'VIP',seatId:'A12',resalePrice:88,originalPrice:100};
test('resale cards use current event photos and details, deduplicate event reads and escape text',async()=>{
    const p=await page([listing,{...listing,id:'two'}],()=>({name:'Night <live>',date:'2026-12-31',time:'18:30',venueName:'Concert Hall',
        description:'<script>alert(1)</script>',posterUrl:'/ticksecure-ui/uploads/posters/poster.jpg',eventCategory:'Concert'}));
    assert.deepEqual(p.calls,['event']);assert.match(p.grid(),/Night &lt;live&gt;/);
    assert.match(p.grid(),/src="http:\/\/localhost\/ticksecure-ui\/uploads\/posters\/poster.jpg"/);
    assert.match(p.grid(),/31 Dec 2026/);assert.match(p.grid(),/6:30 pm/);assert.match(p.grid(),/Concert Hall/);
    assert.match(p.grid(),/RM88\.00/);assert.match(p.grid(),/RM100\.00/);assert.match(p.grid(),/A12/);
    assert.doesNotMatch(p.grid(),/<script>/);assert.match(p.grid(),/resale-detail.php\?id=one/);
    assert.match(p.elements.get('resale-results-count').textContent,/2 tickets available/);
});
test('missing event/photo retains listing and cover, and unsafe image schemes are rejected',async()=>{
    const p=await page([{...listing,eventInfo:{name:'Saved event',posterUrl:'javascript:alert(1)'}}],()=>{throw Error('Unavailable');});
    assert.match(p.grid(),/Saved event/);assert.match(p.grid(),/resale-event-cover/);assert.doesNotMatch(p.grid(),/<img/);
    assert.match(p.grid(),/Date to be announced/);assert.match(p.grid(),/Venue to be announced/);
});
test('search, category/event filters and price sorting retain the correct listing links',async()=>{
    const p=await page([listing,{...listing,id:'two',resalePrice:40,categoryName:'General',eventId:'other'}],id=>({name:id==='event'?'First show':'Second show'}));
    p.elements.get('resale-price-sort').value='asc';p.elements.get('resale-price-sort').listeners.change();
    assert.ok(p.grid().indexOf('id=two')<p.grid().indexOf('id=one'));
    p.elements.get('resale-category-filter').value='VIP';p.elements.get('resale-category-filter').listeners.change();
    assert.match(p.grid(),/id=one/);assert.doesNotMatch(p.grid(),/id=two/);
    p.elements.get('resale-category-filter').value='';p.elements.get('resale-event-filter').value='other';p.elements.get('resale-event-filter').listeners.change();
    assert.match(p.grid(),/id=two/);assert.doesNotMatch(p.grid(),/id=one/);
    p.elements.get('resale-search').value='not found';p.elements.get('resale-search').listeners.input();
    assert.match(p.grid(),/No resale listings/);assert.match(p.elements.get('resale-results-count').textContent,/0 tickets/);
});
