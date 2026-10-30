const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const detection = require('../assets/js/blueprint-detection.js');
const root = path.resolve(__dirname, '..');
function image(width = 200, height = 120, background = [255, 255, 255]) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let p = 0; p < data.length; p += 4) data.set([...background, 255], p);
    return { width, height, data };
}
function rect(im, x, y, w, h, color) {
    for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) im.data.set([...color, 255], (py * im.width + px) * 4);
}
const word = (text, x0, y0, x1, y1, line = text) => ({ text, x0, y0, x1, y1, line, confidence: 90 });

test('TSV parsing preserves OCR bounding boxes and rejects invalid rows', () => {
    const result = detection.parseTsv('level\tpage\tblock\tpara\tline\tword\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t10\t20\t30\t12\t92\t105\n5\t1\t1\t1\t1\t1\tx\t20\t30\t12\t92\tbad');
    assert.equal(result.length, 1);
    assert.deepEqual([result[0].text, result[0].x0, result[0].y0, result[0].x1, result[0].y1], ['105', 10, 20, 40, 32]);
});
test('recognized labels become independent polygons in the actual image coordinates without invented capacities', () => {
    const im = image(); rect(im, 10, 20, 45, 55, [240, 180, 40]); rect(im, 130, 20, 45, 55, [60, 170, 220]);
    const result = detection.detect(im, [word('105', 20, 35, 42, 47), word('BALCONY', 134, 35, 171, 47), word('RM950', 10, 100, 50, 110)]);
    assert.equal(result.sections.length, 2);
    assert.deepEqual(result.sections.map(s => s.name), ['105', 'BALCONY']);
    assert.ok(result.sections.every(s => s.seatCount === 0 && s.geometry.layout === 'ocr' && !s.geometry.reviewed));
    assert.ok(Math.max(...result.sections[0].geometry.points.map(p => p.x)) < Math.min(...result.sections[1].geometry.points.map(p => p.x)));
    assert.equal(result.sections[0].geometry.boundarySource, 'color-region');
});
test('several labels within a touching color area get separate clickable boundaries', () => {
    const im = image(); rect(im, 10, 20, 100, 55, [240, 180, 40]);
    const result = detection.detect(im, [word('101', 20, 35, 40, 47), word('102', 70, 35, 90, 47)]);
    assert.equal(result.sections.length, 2);
    assert.ok(Math.max(...result.sections[0].geometry.points.map(p => p.x)) <= Math.min(...result.sections[1].geometry.points.map(p => p.x)));
});
test('explicit seat labels retain their identifiers, count and image positions instead of becoming arbitrary generated rows', () => {
    const im = image();
    const result = detection.detect(im, [word('A1', 20, 30, 30, 40), word('A2', 50, 30, 60, 40), word('B1', 20, 70, 30, 80), word('B2', 50, 70, 60, 80)]);
    assert.deepEqual(result.sections.map(s => [s.name, s.seatCount]), [['ROW A', 2], ['ROW B', 2]]);
    assert.deepEqual(result.sections[0].geometry.seatMarkers.map(m => m.label), ['A1', 'A2']);
    assert.ok(result.sections[0].geometry.seatMarkers[0].x < result.sections[0].geometry.seatMarkers[1].x);
});
test('empty artwork and dark price legends produce no fake sections or sample seats', () => {
    const im = image(200, 120, [15, 20, 25]);
    assert.equal(detection.detect(im, []).sections.length, 0);
    assert.equal(detection.detect(im, [word('ZONE', 10, 90, 30, 100, 'legend'), word('A', 35, 90, 40, 100, 'legend'), word('RM950', 10, 105, 40, 115)]).sections.length, 0);
});
test('multi-page detections retain page indices and stage geometry comes from OCR', () => {
    const im = image(); rect(im, 10, 20, 45, 45, [200, 150, 40]); rect(im, 100, 10, 40, 15, [170, 170, 170]);
    const result = detection.detect(im, [word('ZONEA', 15, 30, 45, 40), word('STAGE', 105, 12, 135, 22)], 3);
    assert.equal(result.sections[0].name, 'ZONE A');
    assert.equal(result.sections[0].geometry.page, 3);
    assert.equal(result.sections[0].geometry.decorations[0].name, 'STAGE');
});

function service(venue) {
    const writes = [], seats = [];
    const crud = fs.readFileSync(path.join(root, 'assets/js/firestore-crud.js'), 'utf8');
    const source = crud.slice(crud.indexOf('export const VenueService ='), crud.indexOf('export const EventService =')).replace('export const VenueService =', 'globalThis.service =');
    const context = vm.createContext({ updateDoc: async (...args) => writes.push(args), doc: (_, collection, id) => ({ collection, id }), db: {}, iso: () => 'now',
        AuditService: { log: async () => {} }, writeBatch: () => ({ set: (ref, data) => seats.push({ ref, data }), commit: async () => {} }) });
    vm.runInContext(source, context); context.service.getVenue = async () => venue;
    return { api: context.service, writes, seats };
}
test('activation blocks unreviewed OCR and inconsistent seat counts before creating physical records', async () => {
    const venue = { layoutStatus: 'DRAFT', sections: [{ sectionId: 'ROW_A', seatCount: 2, geometry: { layout: 'ocr', reviewed: false, seatMarkers: [{ label: 'A1' }, { label: 'A2' }] } }] };
    const s = service(venue);
    await assert.rejects(s.api.activateLayout('v'), /Review every OCR section/);
    assert.equal(s.writes.length, 0);
    venue.sections[0].geometry.reviewed = true; venue.sections[0].seatCount = 3;
    await assert.rejects(s.api.activateLayout('v'), /match the confirmed seat count/);
    assert.equal(s.seats.length, 0);
});
test('reviewed OCR seats generate the recognized labels and coordinates in physical inventory', async () => {
    const s = service({ layoutStatus: 'DRAFT', sections: [{ sectionId: 'ROW_A', seatCount: 2,
        geometry: { layout: 'ocr', reviewed: true, page: 2, seatMarkers: [{ label: 'A3', x: 10, y: 20 }, { label: 'A7', x: 20, y: 20 }] } }] });
    await s.api.activateLayout('v');
    assert.deepEqual(s.seats.map(s => s.data.seatLabel), ['ROW_A-A3', 'ROW_A-A7']);
    assert.equal(s.seats[0].data.position.page, 2);
});
test('a stale OCR result cannot replace a newer blueprint and results persist atomically', async () => {
    const venue = { layoutStatus: 'DRAFT', blueprintName: 'current.png', blueprintSize: 100 };
    const s = service(venue);
    await assert.rejects(s.api.saveBlueprintAnalysis('v', { sections: [{}], analysis: { sourceName: 'old.png', sourceSize: 100 } }), /changed during OCR/);
    assert.equal(s.writes.length, 0);
    await s.api.saveBlueprintAnalysis('v', { sections: [{ sectionId: 'A' }], analysis: { sourceName: 'current.png', sourceSize: 100 } });
    assert.equal(s.writes.length, 1);
    assert.equal(s.writes[0][1].sections[0].sectionId, 'A');
    venue.blueprintHash = 'current-content-hash';
    await assert.rejects(s.api.saveBlueprintAnalysis('v', { sections: [{}], analysis: { sourceName: 'current.png', sourceSize: 100, sourceHash: 'different-content-hash' } }), /changed during OCR/);
});

test('PDF scanning processes every page, selects local OCR assets and always terminates its worker', async () => {
    const pages = [], options = []; let terminated = 0, destroyed = 0;
    const makeCanvas = () => ({ width: 0, height: 0, getContext() { return { drawImage() {}, getImageData: () => image(this.width || 200, this.height || 100) }; } });
    const window = {
        tsBlueprintDetection: { ...detection, regions: () => ({ items: [] }), parseTsv: () => [], detect: (_, words, page) => ({
            sections: [{ sectionId: 'A', name: 'A', seatCount: 0, geometry: { layout: 'ocr', page } }]
        }) },
        pdfjsLib: { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: 2, getPage: async number => {
            pages.push(number); return { getViewport: ({ scale }) => ({ width: 200 * scale, height: 100 * scale }), render: () => ({ promise: Promise.resolve() }) };
        }, destroy: async () => { destroyed++; } }) }) },
        Tesseract: { createWorker: async (_, mode, config) => { options.push(config); return {
            setParameters: async () => {}, recognize: async () => ({ data: { tsv: '' } }), terminate: async () => { terminated++; }
        }; } }
    };
    const context = vm.createContext({ window, document: { currentScript: { src: 'http://localhost/ticksecure-ui/assets/js/blueprint-ocr.js' }, createElement: makeCanvas },
        URL, setTimeout, clearTimeout, crypto: require('node:crypto').webcrypto });
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/blueprint-ocr.js'), 'utf8'), context);
    const result = await window.tsBlueprintOCR.scan(new File(['%PDF-1.4'], 'two-floors.pdf', { type: 'application/pdf' }));
    assert.deepEqual(pages, [1, 2]);
    assert.deepEqual(Array.from(result.sections, s => s.sectionId), ['P1_A', 'P2_A']);
    assert.match(options[0].workerPath, /^http:\/\/localhost\/ticksecure-ui\/assets\/lib\/tesseract\/worker.min.js$/);
    assert.equal(terminated, 1); assert.equal(destroyed, 1);
    assert.match(result.analysis.sourceHash, /^[a-f0-9]{64}$/);
});

test('blank OCR fails explicitly and never substitutes a sample section count', async () => {
    let terminated = 0;
    const window = {
        tsBlueprintDetection: { ...detection, regions: () => ({ items: [] }), parseTsv: () => [], detect: () => ({ sections: [] }) },
        pdfjsLib: { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: 1,
            getPage: async () => ({ getViewport: () => ({ width: 200, height: 100 }), render: () => ({ promise: Promise.resolve() }) }), destroy: async () => {} }) }) },
        Tesseract: { createWorker: async () => ({ setParameters: async () => {}, recognize: async () => ({ data: {} }), terminate: async () => { terminated++; } }) }
    };
    const context = vm.createContext({ window, document: { currentScript: { src: 'http://localhost/assets/js/blueprint-ocr.js' },
        createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => image() }) }) }, URL, setTimeout, clearTimeout });
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/blueprint-ocr.js'), 'utf8'), context);
    await assert.rejects(window.tsBlueprintOCR.scan(new File(['%PDF-1.4'], 'blank.pdf', { type: 'application/pdf' })), /could not identify any section or seat labels/);
    assert.equal(terminated, 1);
});


test('PNG scanning preserves detail above 1100 pixels and sends the full bounded image to seat detection', async () => {
    const scanned = [], width = 2000, height = 1200, header = new Uint8Array(24);
    const view = new DataView(header.buffer); view.setUint32(0, 0x89504e47); view.setUint32(16, width); view.setUint32(20, height);
    const document = { currentScript: { src: 'http://localhost/assets/js/blueprint-ocr.js' }, createElement: () => {
        const canvas = { width: 0, height: 0 };
        canvas.getContext = () => ({ fillRect() {}, drawImage() {}, getImageData: () => ({ width: canvas.width, height: canvas.height, data: new Uint8ClampedArray() }) });
        return canvas;
    } };
    const window = {
        tsSeatShapes: { detect: async pixels => { scanned.push([pixels.width,pixels.height]); return { seats: [] }; } },
        tsBlueprintDetection: { regions: () => ({ items: [] }), parseTsv: () => [], detect: () => ({ sections: [{ sectionId: 'A', name: 'A', seatCount: 0, geometry: { layout: 'ocr', page: 1 } }] }) },
        Tesseract: { createWorker: async () => ({ setParameters: async () => {}, recognize: async () => ({ data: {} }), terminate: async () => {} }) }
    };
    const context = vm.createContext({ window, document, URL, DataView, setTimeout, clearTimeout,
        crypto: require('node:crypto').webcrypto, createImageBitmap: async () => ({ width, height, close() {} }) });
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/blueprint-ocr.js'), 'utf8'), context);
    const result = await window.tsBlueprintOCR.scan(new File([header], 'detailed-plan.png', { type: 'image/png' }));
    assert.deepEqual(scanned, [[2000,1200]]);
    assert.equal(result.analysis.pages[0].width, 2000); assert.equal(result.analysis.pages[0].height, 1200);
});
