(function (root) {
    'use strict';
    const layout = typeof module !== 'undefined' && module.exports ? require('./seat-layout-model.js') : root.tsSeatLayout;
    function combine(image, shapes, words, detected, options = {}, page = 1) {
        const mode = options.mode || 'auto', seats = shapes.seats || [];
        const areas = seats.map(s => s.w * s.h).sort((a, b) => a - b);
        const medianArea = areas[Math.floor(areas.length / 2)] || 0;
        const suitable = seats.length >= 12 && medianArea / (image.width * image.height) <= .0015;
        if (mode === 'sections' || (mode === 'auto' && !suitable)) return { ...detected, importMode: 'sections', shapeCount: seats.length };
        if (!seats.length) throw new Error('No individual seat shapes were detected. Adjust the size limits or choose sections and standing areas.');
        const labels = words.filter(word => word.confidence >= 35 && /^(?!RM\d)([A-Z]{1,3}[- ]?)?\d{1,4}[A-Z]?$/i.test(word.text.trim()));
        const round = value => Math.round(value * 1000) / 1000;
        const nonSeatAreas = words.filter(word => word.confidence >= 30 && /^(STAGE|FOH|FOYER|EXIT|ENTRANCE|BALCONY|CENTER|CENTRE|RIGHT|LEFT|TOTAL|SEATS?)$/i.test(word.text.trim()))
            .map(word => ({ name: word.text.trim().toUpperCase(), points: [
                { x: word.x0, y: word.y0 }, { x: word.x1, y: word.y0 }, { x: word.x1, y: word.y1 }, { x: word.x0, y: word.y1 }
            ].map(p => ({ x: p.x / image.width * 104, y: p.y / image.height * 106 })) }));
        const used = new Set();
        const markers = seats.map((seat, index) => {
            const nearby = labels.filter(word => {
                const dx = (word.x0 + word.x1) / 2 - seat.x, dy = (word.y0 + word.y1) / 2 - seat.y;
                return Math.abs(dx) < seat.w * .65 && Math.abs(dy) < seat.h * .65;
            }).sort((a, b) => b.confidence - a.confidence)[0];
            let label = nearby?.text.toUpperCase().replace(/[ -]/g, '') || '';
            if (used.has(label)) label = ''; if (label) used.add(label);
            const parsed = label.match(/^([A-Z]{1,3})(\d+[A-Z]?)$/);
            return { id: `p${page}_shape_${index}`, x: round(seat.x / image.width * 104), y: round(seat.y / image.height * 106),
                width: round(seat.w / image.width * 104), height: round(seat.h / image.height * 106), rotation: seat.angle || 0,
                shape: seat.shape, color: seat.color, label, row: parsed?.[1] || '', number: parsed?.[2] || (/^\d/.test(label) ? label : ''),
                labelSource: label ? 'ocr' : 'unlabelled', confidence: nearby?.confidence || 0 };
        });
        const left = Math.max(0, Math.min(...markers.map(s => s.x - s.width / 2))), top = Math.max(0, Math.min(...markers.map(s => s.y - s.height / 2)));
        const right = Math.min(104, Math.max(...markers.map(s => s.x + s.width / 2))), bottom = Math.min(106, Math.max(...markers.map(s => s.y + s.height / 2)));
        const result = { sections: [{ sectionId: 'DETECTED_SEATS', name: 'Detected seats', seatCount: markers.length, geometry: {
            type: 'polygon', layout: 'ocr', source: 'shape-detection', page, kind: 'seated', imageWidth: image.width, imageHeight: image.height,
            confidence: 0, reviewed: false, boundarySource: 'seat-shapes', fill: '#a8d5c1', labelX: (left + right) / 2, labelY: (top + bottom) / 2,
            points: [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }], seatMarkers: markers,
            nonSeatAreas, decorations: detected.decorations || detected.sections.flatMap(s => s.geometry?.decorations || [])
        } }], importMode: 'seats', shapeCount: markers.length, words: words.length, regions: detected.regions };
        layout.autoNumber(result.sections);
        result.sections = result.sections.filter(section => section.seatCount > 0);
        result.shapeCount = result.sections.reduce((sum, section) => sum + section.seatCount, 0);
        if (!result.shapeCount) throw new Error('Only stage or label shapes were found. No physical chairs were detected.');
        return result;
    }
    const api = { combine };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.tsSeatImport = api;
})(typeof window !== 'undefined' ? window : globalThis);
