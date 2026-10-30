const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const layout = require('../assets/js/seat-layout-model.js');
class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.textContent = ''; this.value = ''; }
    appendChild(node) { this.children.push(node); node.parent = this; }
    append(...nodes) { nodes.forEach(n => this.appendChild(n)); }
    before(node) { this.parent.appendChild(node); }
    remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); }
    setAttribute(k,v) { this.attributes[k] = v; }
    addEventListener() {}
    click() { if (!this.disabled) this.onclick?.(); }
    all() { return [this, ...this.children.flatMap(n => n.all())]; }
}
function page(options = {}) {
    const root = new Element('main'), board = new Element('div'); root.appendChild(board);
    const data = [{ letter: 'Main', name: 'Main', seats: 3, geometry: { page: 1, imageWidth: 1000, imageHeight: 700, source: 'shape-detection', reviewed: true,
        seatMarkers: [1,2,3].map(i => ({ id: 'seat' + i, x: 10 + i * 5, y: 30, width: 1, height: 1, label: 'A' + i, row: 'A', number: String(i) })) } }];
    if (options.oldAuto) {
        data[0].geometry.numbering = { mode: 'nearest-stage', stageSource: 'picked', stagePoint: { x: 25, y: 0, page: 1 } };
        data[0].geometry.seatMarkers.forEach((seat, i) => { seat.labelSource = 'auto'; seat.label = seat.number = String(3 - i); });
    }
    if (options.unlabelled) data[0].geometry.seatMarkers.forEach(seat => { seat.label = seat.row = seat.number = ''; });
    let current = data[0], changes = 0;
    const window = { tsSeatLayout: layout }, document = { getElementById: id => root.all().find(n => n.id === id), createElement: tag => new Element(tag), addEventListener() {}, removeEventListener() {} };
    vm.runInNewContext(fs.readFileSync('assets/js/venue-seat-tools.js', 'utf8'), { window, document });
    const tools = window.tsVenueSeatTools.mount(board, data, {}, { getSection: () => current, redraw() {}, changed: section => { current = section || data[0]; changes++; } });
    return { data, tools, changes: () => changes, button: name => root.all().find(n => n.tagName === 'button' && n.textContent === name), field: name => root.all().find(n => n.tagName === 'label' && n.textContent === name).children[0], nodes: () => root.all() };
}
test('admin selection, move, delete and undo preserve stable IDs and require renewed review', () => {
    const p = page(); p.tools.selectSeat('Main', 'A1', {}, 'seat1'); p.tools.selectSeat('Main', 'A2', { shiftKey: true }, 'seat2');
    p.tools.mapOptions().onMoveSeats('seat1', 2, 3);
    assert.equal(p.data[0].geometry.seatMarkers[0].x, 17); assert.equal(p.data[0].geometry.seatMarkers[1].x, 22);
    assert.equal(p.data[0].geometry.reviewed, false);
    p.tools.remove(); assert.equal(p.data[0].seats, 1);
    p.button('Undo').click(); assert.equal(p.data[0].geometry.seatMarkers.length, 3);
    assert.equal(p.data[0].geometry.seatMarkers[0].id, 'seat1');
    p.tools.selectSeat('Main', 'A1', {}, 'seat1'); p.tools.mapOptions().onMoveSeats('seat1', -1000, 0);
    assert.equal(p.data[0].geometry.seatMarkers[0].x, 17); assert.match(p.nodes().find(n => n.attributes.role === 'alert').textContent, /inside the image/);
});
test('admin generates curved rows, groups physical sections, and can add and label a missing seat', () => {
    const p = page(); p.field('Section name').value = 'Balcony';
    p.field('Layout').value = 'arc'; p.field('Seats per row').value = '8'; p.field('Rows').value = '2';
    p.field('Origin / centre left (%)').value = '50'; p.field('Origin / centre top (%)').value = '70';
    p.button('Generate seats').click();
    const balcony = p.data.find(s => s.name === 'Balcony'); assert.ok(balcony, p.nodes().find(n => n.attributes.role === 'alert').textContent); assert.equal(balcony.seats, 16);
    assert.equal(new Set(balcony.geometry.seatMarkers.map(s => s.row)).size, 2);
    assert.ok(balcony.geometry.seatMarkers.every(s => s.shape === 'rect' && s.label));
    p.tools.mapOptions().onAddSeat({ x: 50, y: 50 });
    assert.equal(balcony.seats, 17); assert.equal(p.tools.selected.size, 1);
    p.field('Row').value = 'C'; p.field('Seat number').value = '9'; p.button('Save seat').click();
    assert.equal(balcony.geometry.seatMarkers.at(-1).label, 'C9');
    balcony.geometry.reviewed = true; p.data[0].geometry.reviewed = true;
    assert.deepEqual(layout.validate(p.data, true), []);
});


test('opening an unnumbered draft assigns numbers immediately without a manual numbering step', () => {
    const p = page({ unlabelled: true });
    assert.deepEqual(p.data[0].geometry.seatMarkers.map(s => s.number), ['1','2','3']);
    assert.equal(p.data[0].geometry.reviewed, false);
    assert.ok(p.nodes().find(node => node.attributes.role === 'status').textContent.includes('3 seats numbered automatically'));
    assert.equal(p.button('Number seats'), undefined);
});


test('opening a draft with distance-based auto numbers replaces them with row-by-row numbers', () => {
    const p = page({ oldAuto: true });
    assert.deepEqual(p.data[0].geometry.seatMarkers.map(s => s.number), ['1','2','3']);
    assert.equal(p.data[0].geometry.numbering.mode, 'row-by-row');
    assert.equal(p.data[0].geometry.reviewed, false);
});
