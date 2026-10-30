// Venue draft operations. Coordinates are normalized; grouping uses source pixels.
(function (root) {
    'use strict';
    const round = n => Math.round(n * 1000) / 1000;
    const median = values => { const a = [...values].sort((x, y) => x - y), i = Math.floor(a.length / 2); return a.length ? a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2 : 0; };
    const letters = number => { let out = ''; for (number++; number > 0; number = Math.floor((number - 1) / 26)) out = String.fromCharCode(65 + (number - 1) % 26) + out; return out; };
    const idFor = (section, marker, index) => marker.id || `${section.letter || section.sectionId}:${index}`;
    function entries(sections) {
        return sections.flatMap(section => (section.geometry?.seatMarkers || []).map((marker, index) => ({ section, marker, id: idFor(section, marker, index) })));
    }
    function ensureIds(sections) {
        const used = new Set();
        entries(sections).forEach(({ section, marker, id }, index) => {
            marker.id = /^[A-Za-z0-9_-]{1,80}$/.test(id) && !used.has(id) ? id : `seat_${Date.now().toString(36)}_${index}`;
            used.add(marker.id);
        });
    }
    function bounds(markers, geometry = {}) {
        if (!markers.length) return geometry;
        const x0 = Math.max(0, Math.min(...markers.map(s => s.x - (s.width || 2.8) / 2)) - .4);
        const y0 = Math.max(0, Math.min(...markers.map(s => s.y - (s.height || 2.8) / 2)) - .4);
        const x1 = Math.min(104, Math.max(...markers.map(s => s.x + (s.width || 2.8) / 2)) + .4);
        const y1 = Math.min(106, Math.max(...markers.map(s => s.y + (s.height || 2.8) / 2)) + .4);
        return { ...geometry, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], labelX: (x0 + x1) / 2, labelY: (y0 + y1) / 2 };
    }
    function pruneNonSeats(sections) {
        let removed = 0;
        const inside = (point, polygon) => {
            let result = false;
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const a = polygon[i], b = polygon[j];
                if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
            }
            return result;
        };
        const all = entries(sections);
        const exclusions = sections.flatMap(section => [...(section.geometry?.decorations || []), ...(section.geometry?.nonSeatAreas || [])]
            .filter(area => /^(STAGE|FOH|FOYER|EXIT|ENTRANCE|BALCONY|CENTER|CENTRE|RIGHT|LEFT|TOTAL|SEATS?)$/i.test(area.name || '') && area.points?.length >= 3)
            .map(area => ({ ...area, page: section.geometry.page || 1 })));
        const usable = exclusions.filter(area => {
            // A stage label can sit on the same background region as all the
            // seating. Do not interpret that shared background as the stage.
            const onPage = all.filter(item => (item.section.geometry.page || 1) === area.page);
            const xs = area.points.map(p => p.x), ys = area.points.map(p => p.y);
            const large = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) > 104 * 106 * .25;
            return !large || onPage.filter(item => inside(item.marker, area.points)).length <= onPage.length / 2;
        });
        sections.forEach(section => {
            const geometry = section.geometry; if (!geometry?.seatMarkers) return;
            const before = geometry.seatMarkers.length;
            geometry.seatMarkers = geometry.seatMarkers.filter(marker => !usable.some(area => area.page === (geometry.page || 1) && inside(marker, area.points)));
            if (geometry.seatMarkers.length !== before) {
                removed += before - geometry.seatMarkers.length;
                section.seats = section.seatCount = geometry.seatMarkers.length;
                geometry.reviewed = false;
                section.geometry = bounds(geometry.seatMarkers, geometry);
            }
        });
        return removed;
    }
    function autoNumber(sections, options = {}) {
        pruneNonSeats(sections);
        const all = entries(sections), pages = [...new Set(all.map(item => item.section.geometry.page || 1))].sort((a, b) => a - b);
        let next = 1;
        for (const page of pages) {
            const seats = all.filter(item => (item.section.geometry.page || 1) === page);
            const pageSections = [...new Set(seats.map(item => item.section))];
            const geometry = seats[0].section.geometry, width = geometry.imageWidth || 104, height = geometry.imageHeight || 106;
            const pixel = point => ({ x: point.x / 104 * width, y: point.y / 106 * height });
            const savedPoint = seats.find(item => item.section.geometry.numbering?.stagePoint)?.section.geometry.numbering.stagePoint;
            const picked = options.stagePoint?.page === page ? options.stagePoint : savedPoint;
            const stages = pageSections.flatMap(section => section.geometry.decorations || [])
                .filter(item => /^STAGE$/i.test(String(item.name || '').trim()) && item.points?.length >= 3)
                .map(item => item.points.map(pixel));
            const origin = picked && Number.isFinite(picked.x) && Number.isFinite(picked.y) ? pixel(picked) : null;
            // Detect physical row segments using each chair's measured angle.
            // This keeps sloping banks and curved rows together across aisles.
            const measured = seats.map(item => {
                const angle = (item.marker.rotation || 0) * Math.PI / 180;
                return { ...item, point: pixel(item.marker), cos: Math.cos(angle), sin: Math.sin(angle),
                    width: (item.marker.width || 2.8) / 104 * width,
                    height: (item.marker.height || 2.8) / 106 * height };
            });
            const parent = measured.map((_, i) => i);
            const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
            for (let i = 0; i < measured.length; i++) for (let j = i + 1; j < measured.length; j++) {
                const a = measured[i], b = measured[j], dx = b.point.x - a.point.x, dy = b.point.y - a.point.y;
                const maxGap = Math.max(a.width, b.width) * 3.5;
                if (dx * dx + dy * dy > maxGap * maxGap) continue;
                if (Math.abs(a.sin * b.cos - a.cos * b.sin) > .21) continue;
                const tolerance = Math.max(1, Math.min(a.height, b.height) * .55);
                if (Math.abs(-dx * a.sin + dy * a.cos) > tolerance || Math.abs(-dx * b.sin + dy * b.cos) > tolerance) continue;
                parent[find(j)] = find(i);
            }
            const stagePoints = stages.flat(), stageY = origin?.y ?? (stagePoints.length
                ? stagePoints.reduce((sum, point) => sum + point.y, 0) / stagePoints.length : 0);
            const centreY = measured.reduce((sum, item) => sum + item.point.y, 0) / measured.length;
            const direction = stageY > centreY ? -1 : 1;
            const segments = new Map();
            measured.forEach((item, i) => { const root = find(i); if (!segments.has(root)) segments.set(root, []); segments.get(root).push(item); });
            const ordered = [...segments.values()].map(items => ({ items,
                depth: direction * items.reduce((sum, item) => sum + item.point.y, 0) / items.length,
                left: Math.min(...items.map(item => item.point.x))
            })).sort((a, b) => a.depth - b.depth || a.left - b.left);
            // Separate banks at the same front-to-back level belong to one row.
            const rowTolerance = Math.max(1, median(measured.map(item => item.height)) * .8), rows = [];
            for (const segment of ordered) {
                let row = rows.at(-1);
                if (!row || Math.abs(segment.depth - row.depth) > rowTolerance) {
                    row = { depth: segment.depth, items: [] }; rows.push(row);
                }
                const count = row.items.length + segment.items.length;
                row.depth = (row.depth * row.items.length + segment.depth * segment.items.length) / count;
                row.items.push(...segment.items);
            }
            const start = next;
            rows.forEach((row, index) => {
                row.items.sort((a, b) => a.point.x - b.point.x || a.point.y - b.point.y || String(a.id).localeCompare(String(b.id)));
                for (const item of row.items) {
                    const number = String(next++), rowLabel = letters(index);
                    if (item.marker.label !== number || item.marker.row !== rowLabel || item.marker.number !== number) item.section.geometry.reviewed = false;
                    Object.assign(item.marker, { label: number, number, row: rowLabel, labelSource: 'auto' });
                }
            });
            pageSections.forEach(section => {
                section.geometry.numbering = { mode: 'row-by-row', start, stageSource: origin ? 'picked' : stages.length ? 'detected' : 'top',
                    ...(origin ? { stagePoint: { x: picked.x, y: picked.y, page } } : {}) };
            });
        }
        return all.length;
    }
    function groupRows(markers, options, imageWidth = 104, imageHeight = 106) {
        if (!markers.length) throw new Error('Select seats to group.');
        const mode = options.mode || 'straight', numbering = options.numbering || 'ltr';
        if (!['straight', 'arc'].includes(mode) || !['ltr', 'rtl', 'centre_odd_even'].includes(numbering)) throw new Error('Choose a valid row and numbering style.');
        const first = Number(options.firstRow || 1), start = Number(options.start ?? 1), step = Number(options.step || 1);
        if (!Number.isInteger(first) || first < 1 || first > 500 || !Number.isInteger(start) || start < 0 || ![1, 2].includes(step)) throw new Error('Check the first row, starting seat and numbering step.');
        const cx = Number(options.cx), cy = Number(options.cy);
        if (mode === 'arc' && (!Number.isFinite(cx) || !Number.isFinite(cy))) throw new Error('Pick the stage centre before grouping curved rows.');
        const seats = markers.map(s => ({ ...s, px: s.x / 104 * imageWidth, py: s.y / 106 * imageHeight }));
        const origin = { x: cx / 104 * imageWidth, y: cy / 106 * imageHeight };
        // Use the measured chair angle when numbering a sloping bank. Positions
        // stay unchanged; only the axes used for row grouping are rotated.
        const angle = Number(options.angle ?? median(markers.map(s => s.rotation || 0))) * Math.PI / 180;
        const across = seat => seat.px * Math.cos(angle) + seat.py * Math.sin(angle);
        const value = seat => mode === 'arc' ? Math.hypot(seat.px - origin.x, seat.py - origin.y)
            : -seat.px * Math.sin(angle) + seat.py * Math.cos(angle);
        const tolerance = Number(options.rowTolerance) > 0 ? Number(options.rowTolerance) : Math.max(1, median(seats.map(s => (s.height || 2.8) / 106 * imageHeight)) * .55);
        seats.sort((a, b) => value(a) - value(b));
        const rows = [];
        seats.forEach(seat => { let row = rows.at(-1); if (!row || Math.abs(value(seat) - row.mean) > tolerance) { row = { mean: value(seat), seats: [] }; rows.push(row); } row.seats.push(seat); row.mean += (value(seat) - row.mean) / row.seats.length; });
        if (mode === 'arc') {
            const tau = Math.PI * 2, angle = seat => (Math.atan2(seat.py - origin.y, seat.px - origin.x) + tau) % tau;
            const angles = seats.map(angle).sort((a,b) => a-b);
            let seam = angles[0], largest = -1;
            angles.forEach((a,i) => { const next = angles[(i + 1) % angles.length], gap = (next - a + tau) % tau; if (gap > largest) { largest = gap; seam = next; } });
            rows.forEach(row => {
                row.seats.forEach(seat => { seat.along = (angle(seat) - seam + tau) % tau; });
                row.seats.sort((a,b) => a.along-b.along);
                if (row.seats[0].px > row.seats.at(-1).px) row.seats.forEach(seat => { seat.along = -seat.along; });
            });
        } else seats.forEach(seat => { seat.along = across(seat); });
        if (options.reverse) rows.reverse();
        const typicalPitch = values => { const gaps = values.filter(n => n > 0).sort((a, b) => a - b); return median(gaps.slice(0, Math.max(1, Math.ceil(gaps.length / 2)))) || 1; };
        const rowPitch = typicalPitch(rows.slice(1).map((r, i) => Math.abs(r.mean - rows[i].mean)));
        const pitch = typicalPitch(rows.flatMap(row => { const ordered = [...row.seats].sort((a, b) => a.along - b.along); return ordered.slice(1).map((s, i) => s.along - ordered[i].along); }));
        const centreX = (Math.min(...seats.map(s => s.along)) + Math.max(...seats.map(s => s.along))) / 2;
        let rowIndex = first - 1;
        return rows.flatMap((row, index) => {
            if (index) rowIndex += Math.max(1, Math.round(Math.abs(row.mean - rows[index - 1].mean) / rowPitch));
            const rowLabel = options.rowStyle === 'numbers' ? String(rowIndex + 1) : letters(rowIndex);
            row.seats.sort((a, b) => a.along - b.along);
            const left = row.seats[0].along, right = row.seats.at(-1).along;
            const rowSeatPitch = mode === 'arc' && row.seats.length > 2 ? typicalPitch(row.seats.slice(1).map((s,i) => s.along-row.seats[i].along)) : pitch;
            const centre = mode === 'arc' ? (left + right) / 2 : centreX;
            return row.seats.map(seat => {
                let number;
                if (numbering === 'centre_odd_even') { const slot = Math.max(0, Math.round(Math.abs(seat.along - centre) / rowSeatPitch - .5)); number = seat.along < centre ? slot * 2 + 1 : slot * 2 + 2; }
                else number = start + Math.round((numbering === 'rtl' ? right - seat.along : seat.along - left) / rowSeatPitch) * step;
                const { px, py, along, ...marker } = seat;
                return { ...marker, row: rowLabel, number: String(number), label: `${rowLabel}${options.rowStyle === 'numbers' ? '-' : ''}${number}`, labelSource: 'grouped',
                    rotation: mode === 'arc' ? round(Math.atan2(py - origin.y, px - origin.x) * 180 / Math.PI + 90) : marker.rotation || 0 };
            });
        });
    }
    function generate(options, geometry = {}) {
        const count = Number(options.count), rowCount = Number(options.rows || 1);
        if (!Number.isInteger(count) || count < 1 || count > 300 || !Number.isInteger(rowCount) || rowCount < 1 || count * rowCount > 3000) throw new Error('Use 1–300 seats per row and at most 3,000 seats.');
        const imageWidth = geometry.imageWidth || 104, imageHeight = geometry.imageHeight || 106;
        const out = [], scaleX = 104 / imageWidth, scaleY = 106 / imageHeight;
        const spacing = Number(options.spacing || 16), rowSpacing = Number(options.rowSpacing || spacing * 1.4), width = Number(options.width || 12), height = Number(options.height || 12);
        if (![spacing, rowSpacing, width, height].every(v => Number.isFinite(v) && v > 0)) throw new Error('Seat dimensions and spacing must be positive.');
        const mode = options.mode || 'straight';
        const startX = Number(options.x ?? 10) / 104 * imageWidth, startY = Number(options.y ?? 20) / 106 * imageHeight;
        for (let row = 0; row < rowCount; row++) for (let i = 0; i < count; i++) {
            let x = startX + i * spacing, y = startY + row * rowSpacing, rotation = 0;
            if (mode === 'arc') {
                const radius = Number(options.radius || 80) + row * rowSpacing;
                const angle = Number(options.startAngle ?? 210) + (count > 1 ? i / (count - 1) : .5) * (Number(options.endAngle ?? 330) - Number(options.startAngle ?? 210));
                x = startX + radius * Math.cos(angle * Math.PI / 180); y = startY + radius * Math.sin(angle * Math.PI / 180); rotation = angle + 90;
            }
            const marker = { id: `manual_${Date.now().toString(36)}_${row}_${i}`, x: round(x * scaleX), y: round(y * scaleY), width: round(width * scaleX), height: round(height * scaleY),
                rotation: round(rotation), shape: mode === 'arc' ? 'rect' : 'circle', label: '', row: '', number: '', labelSource: 'manual', confidence: 0 };
            if (marker.x < 0 || marker.x > 104 || marker.y < 0 || marker.y > 106) throw new Error('The generated row falls outside the image. Adjust its origin, radius or spacing.');
            out.push(marker);
        }
        return out;
    }
    function regroup(sections, selectedIds, targetName, options) {
        ensureIds(sections);
        const wanted = new Set(selectedIds), selected = entries(sections).filter(entry => wanted.has(entry.id));
        if (!selected.length) throw new Error('Select seats before grouping them.');
        const page = selected[0].section.geometry.page || 1;
        if (selected.some(s => (s.section.geometry.page || 1) !== page)) throw new Error('Group seats from one blueprint page at a time.');
        const name = String(targetName || '').trim(); if (!name || name.length > 80) throw new Error('Enter a section name (up to 80 characters).');
        const source = selected[0].section.geometry;
        const grouped = groupRows(selected.map(s => s.marker), options, source.imageWidth || 104, source.imageHeight || 106);
        let target = sections.find(s => s.name.toLowerCase() === name.toLowerCase() && (s.geometry?.page || 1) === page);
        const remaining = target ? (target.geometry.seatMarkers || []).filter(s => !wanted.has(s.id)) : [];
        const labels = remaining.concat(grouped).map(s => s.label);
        if (new Set(labels).size !== labels.length) throw new Error('This grouping produces duplicate seat labels. Adjust the numbering or select a different block.');
        if (!target) {
            const base = name.toUpperCase().replace(/[^A-Z0-9_-]+/g, '_') || 'SECTION'; let letter = base, i = 2;
            while (sections.some(s => (s.letter || s.sectionId) === letter)) letter = `${base}_${i++}`;
            target = { id: 'sec-' + letter, letter, sectionId: letter, name, seats: 0,
                geometry: { ...source, seatMarkers: [], decorations: [], kind: 'seated', source: 'shape-detection' } };
            sections.push(target);
        }
        sections.forEach(section => {
            if (section.geometry?.seatMarkers) {
                section.geometry.seatMarkers = section.geometry.seatMarkers.filter(s => !wanted.has(s.id));
                section.seats = section.geometry.seatMarkers.length; section.seatCount = section.seats; section.geometry.reviewed = false;
            }
        });
        target.geometry.seatMarkers.push(...grouped); target.seats = target.seatCount = target.geometry.seatMarkers.length;
        target.geometry = bounds(target.geometry.seatMarkers, { ...target.geometry, reviewed: false });
        for (let i = sections.length - 1; i >= 0; i--) if (sections[i] !== target && sections[i].geometry?.seatMarkers?.length === 0) sections.splice(i, 1);
        return target;
    }
    function validate(sections, requireReviewed = false) {
        const errors = [];
        if (entries(sections).length > 3000) errors.push('A layout supports up to 3,000 positioned seats. Split larger plans into separate layouts.');
        sections.forEach(section => {
            const markers = section.geometry?.seatMarkers; if (!markers) return;
            if (markers.length !== Number(section.seats ?? section.seatCount)) errors.push(`${section.name}: seat count does not match its markers.`);
            const labels = new Set();
            markers.forEach(marker => {
                if (!Number.isFinite(marker.x) || !Number.isFinite(marker.y) || marker.x < 0 || marker.x > 104 || marker.y < 0 || marker.y > 106) errors.push(`${section.name}: a seat is outside the image.`);
                if (requireReviewed && !/^[A-Z0-9_-]{1,40}$/.test(marker.label || '')) errors.push(`${section.name}: group or label every seat before activation.`);
                if (requireReviewed && section.geometry.source === 'shape-detection' && (!marker.row || !marker.number)) errors.push(`${section.name}: every detected seat needs a row and number.`);
                if (marker.width !== undefined && (!Number.isFinite(marker.width) || marker.width <= 0 || marker.width > 104)) errors.push(`${section.name}: invalid seat width.`);
                if (marker.height !== undefined && (!Number.isFinite(marker.height) || marker.height <= 0 || marker.height > 106)) errors.push(`${section.name}: invalid seat height.`);
                if (marker.label && labels.has(marker.label)) errors.push(`${section.name}: duplicate seat ${marker.label}.`);
                labels.add(marker.label);
            });
            if (requireReviewed && !section.geometry.reviewed) errors.push(`${section.name}: review this section before activation.`);
        });
        return [...new Set(errors)];
    }
    const api = { median, letters, idFor, entries, ensureIds, bounds, pruneNonSeats, autoNumber, groupRows, generate, regroup, validate };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.tsSeatLayout = api;
})(typeof window !== 'undefined' ? window : globalThis);
