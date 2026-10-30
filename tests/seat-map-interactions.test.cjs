const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(mode = 'select', extra = {}) {
    const handlers = {}, attributes = { viewBox: '0 0 104 106' }, captures = [], calls = [];
    const svg = { style: {}, getAttribute: k => attributes[k], setAttribute: (k,v) => { attributes[k] = v; }, addEventListener: (k, fn) => { handlers[k] = fn; },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 1040, height: 1060 }), appendChild() {}, setPointerCapture: id => captures.push(id), releasePointerCapture() {} };
    const window = {}, context = vm.createContext({ window, document: { createElementNS: () => ({ setAttribute() {}, remove() {} }) } });
    vm.runInContext(fs.readFileSync('assets/js/seat-map-interactions.js', 'utf8'), context);
    window.tsSeatMapInteractions.attach(svg, { editTool: mode, ...extra, onMoveSeats: (...args) => calls.push(args), onSelectBox: (...args) => calls.push(args), onViewportChange: view => calls.push(view) }, 1);
    const pointer = (type, x, y, seat = true) => handlers[type]({ button: 0, pointerId: 1, shiftKey: false, clientX: x, clientY: y, target: { closest: selector => seat && selector === '[data-seat-id]' ? { getAttribute: () => 'A1' } : null }, preventDefault() {} });
    return { pointer, captures, calls, handlers };
}
test('seat taps preserve their click target, while drags capture and move in image coordinates', () => {
    const p = setup(); p.pointer('pointerdown', 100, 100); p.pointer('pointerup', 100, 100);
    assert.equal(p.captures.length, 0, 'capturing a simple tap on the SVG would retarget the seat click');
    p.pointer('pointerdown', 100, 100); p.pointer('pointermove', 150, 170); p.pointer('pointerup', 150, 170);
    assert.equal(p.captures.length, 1); assert.equal(p.calls[0][0], 'A1'); assert.ok(Math.abs(p.calls[0][1] - 5) < 1e-8); assert.equal(p.calls[0][2], 7);
    let stopped = false; p.handlers.click({ preventDefault() {}, stopImmediatePropagation() { stopped = true; } }); assert.ok(stopped);
});
test('blank clicks clear the selection and marquee selection normalizes the drag direction', () => {
    const p = setup(); p.pointer('pointerdown', 400, 400, false); p.pointer('pointerup', 400, 400, false);
    assert.equal(p.calls[0][0].width, 0);
    p.pointer('pointerdown', 400, 400, false); p.pointer('pointermove', 100, 200, false); p.pointer('pointerup', 100, 200, false);
    assert.deepEqual(JSON.parse(JSON.stringify(p.calls[1])), [{ x: 10, y: 20, width: 30, height: 20 }, false, 1]);
});

test('organizer seat taps retain the current selection; dragging across seats selects a box without moving chairs', () => {
    const p = setup('select', { selectionOnly: true });
    p.pointer('pointerdown', 100, 100); p.pointer('pointerup', 100, 100);
    assert.equal(p.calls.length, 0, 'a seat tap must reach its toggle callback without clearing other selected seats');
    p.pointer('pointerdown', 100, 100); p.pointer('pointermove', 300, 400); p.pointer('pointerup', 300, 400);
    const [box, append, page] = p.calls[0];
    assert.equal(box.x, 10); assert.equal(box.y, 10);
    assert.ok(Math.abs(box.width - 20) < 1e-8); assert.equal(box.height, 30);
    assert.equal(append, false); assert.equal(page, 1);
});
