const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const markup = fs.readFileSync(path.join(__dirname, '../admin/reports.php'), 'utf8');
const source = markup.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
function records() {
    return {
        events: [{id:'A', name:'Event Alpha', organizerUid:'orgA'}, {id:'B', name:'Event Beta', organizerUid:'orgB'}, {id:'C', name:'Past Event', organizerUid:'orgC'}],
        users: [{id:'orgA', fullName:'Organizer Alpha', role:'organizer', status:'active'}, {id:'orgB', fullName:'Organizer Beta', role:'organizer', status:'active'}, {id:'orgC', fullName:'Past Organizer', role:'organizer', status:'deleted'}],
        bookings: [
            {id:'dec', eventId:'A', status:'CONFIRMED', createdAt:'2024-12-31T15:59:59Z', quantity:1, totalAmount:100, unitPrice:90, serviceCharge:10},
            {id:'janA', eventId:'A', organizerUid:'orgB', status:'CONFIRMED', createdAt:'2024-12-31T16:00:00Z', quantity:2, totalAmount:220, unitPrice:100, serviceCharge:20},
            {id:'janB', eventId:'B', status:'CONFIRMED', createdAt:'2025-01-31T15:59:59.999Z', quantity:1, totalAmount:80, unitPrice:75, serviceCharge:5},
            {id:'feb', eventId:'B', status:'CONFIRMED', createdAt:'2025-01-31T16:00:00Z', quantity:1, totalAmount:50, unitPrice:45, serviceCharge:5},
            {id:'past', eventId:'C', status:'CONFIRMED', createdAt:'2026-11-03T12:00:00Z', quantity:1, totalAmount:120, unitPrice:100, serviceCharge:20},
            {id:'legacy', eventId:'missing', status:'CONFIRMED', updatedAt:'2025-01-14T00:00:00Z', quantity:1, totalAmount:30, unitPrice:30},
            {id:'undated', eventId:'A', status:'CONFIRMED', quantity:1, totalAmount:40, unitPrice:40},
            {id:'cancelled', eventId:'A', status:'CANCELLED', createdAt:'2025-01-05T00:00:00Z', quantity:1, totalAmount:9000}
        ],
        resales: [
            {id:'resaleJan', eventId:'B', status:'SOLD', completedAt:'2025-01-15T00:00:00Z', resalePrice:90},
            {id:'resaleFeb', eventId:'A', status:'SOLD', completedAt:'2025-02-15T00:00:00Z', resalePrice:100},
            {id:'notSold', eventId:'B', status:'ACTIVE', createdAt:'2025-01-15T00:00:00Z', resalePrice:9999}
        ],
        tickets: [{id:'used', eventId:'A', status:'USED', usedAt:'2024-12-31T16:00:00Z'}, {id:'pastUsed', eventId:'C', status:'USED', usedAt:'2026-11-03T12:00:00Z'}, {id:'unused', eventId:'B', status:'VALID', createdAt:'2025-01-05T00:00:00Z'}]
    };
}
async function page({ data = records(), failure = false, deferred = null } = {}) {
    const elements = new Map(), downloads = [], blobs = [], queries = [];
    function el(selector) {
        if (!elements.has(selector)) elements.set(selector, { value: selector === '#sales-group-filter' ? 'month' : '', innerHTML:'', textContent:'', disabled:false, listeners:{}, addEventListener(type, callback) {this.listeners[type] = callback;} });
        return elements.get(selector);
    }
    let ready;
    const read = (name, value) => async filters => { queries.push({name, filters}); if (failure && name === 'resales') throw Error('Read failed'); if (deferred && name === 'users') await deferred; return value; };
    const window = { tsCurrentUser:{uid:'admin',role:'admin',status:'active'}, addEventListener: (_, callback) => {ready=callback;},
        tsBookings:{getBookings:read('bookings',data.bookings)}, tsResale:{getListings:read('resales',data.resales)},
        tsTickets:{getTickets:read('tickets',data.tickets)}, tsEvents:{getAdminEvents:read('events',data.events)}, tsUsers:{getUsers:read('users',data.users)} };
    const context = vm.createContext({window, console:{error(){}}, Intl, Date, Blob, URL:{createObjectURL:blob=>{blobs.push(blob);return 'blob:report';},revokeObjectURL(){}},setTimeout:callback=>callback(),
        document:{querySelector:el,body:{appendChild:link=>downloads.push(link)},createElement:()=>({click(){},remove(){}})} });
    vm.runInContext(source, context);
    const loading = ready();
    const result = {el,window,queries,blobs,downloads,loading,ready,
        select: (values = {}) => { for(const [name,value] of Object.entries(values)) el('#sales-'+name+'-filter').value=value; el('#btn-apply-sales-filters').listeners.click(); },
        report: () => JSON.parse(vm.runInContext('JSON.stringify({...lastReport,organizers:lastReport.organizers.map(row=>({...row,events:[...row.events]}))})',context)),
        export: () => el('#btn-export-sales').listeners.click(), reset:()=>el('#btn-reset-sales-filters').listeners.click() };
    if (!deferred) await loading;
    return result;
}

test('admin report includes every organizer, historical sales and unassigned records without treating resale as primary sales', async () => {
    const p = await page(), report = p.report();
    assert.equal(report.transactions.length,9);
    assert.equal(report.transactions.filter(row=>row.source==='Primary sale').reduce((sum,row)=>sum+row.amount,0),640);
    assert.equal(report.transactions.filter(row=>row.source==='Resale sale').reduce((sum,row)=>sum+row.amount,0),190);
    assert.deepEqual(report.organizers.map(row=>row.name),['Organizer Alpha','Organizer Beta','Past Organizer','Organizer not recorded']);
    assert.equal(report.organizers.find(row=>row.id==='orgA').checkoutTotal,360);
    assert.equal(report.transactions.find(row=>row.id==='janA').organizerId,'orgA');
    assert.equal(report.organizers.find(row=>row.id==='orgC').checkoutTotal,120);
    assert.ok(p.queries.filter(query=>['bookings','resales','tickets','events'].includes(query.name)).every(query=>query.filters===undefined));
    assert.deepEqual(JSON.parse(JSON.stringify(p.queries.find(query=>query.name==='users').filters)),{role:'organizer'});
    assert.match(p.el('#sales-organizer-filter').innerHTML,/Past Organizer/);
    assert.match(p.el('#sales-period-table-body').innerHTML,/Date not recorded/);
});

test('month/year boundaries use UTC+8 consistently for bookings, resales and check-ins', async () => {
    const p=await page();p.select({year:'2025',month:'01'});const report=p.report();
    assert.deepEqual(report.transactions.map(row=>row.id).sort(),['janA','janB','legacy','resaleJan']);
    assert.equal(report.periods.length,1);assert.equal(report.periods[0].key,'2025-01');
    assert.equal(report.periods[0].checkoutTotal,330);assert.equal(report.periods[0].resaleVolume,90);
    assert.equal(report.periods[0].tickets,4);assert.equal(report.periods[0].serviceCharges,25);assert.equal(report.periods[0].checkedIn,1);
    p.select({month:'02'});assert.deepEqual(p.report().transactions.map(row=>row.id).sort(),['feb','resaleFeb']);
    p.select({year:'2024',month:'12'});assert.deepEqual(p.report().transactions.map(row=>row.id),['dec']);
});

test('yearly and monthly views reconcile to the same primary and resale totals', async () => {
    const p=await page();p.select({year:'2025',group:'year'});const year=p.report();
    assert.equal(year.periods.length,1);assert.equal(year.periods[0].key,'2025');
    assert.equal(year.periods[0].checkoutTotal,380);assert.equal(year.periods[0].resaleVolume,190);
    assert.equal(year.periods[0].tickets,5);assert.equal(p.el('#sales-period-title').textContent,'Yearly sales');
    p.select({group:'month'});assert.equal(p.report().periods.reduce((sum,row)=>sum+row.checkoutTotal+row.resaleVolume,0),570);
    assert.equal(p.el('#sales-period-title').textContent,'Monthly sales');
});

test('organizer, event and source filters combine and reset restores all platform sales', async () => {
    const p=await page();p.select({year:'2025',month:'01',organizer:'orgA',source:'primary'});
    assert.deepEqual(p.report().transactions.map(row=>row.id),['janA']);assert.equal(p.report().organizers.length,1);
    p.select({event:'B'});assert.equal(p.report().transactions.length,0);
    p.select({event:'',organizer:'orgB',source:'resale'});assert.deepEqual(p.report().transactions.map(row=>row.id),['resaleJan']);
    p.reset();assert.equal(p.report().transactions.length,9);assert.equal(p.report().filters.grouping,'month');
});

test('inclusive date range combines with month/year filters and invalid ranges preserve the last applied report', async () => {
    const p=await page();p.el('#sales-date-from').value='2025-01-01';p.el('#sales-date-to').value='2025-01-01';p.select({year:'2025',month:'01'});
    assert.deepEqual(p.report().transactions.map(row=>row.id),['janA']);assert.equal(p.report().periods[0].checkedIn,1);
    p.el('#sales-date-from').value='2025-02-01';p.select({month:'02'});
    assert.match(p.el('#sales-report-status').textContent,/Date from must be on or before/);
    assert.equal(p.report().filters.month,'01');assert.equal(p.report().transactions[0].id,'janA');
    p.export();assert.match(await p.blobs[0].text(),/"Month","January"/);
});

test('CSV exports applied filters, period totals and organizer totals with the same transaction scope', async () => {
    const p=await page();p.select({year:'2025',month:'01',organizer:'orgB'});p.export();
    const csv=await p.blobs[0].text();
    for(const text of ['"Year","2025"','"Month","January"','"Organizer","Organizer Beta"','Sales by period','Sales by organizer','janB','resaleJan','orgB']) assert.ok(csv.includes(text),text);
    assert.doesNotMatch(csv,/janA|Organizer Alpha|2026-11-03/);
    assert.equal(p.downloads[0].download,'ticksecure-sales-month-2025-01.csv');
});

test('same-name organizers stay separate by ID and report/CSV cells safely escape user-entered names', async () => {
    const data=records();data.users[0].fullName=data.users[1].fullName='=HYPERLINK("<script>bad()</script>")';
    const p=await page({data});assert.equal(p.report().organizers.filter(row=>row.name.startsWith('=')).length,2);
    assert.doesNotMatch(p.el('#sales-organizer-table-body').innerHTML,/<script>/);assert.match(p.el('#sales-organizer-table-body').innerHTML,/&lt;script&gt;/);
    p.export();assert.match(await p.blobs[0].text(),/"'=HYPERLINK/);
});

test('empty selected periods produce zero totals and complete tables keep periods beyond the chart limit', async () => {
    const data=records();for(let month=0;month<14;month++)data.bookings.push({id:'historical-'+month,eventId:'A',status:'CONFIRMED',quantity:1,totalAmount:1,createdAt:new Date(Date.UTC(2022,month,1)).toISOString()});
    const p=await page({data});assert.ok(p.report().periods.length>12);
    assert.equal((p.el('#sales-trend-bars').innerHTML.match(/class="ts-bar"/g)||[]).length,12);
    assert.match(p.el('#sales-period-table-body').innerHTML,/Jan 2022/);assert.match(p.el('#sales-trend-subtitle').textContent,/latest 12 periods/);
    p.select({year:'2025',month:'03'});assert.equal(p.report().transactions.length,0);assert.equal(p.report().periods.length,0);
    assert.equal(p.el('#sales-kpi-tickets').textContent,'0');assert.match(p.el('#sales-period-table-body').innerHTML,/No activity matches/);
});

test('partial data failures prevent export and do not present an incomplete report as successful', async () => {
    const p=await page({failure:true});assert.equal(p.el('#btn-export-sales').disabled,true);assert.equal(p.el('#btn-apply-sales-filters').disabled,true);
    assert.match(p.el('#sales-report-status').textContent,/Could not load the complete sales report/);p.export();assert.equal(p.blobs.length,0);
});

test('late data cannot display or export a report after administrator access is lost', async () => {
    let release;const deferred=new Promise(resolve=>{release=resolve;});const p=await page({deferred});
    p.window.tsCurrentUser=null;await p.ready();release();await p.loading;
    assert.equal(p.report().transactions.length,0);assert.equal(p.el('#btn-export-sales').disabled,true);
    p.export();assert.equal(p.blobs.length,0);
});
