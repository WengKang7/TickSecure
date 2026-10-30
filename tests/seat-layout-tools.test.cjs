const { test } = require('node:test');
const assert = require('node:assert/strict');
const model = require('../assets/js/seat-layout-model.js');
const importer = require('../assets/js/seat-import.js');
const marker = (x, y, id) => ({ id, x, y, width: 2, height: 2, label: '', row: '', number: '' });

test('numbering a tilted seat bank preserves its positions and follows its measured row angle', () => {
    for (const degrees of [-15, 15]) {
        const a = degrees * Math.PI / 180;
        const seats = Array.from({ length: 18 }, (_, i) => {
            const x = (i % 6) * 18, y = Math.floor(i / 6) * 32;
            return { ...marker((100 + x * Math.cos(a) - y * Math.sin(a)) / 632 * 104,
                (280 + x * Math.sin(a) + y * Math.cos(a)) / 710 * 106, 's' + i), rotation: degrees, width: 18 / 632 * 104, height: 18 / 710 * 106 };
        });
        const grouped = model.groupRows(seats, { mode: 'straight', rowStyle: 'letters' }, 632, 710);
        assert.deepEqual(grouped.map(s => s.label), ['A1','A2','A3','A4','A5','A6','B1','B2','B3','B4','B5','B6','C1','C2','C3','C4','C5','C6']);
        grouped.forEach(seat => {
            const original = seats.find(s => s.id === seat.id);
            assert.equal(seat.x, original.x); assert.equal(seat.y, original.y); assert.equal(seat.rotation, degrees);
        });
    }
});
test('straight grouping preserves gaps and supports right-to-left, odd/even and reversed row labels', () => {
    const seats = [marker(10, 10, 'a'), marker(20, 10, 'b'), marker(40, 10, 'c'), marker(10, 20, 'd'), marker(20, 20, 'e'), marker(40, 20, 'f')];
    const grouped = model.groupRows(seats, { mode: 'straight', rowStyle: 'letters', firstRow: 1, numbering: 'ltr' });
    assert.deepEqual(grouped.map(s => s.label), ['A1', 'A2', 'A4', 'B1', 'B2', 'B4']);
    const reversed = model.groupRows(seats, { mode: 'straight', rowStyle: 'numbers', firstRow: 5, reverse: true, numbering: 'rtl', start: 17, step: 2 });
    assert.equal(reversed[0].row, '5'); assert.equal(reversed[0].y, 20); assert.equal(reversed[2].number, '17');
    const center = model.groupRows([marker(10, 20, 'a'), marker(20, 20, 'b'), marker(30, 20, 'c'), marker(40, 20, 'd')], { numbering: 'centre_odd_even' });
    assert.deepEqual(center.map(s => s.number), ['3', '1', '2', '4']);
});
test('arc generation and grouping use pixel distances even on a non-square image', () => {
    const geometry = { imageWidth: 1000, imageHeight: 500 };
    const seats = model.generate({ mode: 'arc', x: 52, y: 80, count: 5, rows: 2, radius: 130, rowSpacing: 30, startAngle: 210, endAngle: 330 }, geometry);
    const grouped = model.groupRows(seats, { mode: 'arc', cx: 52, cy: 80, rowStyle: 'letters', numbering: 'ltr' }, 1000, 500);
    assert.equal(grouped.filter(s => s.row === 'A').length, 5); assert.equal(grouped.filter(s => s.row === 'B').length, 5);
    assert.ok(grouped.some(s => s.rotation !== 0));
    assert.throws(() => model.groupRows(seats, { mode: 'arc' }), /stage centre/);
});
test('generation refuses off-image rows and invalid dimensions without mutating drafts', () => {
    assert.throws(() => model.generate({ count: 20, rows: 1, x: 100, y: 50, spacing: 30 }, { imageWidth: 1000, imageHeight: 500 }), /outside/);
    assert.throws(() => model.generate({ count: 400 }), /1–300/);
    assert.throws(() => model.generate({ count: 1, width: -10 }), /positive/);
});
test('regrouping moves stable seat IDs to a physical section without assigning prices', () => {
    const seats = [marker(10, 10, 's1'), marker(20, 10, 's2'), marker(30, 10, 's3')];
    const sections = [{ letter: 'DETECTED', name: 'Detected seats', seats: 3, geometry: { type: 'polygon', layout: 'ocr', source: 'shape-detection', page: 1, imageWidth: 104, imageHeight: 106, seatMarkers: seats } }];
    const target = model.regroup(sections, ['s1', 's2'], 'Left', { rowStyle: 'letters', firstRow: 1 });
    assert.equal(target.letter, 'LEFT'); assert.equal(target.seats, 2);
    assert.deepEqual(target.geometry.seatMarkers.map(s => s.id), ['s1', 's2']);
    assert.deepEqual(target.geometry.seatMarkers.map(s => s.label), ['A1', 'A2']);
    assert.equal(sections.find(s => s.letter === 'DETECTED').seats, 1);
    assert.equal(target.geometry.reviewed, false); assert.equal('price' in target, false);
});
test('cross-page grouping and duplicate row numbering are rejected before moving seats', () => {
    const sections = [1, 2].map(page => ({ letter: 'S' + page, name: 'S' + page, seats: 2, geometry: { page, seatMarkers: [marker(10, 10, 'p' + page + 'a'), marker(20, 10, 'p' + page + 'b')] } }));
    assert.throws(() => model.regroup(sections, ['p1a', 'p2a'], 'Main', {}), /one blueprint page/);
    assert.equal(sections[0].geometry.seatMarkers.length, 2);
    const target = model.regroup(sections, ['p1a'], 'Main', {});
    assert.throws(() => model.regroup(sections, ['p1b'], 'Main', {}), /duplicate seat labels/);
    assert.equal(target.geometry.seatMarkers.length, 1);
});
test('shape imports retain measured frame dimensions and automatically number detected seats', () => {
    const im = { width: 1000, height: 500 }, shapes = { seats: [{ x: 100, y: 100, w: 20, h: 12, angle: -25, shape: 'rect', color: '#ffaa22' }] };
    const result = importer.combine(im, shapes, [], { sections: [], regions: 1 }, { mode: 'seats' }, 2);
    const seat = result.sections[0].geometry.seatMarkers[0];
    assert.equal(seat.label, '1'); assert.equal(seat.row, 'A'); assert.equal(seat.number, '1'); assert.equal(seat.rotation, -25); assert.equal(seat.width, 2.08);
    assert.equal(result.sections[0].seatCount, 1); assert.ok(model.validate(result.sections, true).every(message => /review this section/.test(message)));
});
test('automatic import does not turn a section-only map into individual chairs', () => {
    const sections = [{ sectionId: '101', name: '101', seatCount: 0 }];
    const result = importer.combine({ width: 500, height: 500 }, { seats: Array.from({ length: 20 }, (_, i) => ({ x: i * 20, y: 100, w: 40, h: 30 })) }, [], { sections }, { mode: 'auto' });
    assert.equal(result.importMode, 'sections'); assert.deepEqual(result.sections, sections);
});


test('automatic numbering starts nearest the stage boundary and keeps every measured seat unchanged', () => {
    const data = [{ sectionId: 'Hall', seats: 3, geometry: { imageWidth: 1040, imageHeight: 1060, reviewed: true,
        decorations: [{ name: 'STAGE', points: [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 20 }, { x: 10, y: 20 }] }],
        seatMarkers: [marker(52, 60, 'back'), marker(52, 26, 'centre'), { ...marker(11, 25, 'front-left'), rotation: 15 }]
    } }];
    const measured = data[0].geometry.seatMarkers.map(seat => ({ id: seat.id, x: seat.x, y: seat.y, rotation: seat.rotation, width: seat.width, height: seat.height }));
    assert.equal(model.autoNumber(data), 3);
    const seats = data[0].geometry.seatMarkers;
    assert.equal(seats.find(s => s.id === 'front-left').number, '1');
    assert.equal(seats.find(s => s.id === 'centre').number, '2');
    assert.equal(seats.find(s => s.id === 'back').number, '3');
    assert.deepEqual(seats.map(seat => ({ id: seat.id, x: seat.x, y: seat.y, rotation: seat.rotation, width: seat.width, height: seat.height })), measured);
    assert.ok(seats.every(seat => seat.row && seat.label === seat.number && seat.labelSource === 'auto'));
    assert.equal(data[0].geometry.reviewed, false);
});

test('automatic row numbering follows front-to-back order and supports a stage at the bottom', () => {
    const geometry = { imageWidth: 1040, imageHeight: 106, page: 1, seatMarkers: [marker(10, 90, 'near'), marker(80, 10, 'far')] };
    const data = [{ seats: 2, geometry }];
    model.autoNumber(data, { stagePoint: { x: 0, y: 0, page: 1 } });
    assert.equal(geometry.seatMarkers[1].number, '1', 'the front row is completed before a closer seat in a later row');
    geometry.decorations = [{ name: 'STAGE', points: [{ x: 0, y: 95 }, { x: 104, y: 95 }, { x: 104, y: 106 }, { x: 0, y: 106 }] }];
    delete geometry.numbering;
    model.autoNumber(data);
    assert.equal(geometry.seatMarkers[0].number, '1');
    assert.equal(geometry.numbering.stageSource, 'detected');
});

test('automatic numbering is deterministic across sections and pages and falls back to the top without a stage', () => {
    const sections = [
        { sectionId: 'Right', seats: 2, geometry: { page: 1, seatMarkers: [marker(80, 20, 'r-back'), marker(80, 10, 'r-front')] } },
        { sectionId: 'Left', seats: 2, geometry: { page: 1, seatMarkers: [marker(10, 20, 'l-back'), marker(10, 10, 'l-front')] } },
        { sectionId: 'Upper', seats: 1, geometry: { page: 2, seatMarkers: [marker(30, 10, 'upper')] } }
    ];
    model.autoNumber(sections);
    const numbers = () => Object.fromEntries(model.entries(sections).map(item => [item.id, item.marker.number]));
    assert.deepEqual(numbers(), { 'r-back': '4', 'r-front': '2', 'l-back': '3', 'l-front': '1', upper: '5' });
    const first = numbers(); sections.reverse(); sections.forEach(section => section.geometry.seatMarkers.reverse());
    model.autoNumber(sections);
    assert.deepEqual(numbers(), first);
    assert.ok(sections.every(section => section.geometry.numbering.stageSource === 'top'));
});

test('shape import automatically numbers chairs nearest a detected stage even without section labels', () => {
    const im = { width: 1040, height: 1060 }, shapes = { seats: [
        { x: 100, y: 900, w: 20, h: 20, shape: 'rect' }, { x: 200, y: 100, w: 20, h: 20, shape: 'rect' }
    ] };
    const result = importer.combine(im, shapes, [], { sections: [], decorations: [{ name: 'STAGE', points: [
        { x: 0, y: 95 }, { x: 104, y: 95 }, { x: 104, y: 106 }, { x: 0, y: 106 }
    ] }] }, { mode: 'seats' });
    assert.deepEqual(result.sections[0].geometry.seatMarkers.map(s => s.number), ['1','2']);
    assert.equal(result.sections[0].geometry.numbering.stageSource, 'detected');
});


test('automatic numbering completes each row left to right even when centre seats are closer to the stage', () => {
    const seats = [marker(90, 30, 'front-right'), marker(52, 40, 'back-centre'), marker(52, 30.1, 'front-centre'),
        marker(10, 40, 'back-left'), marker(10, 30, 'front-left'), marker(90, 40, 'back-right')];
    const data = [{ seats: seats.length, geometry: { imageWidth: 1040, imageHeight: 1060, page: 1, seatMarkers: seats } }];
    model.autoNumber(data, { stagePoint: { x: 52, y: 5, page: 1 } });
    const order = [...seats].sort((a,b) => Number(a.number) - Number(b.number));
    assert.deepEqual(order.map(s => s.id), ['front-left','front-centre','front-right','back-left','back-centre','back-right']);
    assert.deepEqual(order.map(s => s.row), ['A','A','A','B','B','B']);
    assert.equal(data[0].geometry.numbering.mode, 'row-by-row');
});

test('angled left and right banks share each row with the centre block before numbering the next row', () => {
    const seats = [], width = 632, height = 710;
    for (let row = 0; row < 4; row++) for (const [bank, x, y, angle, count] of [['left',90,270,15,6], ['centre',220,270,0,9], ['right',430,294,-15,6]]) {
        const radians = angle * Math.PI / 180;
        for (let i = 0; i < count; i++) seats.push({ id: `${row}-${bank}-${i}`, x: (x + i * 18 * Math.cos(radians)) / width * 104,
            y: (y + row * 34 + i * 18 * Math.sin(radians)) / height * 106, width: 18 / width * 104, height: 18 / height * 106, rotation: angle });
    }
    const data = [{ seats: seats.length, geometry: { imageWidth: width, imageHeight: height, seatMarkers: [...seats].reverse() } }];
    model.autoNumber(data);
    const ordered = [...seats].sort((a,b) => Number(a.number) - Number(b.number));
    assert.deepEqual(ordered.map(s => s.id), seats.map(s => s.id));
    assert.deepEqual(ordered.map(s => s.row), seats.map((_,i) => ['A','B','C','D'][Math.floor(i / 21)]));
    assert.equal(new Set(ordered.map(s => s.label)).size, 84);
});

test('curved rows are completed from left to right before moving outward to the next row', () => {
    const geometry = { imageWidth: 1000, imageHeight: 700, page: 1 };
    const seats = model.generate({ mode: 'arc', x: 52, y: 10, count: 13, rows: 2, radius: 120, rowSpacing: 35, startAngle: 30, endAngle: 150 }, geometry);
    const originalRows = [seats.slice(0,13), seats.slice(13)];
    const data = [{ seats: seats.length, geometry: { ...geometry, seatMarkers: [...seats].reverse() } }];
    model.autoNumber(data, { stagePoint: { x: 52, y: 10, page: 1 } });
    assert.deepEqual([...seats].sort((a,b) => Number(a.number)-Number(b.number)).map(s => s.id),
        originalRows.flatMap(row => row.sort((a,b) => a.x-b.x).map(s => s.id)));
});


test('stage and foyer annotations are excluded before seats are numbered, including a stage-shaped small box', () => {
    const data = [{ sectionId: 'Main', seats: 4, geometry: { page: 1, reviewed: true, seatMarkers: [
        marker(50, 10, 'stage-art'), marker(10, 30, 'front-left'), marker(50, 30, 'front-right'), marker(90, 30, 'foyer-art')
    ], decorations: [{ name: 'STAGE', points: [{ x: 45, y: 5 },{ x: 55, y: 5 },{ x: 55, y: 15 },{ x: 45, y: 15 }] }],
    nonSeatAreas: [{ name: 'FOYER', points: [{ x: 85, y: 25 },{ x: 95, y: 25 },{ x: 95, y: 35 },{ x: 85, y: 35 }] }] } }];
    assert.equal(model.autoNumber(data), 2);
    assert.deepEqual(data[0].geometry.seatMarkers.map(s => [s.id, s.number]), [['front-left','1'],['front-right','2']]);
    assert.equal(data[0].seatCount, 2); assert.equal(data[0].seats, 2);
    assert.equal(data[0].geometry.decorations[0].name, 'STAGE');
});

test('a stage label on a shared background must not remove the actual seating area', () => {
    const data = [{ seats: 3, geometry: { seatMarkers: [marker(10,30,'a'),marker(30,30,'b'),marker(50,30,'c')],
        decorations: [{ name: 'STAGE', points: [{ x:0,y:0 },{ x:104,y:0 },{ x:104,y:106 },{ x:0,y:106 }] }] } }];
    assert.equal(model.autoNumber(data), 3);
    assert.deepEqual(data[0].geometry.seatMarkers.map(s => s.number), ['1','2','3']);
});

test('OCR word exclusions remove letter holes that touch a seat cluster without excluding the cluster', () => {
    const shapes = { seats: [
        { x:50,y:40,w:10,h:10,shape:'rect' }, { x:50,y:60,w:10,h:10,shape:'rect' }, { x:70,y:60,w:10,h:10,shape:'rect' }
    ] };
    const result = importer.combine({ width:100,height:100 }, shapes,
        [{text:'STAGE',confidence:90,x0:42,y0:32,x1:58,y1:48}], {sections:[]}, {mode:'seats'});
    assert.equal(result.shapeCount, 2);
    assert.deepEqual(result.sections[0].geometry.seatMarkers.map(s => s.number), ['1','2']);
});
