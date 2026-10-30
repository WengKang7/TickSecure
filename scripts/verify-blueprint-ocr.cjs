// Optional real-engine integration check. No accounts or cloud writes are used.
// npm install --prefix tmp/ocr-runtime --no-save tesseract.js@6.0.1 @napi-rs/canvas@0.1.80
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const runtime = require('node:module').createRequire(path.join(root, 'tmp/ocr-runtime/package.json'));
const { createWorker } = runtime('tesseract.js');
const { createCanvas, loadImage, ImageData } = runtime('@napi-rs/canvas');
const detection = require('../assets/js/blueprint-detection.js');
const shapes = require('../assets/js/seat-shape-detection.js');
const seatImport = require('../assets/js/seat-import.js');
const layout = require('../assets/js/seat-layout-model.js');

async function main() {
    const cv = require('../assets/lib/opencv/opencv.js');
    if (!cv.Mat) await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('OpenCV initialization failed')), 15000); cv.onRuntimeInitialized = () => { clearTimeout(timer); resolve(); }; });
    const window = {
        tsBlueprintDetection: detection,
        tsSeatLayout: layout,
        tsSeatImport: seatImport,
        tsSeatShapes: { detect: async (image, options) => shapes.detect(cv, image, options) },
        Tesseract: { createWorker: async (language, mode, options) => {
            const worker = await createWorker(language, mode, { langPath: path.join(root, 'assets/lib/tesseract/lang'), cacheMethod: 'none', logger: options.logger });
            return { setParameters: params => worker.setParameters(params), terminate: () => worker.terminate(),
                recognize: (canvas, opts, output) => worker.recognize(canvas.toBuffer('image/png'), opts, output) };
        } }
    };
    const context = vm.createContext({ window, document: {
        currentScript: { src: 'http://localhost/ticksecure-ui/assets/js/blueprint-ocr.js' }, createElement: () => createCanvas(1, 1)
    }, URL, DataView, ImageData, crypto: require('node:crypto').webcrypto, setTimeout, clearTimeout, createImageBitmap: async blob => {
        const image = await loadImage(Buffer.from(await blob.arrayBuffer())); image.close = () => {}; return image;
    } });
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/blueprint-ocr.js'), 'utf8'), context);
    const canvas = createCanvas(1200, 700), ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1200, 700);
    [['BLOCK K', '#fedc78', 40], ['BLOCK M', '#8dd7e8', 430], ['BLOCK R', '#a8d990', 820]].forEach(([name, color, x]) => {
        ctx.fillStyle = color; ctx.fillRect(x, 170, 330, 210);
        ctx.fillStyle = '#000000'; ctx.font = 'bold 42px Arial'; ctx.fillText(name, x + 55, 280);
    });
    const result = await window.tsBlueprintOCR.scan(new File([canvas.toBuffer('image/png')], 'unrelated-test-plan.png', { type: 'image/png' }));
    const names = result.sections.map(section => section.name);
    for (const label of ['BLOCK K', 'BLOCK M', 'BLOCK R']) assert.ok(names.includes(label), `OCR must read ${label}; got ${names.join(', ')}`);
    assert.ok(result.sections.every(section => section.geometry.layout === 'ocr' && section.geometry.reviewed === false));
    assert.ok(result.sections.every(section => section.seatCount === 0), 'section-only plans do not invent capacities');
    console.log('PASS: real Tesseract -> uploaded PNG decoding -> region detection -> recognized labels -> clickable polygon data.');
    const seats = createCanvas(760, 500), seatContext = seats.getContext('2d');
    seatContext.fillStyle = '#ffffff'; seatContext.fillRect(0, 0, 760, 500);
    for (const [row, y] of [['A', 140], ['B', 340]]) for (let i = 1; i <= 3; i++) {
        const x = i * 190;
        seatContext.beginPath(); seatContext.arc(x, y, 60, 0, 2 * Math.PI); seatContext.fillStyle = '#a6d5b7'; seatContext.fill();
        seatContext.fillStyle = '#000000'; seatContext.font = 'bold 36px Arial'; seatContext.textAlign = 'center'; seatContext.fillText(row + i, x, y + 12);
    }
    const detectedSeats = await window.tsBlueprintOCR.scan(new File([seats.toBuffer('image/png')], 'labelled-seats.png', { type: 'image/png' }));
    assert.equal(layout.entries(detectedSeats.sections).length, 6);
    assert.deepEqual(Array.from(layout.entries(detectedSeats.sections), item => Number(item.marker.number)).sort((a,b) => a-b), [1,2,3,4,5,6]);
    console.log('PASS: real OCR preserves six detected seat positions and numbers them automatically from front to back.');
    const dots = createCanvas(900, 600), dotContext = dots.getContext('2d');
    dotContext.fillStyle = '#ffffff'; dotContext.fillRect(0, 0, 900, 600);
    for (let row = 0; row < 5; row++) for (let i = 0; i < 10; i++) {
        dotContext.fillStyle = '#db8628'; dotContext.beginPath(); dotContext.arc(100 + i * 65, 100 + row * 70, 9, 0, Math.PI * 2); dotContext.fill();
    }
    const dotResult = await window.tsBlueprintOCR.scan(new File([dots.toBuffer('image/png')], 'unlabelled-dots.png', { type: 'image/png' }));
    assert.equal(dotResult.analysis.pages[0].mode, 'seats');
    assert.equal(dotResult.sections[0].seatCount, 50);
    assert.deepEqual(dotResult.sections[0].geometry.seatMarkers.map(seat => Number(seat.number)).sort((a,b) => a-b), Array.from({ length: 50 }, (_, i) => i + 1));
    assert.ok(dotResult.sections[0].geometry.seatMarkers.every(seat => seat.row && seat.labelSource === 'auto'));
    const grouped = layout.regroup(dotResult.sections, layout.entries(dotResult.sections).map(s => s.id), 'Main', { mode: 'straight', rowStyle: 'letters', numbering: 'ltr', start: 1, step: 1 });
    grouped.geometry.reviewed = true;
    assert.equal(grouped.geometry.seatMarkers[0].label, 'A1'); assert.equal(grouped.geometry.seatMarkers.at(-1).label, 'E10');
    assert.deepEqual(layout.validate(dotResult.sections, true), []);
    console.log('PASS: real OpenCV + OCR pipeline detects 50 unlabelled seats; grouping produces reviewed, uniquely numbered row records.');
    for (const input of process.argv.slice(2)) {
        const result = await window.tsBlueprintOCR.scan(new File([fs.readFileSync(input)], path.basename(input), { type: 'image/png' }));
        console.log(`${path.basename(input)}: ${layout.entries(result.sections).length} candidate seats in ${result.sections.length} sections; all require admin review.`);
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
