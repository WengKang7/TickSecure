const {test}=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {checkSelected}=require('../functions/seat-picker-policy');
const seatId='event_physical',data={eventId:'event',seatDocId:seatId};
function seed(){return {
 'Users/A':{role:'buyer',status:'active',emailVerified:true},'Users/B':{role:'buyer',status:'active',emailVerified:true},'Users/C':{role:'buyer',status:'active',emailVerified:true},
 'Events/event':{venueId:'venue',status:'PUBLISHED',maxTicketsPerBuyer:1,categories:{A:{name:'VIP',price:100,quantity:1}}},
 'Seats/physical':{venueId:'venue',sectionId:'A',seatLabel:'A-1'},
 ['EventSeats/'+seatId]:{id:seatId,eventId:'event',venueId:'venue',sectionId:'A',seatLabel:'A-1',status:'RESERVED',reservedBy:'A',reservationExpiry:'2099-01-01T00:00:00Z'}
};}
function run(records,action,uid='B',request=data){return JSON.parse(execFileSync('C:/xampp/php/php.exe',['tests/resale-backend-fixture.php'],{input:JSON.stringify([{action,uid,data:request,records}]),encoding:'utf8'}))[0];}
function queue(){let r=seed();r=run(r,'joinSeatWaitlist','B').records;r=run(r,'joinSeatWaitlist','C').records;return r;}
const release=r=>{r['EventSeats/'+seatId].reservationExpiry='2000-01-01T00:00:00Z';return r;};
test('B joins before C, duplicate join is idempotent and A cannot queue their own hold',()=>{
 const r=queue();assert.deepEqual(r['SeatWaitlists/'+seatId].entries.map(e=>e.uid),['B','C']);
 assert.equal(run(r,'joinSeatWaitlist','B').records['SeatWaitlists/'+seatId].entries.length,2);
 assert.equal(run(r,'joinSeatWaitlist','A').error,'failed-precondition');
 assert.equal(Object.values(r).filter(d=>d.type==='seat_waitlist').length,2);
});
test('release gives B an exclusive offer; C cannot bypass it; expiry promotes C',()=>{
 let r=release(queue());let response=run(r,'advanceSeatWaitlist');assert.equal(response.error,undefined);r=response.records;
 assert.equal(r['EventSeats/'+seatId].reservedBy,'B');assert.equal(r['SeatWaitlists/'+seatId].offerUid,'B');
 assert.ok(Date.parse(r['EventSeats/'+seatId].reservationExpiry)>Date.now()+290000);
 assert.equal(run(r,'holdSelectedSeats','C',{eventId:'event',sectionId:'A',seatDocIds:[seatId]}).error,'already-exists');
 r=release(r);r=run(r,'advanceSeatWaitlist').records;assert.equal(r['EventSeats/'+seatId].reservedBy,'C');
 assert.deepEqual(r['SeatWaitlists/'+seatId].entries,[]);
});
test('claiming an offer starts the normal hold and keeps the next buyer waiting',()=>{
 let r=run(release(queue()),'advanceSeatWaitlist').records;
 const response=run(r,'holdSelectedSeats','B',{eventId:'event',sectionId:'A',seatDocIds:[seatId]});assert.equal(response.error,undefined);r=response.records;
 assert.ok(Date.parse(response.result.reservationExpiry)>Date.now()+590000);
 assert.equal(r['SeatWaitlists/'+seatId].offerUid,'');assert.equal(r['SeatWaitlists/'+seatId].entries[0].uid,'C');
 assert.equal(Object.values(r).some(d=>d.seatDocId===seatId&&d.eventId==='event'&&!d.entries),true,'C membership remains');
 assert.equal(run(r,'advanceSeatWaitlist').records['EventSeats/'+seatId].reservedBy,'B');
});
test('declining an offer immediately advances to C; sold seats close the queue',()=>{
 let r=run(release(queue()),'advanceSeatWaitlist').records;
 r=run(r,'leaveSeatWaitlist','B').records;assert.equal(r['EventSeats/'+seatId].reservedBy,'C');
 r['EventSeats/'+seatId].status='SOLD';r=run(r,'advanceSeatWaitlist').records;
 assert.equal(r['EventSeats/'+seatId].hasWaitlist,false);assert.equal(r['SeatWaitlists/'+seatId].offerUid,'');
 assert.equal(Object.keys(r).filter(k=>k.startsWith('SeatWaitlistMembers/')).length,0);
});
test('ineligible buyers are skipped and queue priority survives a release-before-promotion race',()=>{
 let r=release(queue());r['Users/B'].status='suspended';r=run(r,'advanceSeatWaitlist').records;
 assert.equal(r['EventSeats/'+seatId].reservedBy,'C');
 const seat={id:'s',eventId:'event',venueId:'venue',sectionId:'A',status:'AVAILABLE',hasWaitlist:true};
 assert.throws(()=>checkSelected([seat],['s'],{eventId:'event',venueId:'venue',sectionId:'A',uid:'outsider',now:Date.now()}),/waiting-list/);
});
test('buyers cannot queue sold seats, foreign seats, or more than one seat per event',()=>{
 const r=queue();r['EventSeats/second']={...r['EventSeats/'+seatId],id:'second',hasWaitlist:false};
 assert.equal(run(r,'joinSeatWaitlist','B',{eventId:'event',seatDocId:'second'}).error,'failed-precondition');
 r['EventSeats/second'].status='SOLD';assert.equal(run(r,'joinSeatWaitlist','A',{eventId:'event',seatDocId:'second'}).error,'failed-precondition');
 assert.equal(run(r,'joinSeatWaitlist','B',{eventId:'wrong',seatDocId:seatId}).error,'not-found');
});
