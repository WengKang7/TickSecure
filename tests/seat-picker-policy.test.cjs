const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { visibleSeat, checkSelected, layoutContext } = require('../functions/seat-picker-policy.js');
const base = { id: 'e_v_A1', eventId: 'e', venueId: 'v', sectionId: 'A', seatLabel: 'A1', status: 'AVAILABLE' };
const current = 1800000000000;
test('PHP and Functions expose safe availability and only the caller own expiry', () => {
    const seats = [base, { ...base, status: 'RESERVED', reservedBy: 'me', reservationExpiry: new Date(current + 60000).toISOString(), bookingId: 'private' },
        { ...base, status: 'RESERVED', reservedBy: 'someone-else', reservationExpiry: new Date(current + 60000).toISOString() },
        { ...base, status: 'RESERVED', reservedBy: 'someone-else', reservationExpiry: new Date(current - 1).toISOString() }, { ...base, status: 'SOLD' }, { ...base, status: 'unknown' }];
    const js = seats.map(seat => visibleSeat(seat, 'me', {}, current));
    const php = execFileSync('C:/xampp/php/php.exe', ['-r', `require $argv[1]; $seats=json_decode($argv[2],true); echo json_encode(array_map(fn($seat)=>picker_visible_seat($seat,'me',[],1800000000),$seats));`, path.join(__dirname, '../api/seat-picker-policy.php'), JSON.stringify(seats)], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(php), js);
    assert.deepEqual(js.map(s => s.status), ['AVAILABLE','MINE','HELD','AVAILABLE','SOLD','BLOCKED']);
    js.forEach(s => { assert.equal('reservedBy' in s, false); assert.equal('bookingId' in s, false); });
    assert.equal('reservationExpiry' in js[2], false);
});
test('exact selection is all-or-nothing, scoped to the event and section, and can reclaim expired holds', () => {
    const context = { eventId: 'e', venueId: 'v', sectionId: 'A', uid: 'me', now: current };
    assert.equal(checkSelected([base], [base.id], context)[0].id, base.id);
    assert.throws(() => checkSelected([{ ...base, eventId: 'different-event' }], [base.id], context), /does not belong/);
    assert.throws(() => checkSelected([{ ...base, status: 'SOLD' }], [base.id], context), /just taken/);
    assert.throws(() => checkSelected([{ ...base, status: 'RESERVED', reservedBy: 'other', reservationExpiry: new Date(current + 1).toISOString() }], [base.id], context), /just taken/);
    assert.equal(checkSelected([{ ...base, status: 'RESERVED', reservedBy: 'other', reservationExpiry: new Date(current - 1).toISOString() }], [base.id], context).length, 1);
});

test('PHP and Functions expose only deduplicated physical geometry for contextual 3D chairs', () => {
    const marker = { label:'A1',number:'1',x:20,y:30,width:4,height:5,rotation:15,id:'private-id',reservedBy:'private-buyer',bookingId:'private-booking',status:'SOLD' };
    const sections = [{sectionId:'Main',geometry:{page:2,seatMarkers:[marker,marker,{...marker,label:'A2',x:200}]}},{sectionId:'Other',geometry:{seatMarkers:[{...marker,label:'B1'}]}}];
    const js = layoutContext(sections), php = JSON.parse(execFileSync('C:/xampp/php/php.exe',['-r',
        'require $argv[1]; echo json_encode(picker_layout_context(json_decode(stream_get_contents(STDIN),true)));',path.join(__dirname,'../api/seat-picker-policy.php')],{input:JSON.stringify(sections),encoding:'utf8'}));
    assert.deepEqual(php,js); assert.equal(js.length,2); assert.equal(js[0].position.page,2);
    js.forEach(seat => assert.deepEqual(Object.keys(seat).sort(),['number','position','seatLabel']));
    assert.equal(JSON.stringify(js).includes('private-'),false);
});
