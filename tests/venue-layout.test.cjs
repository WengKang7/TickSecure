const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

class Element {
    constructor(tag = 'div') {
        this.tagName = tag; this.children = []; this.attributes = {}; this.listeners = {};
        this.style = {}; this.dataset = {}; this.className = ''; this.value = '';
    }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
    appendChild(node) { this.children.push(node); node.parentElement = this; return node; }
    prepend(node) { this.children.unshift(node); node.parentElement = this; }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    setAttribute(key, value) { this.attributes[key] = String(value); if (key === 'class') this.className = String(value); }
    getAttribute(key) { return this.attributes[key]; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    click() { if (this.listeners.click) this.listeners.click(); else this.onclick?.(); }
    get nextElementSibling() { return this.parentElement.children[this.parentElement.children.indexOf(this) + 1]; }
    get selectedOptions() { return this.children.filter(c => c.value === this.value); }
    get classList() { return { toggle: (name, enabled) => { const names = new Set(this.className.split(' ')); enabled ? names.add(name) : names.delete(name); this.className = [...names].join(' '); } }; }
    querySelectorAll(selector) {
        return this.children.flatMap(child => [
            ...(selector === child.tagName || selector === '.' + child.className || (selector === '[data-section-id]' && child.attributes['data-section-id']) ? [child] : []),
            ...child.querySelectorAll(selector)
        ]);
    }
}
function runtime(step = 3) {
    const body = new Element();
    const add = id => { const node = new Element(); node.id = id; body.appendChild(node); return node; };
    const board = add(step === 3 ? 'dynamic-blueprint-boxes' : 'dynamic-generated-board');
    const side = add('side');
    if (step === 3) { const panel = new Element(); panel.id = 'dynamic-editor-cards'; side.appendChild(panel); add('add-layout-section'); add('dynamic-sections-sub'); }
    const all = () => [body, ...body.querySelectorAll('div'), ...body.querySelectorAll('input'), ...body.querySelectorAll('select')];
    const document = { getElementById: id => all().find(n => n.id === id), createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag) };
    const context = vm.createContext({ window: {}, document });
    ['venue-renderer.js', 'venue-layout-editor.js'].forEach(file => vm.runInContext(source('assets/js/' + file), context));
    const data = [
        { letter: 'Standing_Floor', name: 'Standing floor', seats: 0, geometry: { kind: 'standing' } },
        { letter: '124', name: 'Section 124', seats: 0, geometry: { kind: 'seated' } },
        { letter: '123', name: 'Section 123', seats: 0, geometry: { kind: 'seated' } }
    ];
    data.forEach((section, index) => Object.assign(section.geometry, { type: 'polygon', layout: 'ocr', page: 1, confidence: 90, reviewed: false,
        fill: '#a8d990', labelX: 20 + index * 25, labelY: 40,
        points: [{ x: 10 + index * 25, y: 30 }, { x: 30 + index * 25, y: 30 }, { x: 30 + index * 25, y: 50 }, { x: 10 + index * 25, y: 50 }] }));
    return { body, board, side, document, context, data,
        render: () => context.window.tsVenueLayoutEditor(data, 'Test venue') };
}
test('admin layout uses uploaded-file OCR without hard-coded reference choices or generated sample data', () => {
    const page = source('admin/venue-layout.php');
    assert.match(page, /tsBlueprintOCR\.scan\(file/);
    assert.doesNotMatch(page, /venue-layout-templates|apply-reference-layout|function generateSectionData|function countSectionsInPDF/);
});
test('clicking or keyboard-selecting a polygon selects the matching editor, safely renders names, and previews clickable seat IDs', () => {
    const p = runtime(); p.data[1].seats = 120; p.data[1].name = '<img src=x onerror=alert(1)>';
    p.render();
    let section = p.board.querySelectorAll('[data-section-id]')[1];
    let prevented = false;
    section.listeners.keydown({ key: 'Enter', preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(p.document.getElementById('edit-section-name').value, '<img src=x onerror=alert(1)>');
    const buttons = p.side.querySelectorAll('.ts-seat-choice');
    assert.equal(buttons.length, 100);
    assert.equal(buttons[0].attributes['aria-label'], 'Seat 12401');
    buttons[0].listeners.click();
    assert.equal(buttons[0].attributes['aria-pressed'], 'true');
    const next = p.side.querySelectorAll('button').find(b => b.textContent === 'Next');
    next.onclick();
    assert.equal(p.side.querySelectorAll('.ts-seat-choice').length, 20);
    assert.equal(p.side.querySelectorAll('.ts-seat-choice')[0].attributes['aria-label'], 'Seat 124101');
    const count = p.document.getElementById('edit-section-seats'); count.value = '12'; count.oninput();
    assert.equal(p.data[1].seats, 12);
    assert.equal(p.side.querySelectorAll('.ts-seat-choice').length, 12);
    assert.equal(p.board.querySelectorAll('img').length, 0);
});
test('standing capacity previews use places and selection still works on later workflow steps', () => {
    const p = runtime(4); p.data[0].seats = 3; p.render();
    assert.equal(p.body.children.length, 2, 'inspector remains inside the existing right-hand column');
    assert.equal(p.side.querySelectorAll('.ts-seat-choice')[0].attributes['aria-label'], 'Place Standing_Floor01');
    p.board.querySelectorAll('[data-section-id]')[2].listeners.click();
    assert.equal(p.document.getElementById('layout-section-select').value, '123');
});

test('OCR map seat markers are clickable, use the original aspect ratio and offer seat-label correction', () => {
    const p = runtime();
    p.data[1].seats = 2;
    Object.assign(p.data[1].geometry, { imageWidth: 1000, imageHeight: 400, seatMarkers: [{ label: 'A4', x: 40, y: 40 }, { label: 'A8', x: 45, y: 40 }] });
    p.render();
    p.board.querySelectorAll('[data-section-id]')[1].listeners.click();
    assert.equal(p.board.querySelectorAll('svg')[0].style.aspectRatio, '1000 / 400');
    assert.equal(p.board.querySelectorAll('svg')[0].style.height, 'auto');
    p.board.querySelectorAll('.ts-ocr-seat')[0].listeners.click();
    assert.equal(p.document.getElementById('edit-section-seats').readOnly, true);
    const edit = p.side.querySelectorAll('input').find(node => node.attributes['aria-label'] === 'Correct selected OCR seat label');
    assert.equal(edit.value, 'A4'); assert.equal(edit.hidden, false);
    edit.value = 'A5'; edit.onchange();
    assert.equal(p.data[1].geometry.seatMarkers[0].label, 'A5');
    assert.equal(p.data[1].geometry.reviewed, false);
});

test('image review displays one original image with clickable transparent frames and no duplicate artwork or labels', () => {
    const p = runtime();
    p.data[1].seats = 1;
    p.data[1].geometry.seatMarkers = [{ label: 'A4', x: 40, y: 40 }];
    p.data[0].geometry.decorations = [{ name: 'STAGE', points: [{ x: 10, y: 5 }, { x: 20, y: 5 }, { x: 20, y: 10 }] }];
    p.context.window.tsVenueLayoutEditor(p.data, 'Test venue', { backgroundUrl: 'blob:original-layout', imageWidth: 1000, imageHeight: 400 });
    for (let i = 0; i < 2; i++) {
        assert.equal(p.board.querySelectorAll('image').length, 1);
        assert.equal(p.board.querySelectorAll('text').length, 0, 'original labels are not drawn again');
        assert.equal(p.board.querySelectorAll('polygon').length, 3, 'original stage artwork is not redrawn');
        p.board.querySelectorAll('polygon').forEach(frame => assert.equal(frame.attributes.fill, 'transparent'));
        assert.equal(p.board.querySelectorAll('circle').length, 0, 'original seats are not covered by filled replacement seats');
        assert.equal(p.board.querySelectorAll('rect')[0].attributes.fill, 'transparent');
        p.board.querySelectorAll('[data-section-id]')[1].listeners.click();
    }
    p.board.querySelectorAll('.ts-ocr-seat')[0].listeners.click();
    assert.equal(p.board.querySelectorAll('.ts-ocr-seat')[0].attributes['aria-pressed'], 'true');
    assert.equal(p.document.getElementById('edit-section-name').value, 'Section 124');
});
test('draft payloads retain polygon geometry across reload and do not insert optional undefined geometry for legacy sections', () => {
    const page = source('admin/venue-layout.php');
    const fn = page.match(/function sectionPayload\(data\) \{[\s\S]*?\n    \}/)[0];
    const { data } = runtime();
    const payload = vm.runInNewContext(fn + '; sectionPayload(data)', { data });
    const reloaded = JSON.parse(JSON.stringify(payload));
    assert.deepEqual(reloaded[0].geometry, JSON.parse(JSON.stringify(data[0].geometry)));
    const legacy = vm.runInNewContext(fn + '; sectionPayload(data)', { data: [{ letter: 'A', name: 'Section A', seats: 10 }] });
    assert.equal(Object.hasOwn(legacy[0], 'geometry'), false);
});
test('incomplete capacities can be saved as drafts but activation rejects them before any writes', async () => {
    const writes = [];
    const crud = source('assets/js/firestore-crud.js');
    const service = crud.slice(crud.indexOf('export const VenueService ='), crud.indexOf('export const EventService =')).replace('export const VenueService =', 'globalThis.venueService =');
    const context = vm.createContext({ updateDoc: async (...args) => writes.push(args), doc: () => 'venue-ref', db: {}, iso: () => 'now', AuditService: { log: async () => {} } });
    vm.runInContext(service, context);
    context.venueService.getVenue = async () => ({ layoutStatus: 'DRAFT', sections: [{ sectionId: 'A', name: 'A', seatCount: 0 }] });
    await context.venueService.updateSections('venue', [{ sectionId: 'A', name: 'A', seatCount: 0 }]);
    assert.equal(writes.length, 1);
    writes.length = 0;
    await assert.rejects(context.venueService.activateLayout('venue'), /verified positive/);
    assert.equal(writes.length, 0);
});


test('automatically generated numbers are visible over an unnumbered source image', () => {
    const p = runtime();
    p.data[0].seats = 1;
    p.data[0].geometry.seatMarkers = [{ id: 'auto-seat', x: 15, y: 35, label: '1', number: '1', row: 'A', labelSource: 'auto' }];
    p.context.window.tsVenueLayoutEditor(p.data, 'Test venue', { backgroundUrl: 'blob:source-image' });
    assert.ok(p.board.querySelectorAll('text').some(node => node.textContent === '1'));
    assert.equal(p.board.querySelectorAll('image').length, 1);
});


test('final preview sorts all 165 seats numerically and map selection opens the matching sorted page', () => {
    const p = runtime(5), section = p.data[1]; section.seats = 165;
    section.geometry.seatMarkers = Array.from({ length: 165 }, (_, i) => {
        const number = String((i * 73) % 165 + 1);
        return { id: 'marker' + number, label: number, number, x: 10 + i % 10, y: 30 + Math.floor(i / 10) };
    });
    const original = JSON.parse(JSON.stringify(section.geometry.seatMarkers));
    p.render(); p.board.querySelectorAll('[data-section-id]')[1].listeners.click();
    assert.deepEqual(p.body.querySelectorAll('.ts-seat-choice').map(button => button.textContent), Array.from({ length: 100 }, (_, i) => String(i + 1)));
    p.body.querySelectorAll('button').find(button => button.textContent === 'Next').click();
    assert.deepEqual(p.body.querySelectorAll('.ts-seat-choice').map(button => button.textContent), Array.from({ length: 65 }, (_, i) => String(i + 101)));
    p.board.querySelectorAll('g').find(node => node.attributes['data-seat-id'] === 'marker150').click();
    const selected = p.body.querySelectorAll('.ts-seat-choice').find(button => button.attributes['aria-pressed'] === 'true');
    assert.equal(selected.textContent, '150');
    assert.equal(selected.attributes['aria-label'], 'Seat 124-150');
    assert.equal(p.board.querySelectorAll('g').find(node => node.attributes['data-seat-id'] === 'marker150').attributes['aria-pressed'], 'true');
    assert.deepEqual(section.geometry.seatMarkers, original, 'sorting the preview must not change seat records or floor-plan coordinates');
});

test('OCR identifiers use natural row/seat order and retain the correct clicked marker', () => {
    const p = runtime(), section = p.data[1]; section.seats = 4;
    section.geometry.seatMarkers = ['B1','A10','A2','A1'].map((label, i) => ({ id: label, label, x: 40 + i, y: 40 }));
    p.render(); p.board.querySelectorAll('[data-section-id]')[1].click();
    assert.deepEqual(p.side.querySelectorAll('.ts-seat-choice').map(button => button.textContent), ['A1','A2','A10','B1']);
    p.side.querySelectorAll('.ts-seat-choice')[1].click();
    assert.equal(p.board.querySelectorAll('g').find(node => node.attributes['data-seat-id'] === 'A2').attributes['aria-pressed'], 'true');
    assert.equal(p.side.querySelectorAll('input').find(node => node.attributes['aria-label'] === 'Correct selected OCR seat label').value, 'A2');
});


test('clean admin/organizer maps draw equal-sized seat boxes and one rectangular stage without changing physical geometry', () => {
    const p = runtime(), section = p.data[1]; section.seats = 3;
    Object.assign(section.geometry, { imageWidth: 1000, imageHeight: 400, seatMarkers: [
        { id: 'small', label: '1', number: '1', x: 35, y: 40, width: 1, height: 2, shape: 'circle', rotation: 10 },
        { id: 'large', label: '2', number: '2', x: 45, y: 40, width: 4, height: 6, shape: 'rect', rotation: 30 },
        { id: 'medium', label: '3', number: '3', x: 55, y: 40, width: 2, height: 3, shape: 'rect', rotation: -15 }
    ] });
    p.data[0].geometry.decorations = [{ name: 'STAGE', points: [{ x: 40, y: 8 }, { x: 50, y: 5 }, { x: 60, y: 10 }] }];
    const original = JSON.parse(JSON.stringify(p.data));
    p.context.window.tsVenueLayoutEditor(p.data, 'Test hall', { cleanLayout: true, backgroundUrl: 'blob:original-layout' });
    const frames = p.board.querySelectorAll('.ts-seat-frame');
    assert.equal(frames.length, 3);
    assert.ok(frames.every(frame => frame.tagName === 'rect'));
    assert.equal(new Set(frames.map(frame => frame.attributes.width)).size, 1);
    assert.equal(new Set(frames.map(frame => frame.attributes.height)).size, 1);
    assert.equal(p.board.querySelectorAll('.ts-map-stage').length, 1);
    assert.equal(p.board.querySelectorAll('.ts-map-stage')[0].tagName, 'rect');
    assert.ok(Number(p.board.querySelectorAll('.ts-map-stage')[0].attributes.width) > Number(p.board.querySelectorAll('.ts-map-stage')[0].attributes.height));
    assert.equal(p.board.querySelectorAll('image').length, 0, 'the source artwork cannot overlap the clean seat symbols');
    p.board.querySelectorAll('g').find(node => node.attributes['data-seat-id'] === 'large').click();
    assert.equal(p.board.querySelectorAll('g').find(node => node.attributes['data-seat-id'] === 'large').attributes['aria-pressed'], 'true');
    assert.deepEqual(p.data, original, 'rendering must leave source measurements, positions, labels and seat counts unchanged');
});

test('clean legacy layouts also use a rectangular stage instead of a T-shaped stage', () => {
    const p = runtime(5);
    p.data.forEach(section => { section.geometry.layout = 'legacy'; });
    p.context.window.tsVenueLayoutEditor(p.data, 'Test hall', { cleanLayout: true });
    assert.equal(p.board.querySelectorAll('.ts-map-stage').length, 1);
    assert.equal(p.board.querySelectorAll('path').length, 0);
    assert.ok(p.board.querySelectorAll('text').some(node => node.textContent === 'STAGE'));
});
