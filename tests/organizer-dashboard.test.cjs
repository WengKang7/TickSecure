const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const markup = fs.readFileSync(path.join(__dirname, '../organizer/dashboard.php'), 'utf8');
const source = markup.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
async function dashboard({ empty = false, fail = false, deferred = null } = {}) {
    const elements = new Map(), queries = [];
    const element = id => { if (!elements.has(id)) elements.set(id, {textContent:'',innerHTML:''}); return elements.get(id); };
    let ready;
    const events = empty ? [] : ['PUBLISHED','DRAFT','REJECTED','PENDING_REVIEW','PUBLISHED','CANCELLED'].map((status, index) => ({ id:'event-'+index, name:index ? 'Event '+index : '<script>unsafe</script>', status, date:'2026-12-12', venueName:'Meridian Hall' }));
    const read = (name, data) => async () => { queries.push(name); if (fail && name === 'bookings') throw Error('Read failed'); if (deferred && name === 'events') await deferred; return empty ? [] : data; };
    const window = { tsCurrentUser:{uid:'organizer-a',role:'organizer',status:'active',fullName:'Alex Tan'},addEventListener:(_,callback)=>{ready=callback;},
        tsEvents:{getOrganizerEvents:read('events',events)},
        tsBookings:{getBookings:read('bookings',[
            {eventId:'event-0',status:'CONFIRMED',quantity:2,totalAmount:220},
            {eventId:'event-4',status:'CONFIRMED',seats:['A','B','C'],totalAmount:400},
            {eventId:'event-0',status:'CANCELLED',quantity:99,totalAmount:9999}
        ])},
        tsTickets:{getTickets:read('tickets',[{mintingStatus:'PENDING'},{mintingStatus:'MINTED'}])}
    };
    vm.runInNewContext(source,{window,document:{getElementById:element},console:{error(){}},Intl,Date});
    const loading = ready(); if (!deferred) await loading;
    return {element,window,queries,loading,ready};
}

test('organizer overview uses the signed-in name and scoped event services while preserving confirmed sales totals', async () => {
    const p=await dashboard();
    assert.match(p.element('organizer-welcome').textContent,/Alex Tan/);
    assert.deepEqual(p.queries,['events','bookings','tickets']);
    assert.equal(p.element('active-events-kpi').textContent,'2');assert.equal(p.element('tickets-sold-kpi').textContent,'5');
    assert.match(p.element('revenue-kpi').textContent,/620\.00/);assert.equal(p.element('pending-nft-kpi').textContent,'1');
    assert.equal(p.element('organizer-event-total').textContent,'6 total');
    assert.match(p.element('organizer-event-statuses').innerHTML,/Drafts|Awaiting review|Rejected|Unavailable/);
    assert.equal((p.element('events-table-body').innerHTML.match(/<tr>/g)||[]).length,5);
    assert.match(p.element('events-table-body').innerHTML,/&lt;script&gt;unsafe&lt;\/script&gt;/);
    assert.doesNotMatch(p.element('events-table-body').innerHTML,/<script>|9999|event-5/);
    assert.doesNotMatch(markup,/Nova Stage|Nocturne City|Last 8 reporting periods/);
});

test('empty accounts show zero totals and an honest first-event state', async () => {
    const p=await dashboard({empty:true});
    for(const id of ['active-events-kpi','tickets-sold-kpi','pending-nft-kpi'])assert.equal(p.element(id).textContent,'0');
    assert.match(p.element('revenue-kpi').textContent,/0\.00/);
    assert.match(p.element('organizer-event-statuses').innerHTML,/Create your first event/);
    assert.match(p.element('organizer-event-statuses').innerHTML,/href="event-new.php"/);
    assert.match(p.element('events-table-body').innerHTML,/No events yet/);
});

test('unavailable data shows a retry message rather than fabricated statistics or endless loading', async () => {
    const p=await dashboard({fail:true});
    assert.match(p.element('organizer-dashboard-status').textContent,/Could not load your event data/);
    assert.equal(p.element('revenue-kpi').textContent,'—');
    assert.match(p.element('events-table-body').innerHTML,/could not be loaded/);
});

test('data finishing after organizer access is lost cannot populate the dashboard', async () => {
    let release;const deferred=new Promise(resolve=>{release=resolve;});
    const p=await dashboard({deferred});p.window.tsCurrentUser=null;await p.ready();release();await p.loading;
    assert.equal(p.element('events-table-body').innerHTML,'');assert.equal(p.element('revenue-kpi').textContent,'');
});
