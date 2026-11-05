const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const markup = fs.readFileSync(path.join(__dirname, '../organizer/event-detail.php'), 'utf8');
const source = markup.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
function eventData() {
    return {id:'event-a',organizerUid:'organizer-a',name:'Golden Echo Live',status:'PUBLISHED',description:'Live music in Kuala Lumpur.',eventCategory:'Concert',date:'2026-12-31',time:'19:30',venueName:'Meridian Hall',venueLocation:'Kuala Lumpur',
        createdAt:'2026-11-03T08:00:00Z',updatedAt:'2026-11-04T08:00:00Z',
        categories:{A:{name:'Standard',price:100,quantity:20},B:{name:'Premium',price:150,quantity:10}},
        statusHistory:[{to:'PUBLISHED',timestamp:'2026-11-04T08:00:00Z',changedBy:'admin'}]};
}
async function page({ event = eventData(), id='event-a', fail=false, deferred=null } = {}) {
    const elements = new Map([...markup.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)].map(match=>[match[1],{hidden:/\bhidden\b/.test(match[0]),textContent:'',innerHTML:'',removeAttribute(name){delete this[name];}}]));
    elements.set('.ts-page-title',{textContent:''});elements.set('.ts-page-subtitle',{textContent:''});
    const element = id => elements.get(id);
    let ready;const calls=[],policies=[];
    const window={tsCurrentUser:{uid:'organizer-a',role:'organizer',status:'active'},location:{search:id?'?id='+id:'',href:'http://localhost/ticksecure-ui/organizer/event-detail.php?id=event-a'},addEventListener:(_,callback)=>{ready=callback;},
        tsEvents:{getEvent:async id=>{calls.push(['event',id]);if(deferred)await deferred;return event;}},
        tsBookings:{getBookings:async filters=>{calls.push(['bookings',filters]);if(fail)throw Error('Read failed');return[{sectionId:'A',quantity:3,totalAmount:320}];}},
        tsEventPolicy:{render:(container,event)=>policies.push(event)}};
    vm.runInNewContext(source,{window,document:{getElementById:element,querySelector:element},Intl,Date,URL,URLSearchParams,console:{error(){}}});
    const loading=ready();if(!deferred)await loading;
    return{element,window,calls,policies,loading,ready};
}

test('event overview and sales tab keep existing confirmed-booking totals and preview workflow',async()=>{
    const p=await page();
    assert.equal(p.element('overview-sold').textContent,'3');assert.equal(p.element('overview-remaining').textContent,'27');
    assert.match(p.element('overview-rev').textContent,/320\.00/);assert.equal(p.element('event-sales-bookings').textContent,'1');
    assert.equal(p.element('event-sales-tickets').textContent,'3');assert.equal(p.element('event-sales-total').textContent,p.element('overview-rev').textContent);
    assert.equal(p.element('overview-venue-sub').textContent,'Kuala Lumpur');assert.equal(p.element('overview-description').textContent,'Live music in Kuala Lumpur.');
    assert.equal(p.element('event-sales-progress').max,30);assert.equal(p.element('event-sales-progress').value,3);
    assert.match(p.element('overview-sales-progress-note').textContent,/10\.0%/);assert.equal(p.element('event-detail-tabs').hidden,false);
    assert.deepEqual(JSON.parse(JSON.stringify(p.calls[1][1])),{eventId:'event-a',status:'CONFIRMED'});
    assert.match(p.element('preview-link').href,/id=event-a&preview=1/);assert.equal(p.element('preview-link').hidden,false);
    assert.match(p.element('tickets-tbody').innerHTML,/Standard|Premium|17/);assert.match(p.element('history-timeline').innerHTML,/PUBLISHED/);
    assert.equal(p.element('edit-event-btn').hidden,true);
});

test('draft editing, category forms and draft rules keep their existing behavior',async()=>{
    const event=eventData();event.status='DRAFT';event.categories=[];event.configurationDraft={rules:{maxTicketsPerBuyer:3}};
    const p=await page({event});assert.equal(p.element('edit-event-btn').hidden,false);p.element('edit-event-btn').onclick();
    assert.equal(p.window.location.href,'event-new.php?id=event-a');assert.equal(p.policies[0].maxTicketsPerBuyer,3);
    assert.equal(p.element('overview-allocated').textContent,'0');assert.equal(p.element('overview-prices').textContent,'Not configured');
    assert.equal(p.element('event-sales-progress').max,1);assert.equal(p.element('event-sales-progress').value,0);
    assert.match(p.element('tickets-tbody').innerHTML,/No categories configured/);
});

test('poster handling keeps a fallback for invalid or unavailable images and escapes category/history text',async()=>{
    const event=eventData();event.posterUrl='javascript:alert(1)';event.categories.A.name='<img onerror=bad()>';event.statusHistory[0].changedBy='<script>bad()</script>';
    const p=await page({event});assert.equal(p.element('event-detail-poster').hidden,true);assert.equal(p.element('event-art-fallback').hidden,false);
    assert.doesNotMatch(p.element('tickets-tbody').innerHTML,/<img/);assert.doesNotMatch(p.element('history-timeline').innerHTML,/<script>/);
    event.posterUrl='/ticksecure-ui/uploads/posters/sample.png';const image=await page({event});
    assert.equal(image.element('event-detail-poster').hidden,false);assert.match(image.element('event-detail-poster').src,/http:\/\/localhost\/ticksecure-ui\/uploads/);
    image.element('event-detail-poster').onerror();assert.equal(image.element('event-art-fallback').hidden,false);assert.equal(image.element('event-detail-poster').hidden,true);
});

test('missing events and failed booking data show clear errors without exposing incomplete controls',async()=>{
    for(const options of [{id:''},{event:null},{fail:true}]){
        const p=await page(options);assert.equal(p.element('event-detail-error').hidden,false);
        assert.equal(p.element('event-detail-tabs').hidden,true);assert.equal(p.element('preview-link').hidden,true);assert.equal(p.element('edit-event-btn').hidden,true);
    }
});

test('late event responses cannot populate a detail page after organizer access is lost',async()=>{
    let release;const deferred=new Promise(resolve=>{release=resolve;});const p=await page({deferred});
    p.window.tsCurrentUser=null;await p.ready();release();await p.loading;
    assert.equal(p.element('event-detail-tabs').hidden,true);assert.equal(p.element('overview-description').textContent,'');
});
