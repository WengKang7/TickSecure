(function(root,factory){
    if(typeof module==='object'&&module.exports)module.exports=factory(require('./staff-page-tools'));
    else {root.tsOrganizerSales=factory(root.tsStaffTools);root.tsOrganizerSales.mount();}
})(typeof window==='object'?window:globalThis,function(T){
    'use strict';
    function report(data,filters={}) {
        if(filters.from&&filters.to&&filters.from>filters.to)throw Error('The start date must be before the end date.');
        const scope=(r,timestamp)=>{
            if(filters.event&&r.eventId!==filters.event)return false;
            const d=T.day(timestamp);return (!filters.from||(d&&d>=filters.from))&&(!filters.to||(d&&d<=filters.to));
        };
        const rows=data.bookings.filter(b=>scope(b,b.createdAt||b.updatedAt));
        const confirmed=rows.filter(b=>['CONFIRMED','COMPLETED'].includes(T.norm(b.status)));
        const days=new Map(),categories=new Map();let revenue=0,sold=0,faceValue=0;
        for(const b of confirmed){
            const qty=Math.max(0,Math.floor(T.number(b.quantity)||b.seats?.length||b.seatLabels?.length||0));
            const total=T.number(b.totalAmount),value=Math.max(0,total-T.number(b.serviceCharge));
            sold+=qty;revenue+=total;faceValue+=value;
            const day=T.day(b.createdAt||b.updatedAt)||'Date not recorded',bucket=days.get(day)||{day,count:0,total:0};bucket.count++;bucket.total+=total;days.set(day,bucket);
            const category=b.categoryName||b.category||b.sectionId||'Not recorded';categories.set(category,(categories.get(category)||0)+value);
        }
        const tickets=data.tickets.filter(t=>scope(t,t.createdAt));
        const verified=tickets.filter(t=>T.norm(t.status)==='USED').length;
        const inventory=data.availability.filter(a=>!filters.event||a.eventId===filters.event);
        return {rows,confirmed,revenue,sold,verified,unverified:tickets.length-verified,failed:rows.filter(b=>['FAILED','CANCELLED'].includes(T.norm(b.status))).length,
            days:[...days.values()].sort((a,b)=>a.day.localeCompare(b.day)),categories:[...categories].map(([name,total])=>({name,total,percent:faceValue?total/faceValue*100:0})),
            available:inventory.reduce((sum,a)=>sum+T.number(a.remaining),0),reserved:inventory.reduce((sum,a)=>sum+T.number(a.reserved),0)};
    }
    function mount(){
        const el=id=>document.getElementById(id);if(!el('sales-generate'))return;
        const allowed=()=>window.tsCurrentUser?.role==='organizer'&&window.tsCurrentUser?.status==='active';
        let data=null,last=null,version=0;
        const filters=()=>({event:el('sales-event').value,from:el('sales-from').value,to:el('sales-to').value});
        const quantity=b=>T.number(b.quantity)||b.seats?.length||b.seatLabels?.length||0;
        function render(){
            if(!data||!allowed())return;
            try{
                const f=filters(),r=report(data,f);last={...r,filters:f};el('sales-export').disabled=false;
                for(const [id,value] of [['kpi-available',r.available],['kpi-reserved',r.reserved],['kpi-sold',r.sold],['perf-success',r.confirmed.length],['perf-failed',r.failed],['perf-verified',r.verified],['perf-unverified',r.unverified]])el(id).textContent=value.toLocaleString();
                el('kpi-revenue').textContent=T.money(r.revenue);
                el('sales-days').innerHTML=r.days.map(d=>`<tr><td>${T.esc(d.day)}</td><td>${d.count}</td><td>${T.money(d.total)}</td></tr>`).join('')||'<tr><td colspan="3">No confirmed sales in this period.</td></tr>';
                const chart=r.days.slice(-31),maximum=Math.max(1,...chart.map(d=>d.total));
                el('sales-chart').innerHTML=chart.map(d=>`<span class="ts-bar" title="${T.esc(d.day)}: ${T.money(d.total)}" style="height:${Math.max(2,d.total/maximum*170)}px"></span>`).join('');
                el('sales-categories').innerHTML=r.categories.map(c=>`<div class="ts-summary-row"><span>${T.esc(c.name)}</span><strong>${T.money(c.total)} (${c.percent.toFixed(1)}%)</strong></div>`).join('')||'<p>No ticket revenue in this period.</p>';
                el('sales-records').innerHTML=r.rows.map(b=>`<tr><td>${T.esc(b.bookingNumber||b.id)}</td><td>${T.esc(b.eventName||data.events.find(e=>e.id===b.eventId)?.name||b.eventId)}</td><td>${T.esc(T.dateText(b.createdAt||b.updatedAt))}</td><td>${quantity(b)}</td><td>${T.money(b.totalAmount)}</td><td>${T.esc(b.status)}</td></tr>`).join('')||'<tr><td colspan="6">No bookings match these filters.</td></tr>';
                el('sales-message').textContent=`Report updated. ${r.rows.length} bookings. Chart shows up to 31 days; table and CSV include every day.`;
            }catch(error){el('sales-message').textContent=error.message;el('sales-export').disabled=true;}
        }
        async function load(){
            if(!allowed())return;
            const current=++version,uid=window.tsCurrentUser.uid;data=null;last=null;el('sales-export').disabled=true;el('sales-generate').disabled=true;el('sales-message').textContent='Loading report and current availability…';
            try{
                const [events,bookings,tickets]=await Promise.all([window.tsEvents.getOrganizerEvents(),window.tsBookings.getBookings(),window.tsTickets.getTickets()]);
                const published=events.filter(e=>e.status==='PUBLISHED'),availability=[];
                for(let i=0;i<published.length;i+=4)availability.push(...await Promise.all(published.slice(i,i+4).map(e=>window.tsEvents.getEventAvailability(e.id))));
                if(current!==version||!allowed()||window.tsCurrentUser.uid!==uid)return;
                if(availability.some(a=>!Number.isInteger(a.remaining)||!Number.isInteger(a.reserved)))throw Error('Availability response is incomplete. Refresh after the backend is updated.');
                data={events,bookings,tickets,availability};
                T.options(el('sales-event'),new Map([...events.map(e=>[e.id,e.name||e.id]),...bookings.filter(b=>!events.some(e=>e.id===b.eventId)).map(b=>[b.eventId,b.eventName||b.eventId])]),'All events');render();
            }catch(error){if(current!==version||!allowed())return;data=null;last=null;el('sales-message').textContent=`Unable to load report: ${error.message}. Select Generate Report to retry.`;
                for(const id of ['kpi-available','kpi-reserved','kpi-sold','kpi-revenue','perf-success','perf-failed','perf-verified','perf-unverified'])el(id).textContent='Unavailable';
                for(const id of ['sales-days','sales-records','sales-chart','sales-categories'])el(id).innerHTML='';
            }finally{if(current===version)el('sales-generate').disabled=false;}
        }
        for(const id of ['sales-event','sales-from','sales-to'])el(id).addEventListener('change',render);
        el('sales-generate').addEventListener('click',load);
        el('sales-reset').addEventListener('click',()=>{for(const id of ['sales-event','sales-from','sales-to'])el(id).value='';render();});
        el('sales-export').addEventListener('click',()=>{if(!last||!allowed()||el('sales-export').disabled)return;const r=last;
            T.download('ticksecure-organizer-sales.csv',[
                ['Simulated ticket payments. No real settlement.'],['Event',r.filters.event||'All events'],['From (Malaysia time)',r.filters.from||'All dates'],['To (Malaysia time)',r.filters.to||'All dates'],
                ['Available (current published-event snapshot)',r.available],['Active reservations (current published-event snapshot)',r.reserved],['Tickets sold',r.sold],['Checkout total (simulated)',r.revenue],['Verified tickets issued in period',r.verified],['Unverified tickets issued in period',r.unverified],[],
                ['Category','Ticket value','Percent'],...r.categories.map(c=>[c.name,c.total,c.percent.toFixed(1)]),[],['Day','Bookings','Checkout total'],...r.days.map(d=>[d.day,d.count,d.total]),[],
                ['Booking','Event','Recorded (Malaysia time)','Tickets','Checkout total (simulated)','Status'],...r.rows.map(b=>[b.bookingNumber||b.id,b.eventName||b.eventId,T.dateText(b.createdAt||b.updatedAt),quantity(b),b.totalAmount,b.status])]);
        });
        window.addEventListener('ts-auth-ready',()=>{if(allowed())load();else{version++;data=null;last=null;el('sales-export').disabled=true;for(const id of ['sales-days','sales-records','sales-chart','sales-categories'])el(id).innerHTML='';}});
        if(allowed())load();
    }
    return {report,mount};
});
