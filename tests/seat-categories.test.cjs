const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { allocateSeats } = require('../functions/seat-allocation-policy');
const { eventAvailability } = require('../functions/event-availability');
const model = require('../assets/js/seat-category-model');
const physical = ['Left', 'Centre', 'Right'].flatMap(sectionId => Array.from({ length: 12 }, (_, i) => ({
    id: sectionId + i, venueId: 'hall', sectionId, seatLabel: sectionId + '-A' + (i + 1),
    rowLabel: 'A', seatNumber: String(i + 1), position: { x: i + 1, y: 30, rotation: sectionId === 'Left' ? 15 : -15 }
})));
const categories = {
    CAT_VIP: { name: 'VIP', price: 200, quantity: 4, color: '#9170ca', seatLabels: ['Left-A2', 'Left-A3', 'Centre-A10', 'Right-A7'] },
    CAT_STANDARD: { name: 'Standard', price: 100, quantity: 2, seatLabels: ['Left-A1', 'Centre-A1'] }
};
function phpAllocation(input) {
    return JSON.parse(execFileSync('C:/xampp/php/php.exe', ['-r',
        'require $argv[1]; $i=json_decode(stream_get_contents(STDIN),true); try { echo json_encode(category_allocate_seats($i[0],$i[1])); } catch (Throwable $e) { echo json_encode(["error"=>$e->getMessage()]); }',
        path.join(__dirname, '../api/seat-category-policy.php')], { input: JSON.stringify(input), encoding: 'utf8' }));
}
test('PHP and Functions allocate the exact chosen seats across banks and preserve physical positions', () => {
    const original = structuredClone(physical), js = allocateSeats(categories, physical), php = phpAllocation([categories, physical]);
    assert.deepEqual(php, js);
    assert.deepEqual(js.filter(s => s.sectionId === 'CAT_VIP').map(s => s.sourceSeat.seatLabel), categories.CAT_VIP.seatLabels);
    assert.equal(js.length, 6, 'the other 30 chairs remain off sale');
    assert.deepEqual(physical, original);
});
test('both backends reject duplicate, overlapping, missing, and wrongly counted physical seats before allocation', () => {
    const bad = [
        { ...categories, CAT_OTHER: { name: 'Other', price: 10, quantity: 1, seatLabels: ['Left-A2'] } },
        { CAT_BAD: { name: 'Bad', price: 10, quantity: 2, seatLabels: ['Left-A2', 'Left-A2'] } },
        { CAT_BAD: { name: 'Bad', price: 10, quantity: 1, seatLabels: ['Other-A2'] } },
        { CAT_BAD: { name: 'Bad', price: 10, quantity: 3, seatLabels: ['Left-A2'] } },
        { CAT_BAD: { name: 'Bad', price: 10, quantity: 1, seatLabels: null } },
        { Left: { name: 'Whole section', price: 10, quantity: 12 }, CAT_VIP: categories.CAT_VIP }
    ];
    bad.forEach(config => {
        assert.throws(() => allocateSeats(config, physical));
        assert.equal(typeof phpAllocation([config, physical]).error, 'string');
    });
});
test('legacy whole-section allocations still work in both backends', () => {
    const config = { Left: { name: 'Left', price: 50, quantity: 3 } };
    assert.deepEqual(allocateSeats(config, physical), phpAllocation([config, physical]));
});
test('exact-category availability works before lazy inventory exists and subtracts sold seats and active holds', () => {
    const event = { id: 'show', venueId: 'hall', categories }, now = Date.now();
    const inventory = [
        { eventId: 'show', venueId: 'hall', sectionId: 'CAT_VIP', status: 'SOLD' },
        { eventId: 'show', venueId: 'hall', sectionId: 'CAT_VIP', status: 'RESERVED', reservationExpiry: new Date(now + 60000).toISOString() }
    ];
    const js = eventAvailability(event, physical, inventory, now);
    const php = JSON.parse(execFileSync('C:/xampp/php/php.exe', ['-r',
        'require $argv[1]; $i=json_decode(stream_get_contents(STDIN),true); echo json_encode(backend_event_availability($i[0],$i[1],$i[2],$i[3]/1000));',
        path.join(__dirname, '../api/event-availability.php')], { input: JSON.stringify([event, physical, inventory, now]), encoding: 'utf8' }));
    assert.equal(eventAvailability(event, physical, [], now).remaining, 6);
    assert.deepEqual(php.categories, js.categories);
    assert.deepEqual(js.categories.map(c => c.remaining), [2, 2]);
    assert.equal(js.remaining, 4);
});
test('venue colours use the assigned seats without moving or renumbering any chairs', () => {
    const sections = ['Left', 'Centre', 'Right'].map(sectionId => ({ sectionId, geometry: { seatMarkers: physical.filter(s => s.sectionId === sectionId).map(s => ({
        ...s.position, label: s.seatLabel.slice(sectionId.length + 1), row: 'A', number: s.seatNumber
    })) } }));
    const original = structuredClone(sections), projected = model.project(sections, categories);
    assert.deepEqual(sections, original);
    assert.equal(projected[0].geometry.seatMarkers[1].categoryId, 'CAT_VIP');
    assert.equal(projected[0].geometry.seatMarkers[1].rotation, 15);
    assert.equal(projected[0].geometry.seatMarkers[3].categoryName, 'Off sale');
    assert.match(model.validate({ ...categories.CAT_STANDARD, seatLabels: ['Left-A2'], quantity: 1 }, categories, sections, 'CAT_STANDARD'), /already belong/);
});
test('saving normalized event categories retains exact selections and colours', () => {
    const source = fs.readFileSync(path.join(__dirname, '../assets/js/firestore-crud.js'), 'utf8');
    const fn = source.slice(source.indexOf('export function normalizeEventCategories'), source.indexOf('// Read-time aliases')).replace('export ', '');
    const normalize = vm.runInNewContext(fn + '; normalizeEventCategories', { asAmount: value => Number(value) || 0 });
    assert.deepEqual(JSON.parse(JSON.stringify(normalize(categories))), categories);
});
