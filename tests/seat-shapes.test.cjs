const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const detector = require('../assets/js/seat-shape-detection.js');
let cv;
before(async () => {
    cv = require('../assets/lib/opencv/opencv.js');
    if (!cv.Mat) await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('OpenCV did not initialize')), 15000); cv.onRuntimeInitialized = () => { clearTimeout(timer); resolve(); }; });
});
function image(dark = false) { return { width: 600, height: 400, data: new Uint8ClampedArray(600 * 400 * 4).map((_, i) => i % 4 === 3 || !dark ? 255 : 10) }; }
function rectangle(im, x, y, w, h, color) { for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) im.data.set([...color, 255], (py * im.width + px) * 4); }
function circles(im, touching = false) {
    for (let row = 0; row < 3; row++) for (let seat = 0; seat < 10; seat++) {
        const x = 40 + seat * (touching ? 18 : 50), y = 60 + row * 70;
        for (let py = y - 10; py <= y + 10; py++) for (let px = x - 10; px <= x + 10; px++) if ((px - x) ** 2 + (py - y) ** 2 <= 100) im.data.set([235, 150, 30, 255], (py * im.width + px) * 4);
    }
}

test('real OpenCV detects touching outlined chairs in angled banks with aisles', () => {
    const im = image();
    // Rasterize a plan with shared chair borders, a stage and three seat banks.
    for (const [cx, angle, count] of [[70, 15, 6], [250, 0, 9], [450, -15, 6]]) {
        const a = angle * Math.PI / 180;
        for (let row = 0; row < 4; row++) for (let seat = 0; seat < count; seat++) {
            const sx = cx + seat * 16 * Math.cos(a), sy = 90 + row * 48 + seat * 16 * Math.sin(a);
            for (let py = Math.floor(sy - 15); py <= sy + 15; py++) for (let px = Math.floor(sx - 15); px <= sx + 15; px++) {
                const x = (px - sx) * Math.cos(a) + (py - sy) * Math.sin(a), y = -(px - sx) * Math.sin(a) + (py - sy) * Math.cos(a);
                if (Math.abs(x) <= 8.6 && Math.abs(y) <= 8.6) {
                    const edge = Math.abs(x) >= 7.4 || Math.abs(y) >= 7.4;
                    im.data.set(edge ? [130,130,130,255] : row === 3 ? [215,213,226,255] : [255,255,255,255], (py * im.width + px) * 4);
                }
            }
        }
    }
    rectangle(im, 180, 10, 240, 45, [30,30,30]);
    const result = detector.detect(cv, im);
    assert.equal(result.seats.length, 84);
    assert.ok(result.seats.filter(s => Math.abs(s.angle) > 5).length >= 40);
});
test('real OpenCV detects enclosed seat boxes and removes a large stage', () => {
    const im = image(); rectangle(im, 200, 300, 200, 50, [20,20,20]);
    for (let row = 0; row < 3; row++) for (let seat = 0; seat < 10; seat++) { rectangle(im, 30 + seat * 50, 40 + row * 70, 22, 20, [20,20,20]); rectangle(im, 32 + seat * 50, 42 + row * 70, 18, 16, [255,255,255]); }
    const result = detector.detect(cv, im);
    assert.equal(result.seats.length, 30); assert.ok(result.seats.every(s => s.shape === 'rect'));
});
test('real OpenCV separates touching dots and supports dark image backgrounds', () => {
    for (const dark of [false, true]) {
        const im = image(dark); circles(im, true); const result = detector.detect(cv, im);
        assert.equal(result.seats.length, 30); assert.ok(result.seats.every(s => s.shape === 'circle'));
    }
});
test('empty artwork and invalid seat-size limits never create fabricated seats', () => {
    assert.equal(detector.detect(cv, image()).seats.length, 0);
    assert.throws(() => detector.detect(cv, image(), { minSize: 90, maxSize: 20 }), /maximum at least minimum/);
});


test('real OpenCV retains hundreds of pale seat boxes without a 100-seat cutoff', () => {
    const width = 1800, height = 1200;
    const im = { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) };
    rectangle(im, 600, 30, 600, 120, [70,70,70]);
    for (let row = 0; row < 20; row++) for (let col = 0; col < 30; col++) {
        const x = 140 + col * 48, y = 200 + row * 44;
        rectangle(im, x, y, 16, 14, [230,230,230]); rectangle(im, x + 1, y + 1, 14, 12, [255,255,255]);
    }
    const result = detector.detect(cv, im);
    assert.equal(result.seats.length, 600);
    assert.ok(result.seats.every(seat => seat.y > 150), 'the stage is never a seat');
});

test('isolated stage-letter holes are rejected while the complete chair grid is retained', () => {
    const im = image(); circles(im);
    rectangle(im, 290, 315, 22, 20, [20,20,20]); rectangle(im, 292, 317, 18, 16, [255,255,255]);
    const result = detector.detect(cv, im);
    assert.equal(result.seats.length, 30);
    assert.ok(result.seats.every(seat => seat.y < 300));
});
