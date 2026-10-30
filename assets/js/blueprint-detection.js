// Pure image/word analysis shared by the browser scanner and regression tests.
// No venue names, section lists, or reference-image coordinates are used here.
(function (root) {
    'use strict';
    const round = n => Math.round(n * 100) / 100;
    function parseTsv(tsv) {
        return String(tsv || '').split(/\r?\n/).slice(1).flatMap(line => {
            const cols = line.split('\t');
            if (cols[0] !== '5' || cols.length < 12 || !cols.slice(11).join(' ').trim()) return [];
            if (![6, 7, 8, 9, 10].every(index => Number.isFinite(Number(cols[index]))) || Number(cols[8]) <= 0 || Number(cols[9]) <= 0) return [];
            return [{ text: cols.slice(11).join(' ').trim().slice(0, 100), confidence: Number(cols[10]),
                x0: Number(cols[6]), y0: Number(cols[7]), x1: Number(cols[6]) + Number(cols[8]), y1: Number(cols[7]) + Number(cols[9]),
                line: cols.slice(1, 5).join('-') }];
        });
    }
    function hull(points) {
        const sorted = points.sort((a, b) => a.x - b.x || a.y - b.y);
        if (sorted.length < 3) return sorted;
        const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        const lower = [], upper = [];
        for (const p of sorted) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
        for (let i = sorted.length - 1; i >= 0; i--) { const p = sorted[i]; while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
        return lower.slice(0, -1).concat(upper.slice(0, -1));
    }
    function colorClass(data, offset) {
        if (data[offset + 3] < 100) return 0;
        const r = data[offset], g = data[offset + 1], b = data[offset + 2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
        if (max < 65) return 0;
        if (delta < 35) return max > 125 ? 1 + Math.floor(max / 32) : 0;
        let hue = max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
        return 12 + Math.round(hue * 3) % 18 + 18 * Math.floor(max / 48);
    }
    function outline(queue, count, ids, id, width, height) {
        const edges = new Map(), stride = width + 1;
        const edge = (x0, y0, x1, y1) => { const key = y0 * stride + x0, list = edges.get(key) || []; list.push(y1 * stride + x1); edges.set(key, list); };
        for (let i = 0; i < count; i++) {
            const index = queue[i], x = index % width, y = Math.floor(index / width);
            if (!y || ids[index - width] !== id) edge(x, y, x + 1, y);
            if (x === width - 1 || ids[index + 1] !== id) edge(x + 1, y, x + 1, y + 1);
            if (y === height - 1 || ids[index + width] !== id) edge(x + 1, y + 1, x, y + 1);
            if (!x || ids[index - 1] !== id) edge(x, y + 1, x, y);
        }
        let start = Infinity; for (const key of edges.keys()) start = Math.min(start, key);
        const points = []; let current = start, previous = start - 1;
        const direction = (a, b) => b - a === 1 ? 0 : b - a === stride ? 1 : b - a === -1 ? 2 : 3;
        for (let i = 0; i <= edges.size; i++) {
            points.push({ x: current % stride, y: Math.floor(current / stride) });
            const next = edges.get(current); if (!next?.length) break;
            const incoming = direction(previous, current), order = [1, 0, 3, 2];
            const chosen = [...next].sort((a, b) => order.indexOf((direction(current, a) - incoming + 4) % 4) - order.indexOf((direction(current, b) - incoming + 4) % 4))[0];
            previous = current; current = chosen; if (current === start) break;
        }
        function simplify(path, tolerance) {
            if (path.length < 3) return path;
            const a = path[0], b = path.at(-1), dx = b.x - a.x, dy = b.y - a.y;
            let max = tolerance, split = -1;
            for (let i = 1; i < path.length - 1; i++) {
                const p = path[i], distance = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.max(Math.hypot(dx, dy), .01);
                if (distance > max) { max = distance; split = i; }
            }
            return split < 0 ? [a, b] : simplify(path.slice(0, split + 1), tolerance).slice(0, -1).concat(simplify(path.slice(split), tolerance));
        }
        if (points.length < 4) return points;
        const middle = Math.floor(points.length / 2);
        let tolerance = 1, result;
        do {
            result = simplify(points.slice(0, middle + 1), tolerance).slice(0, -1).concat(simplify(points.slice(middle).concat(points[0]), tolerance).slice(0, -1));
            tolerance *= 1.5;
        } while (result.length > 64);
        return result;
    }
    function regions(image) {
        const { width: w, height: h, data } = image, size = w * h;
        const classes = new Uint8Array(size), ids = new Int32Array(size), queue = new Int32Array(size);
        for (let i = 0; i < size; i++) classes[i] = colorClass(data, i * 4);
        const result = [], minimum = Math.max(20, size * .00004);
        let serial = 0;
        for (let seed = 0; seed < size; seed++) {
            if (!classes[seed] || ids[seed]) continue;
            const id = ++serial, color = classes[seed];
            let head = 0, tail = 1, minX = w, minY = h, maxX = 0, maxY = 0, red = 0, green = 0, blue = 0;
            queue[0] = seed; ids[seed] = id;
            const boundary = [];
            while (head < tail) {
                const index = queue[head++], x = index % w, y = Math.floor(index / w), p = index * 4;
                minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                red += data[p]; green += data[p + 1]; blue += data[p + 2];
                let edge = false;
                for (const next of [y > 0 ? index - w : -1, y < h - 1 ? index + w : -1, x > 0 ? index - 1 : -1, x < w - 1 ? index + 1 : -1]) {
                    if (next < 0 || classes[next] !== color) { edge = true; continue; }
                    if (!ids[next]) { ids[next] = id; queue[tail++] = next; }
                }
                if (edge && (x % 2 === 0 || y % 2 === 0)) boundary.push({ x, y });
            }
            if (tail < minimum || tail > size * .25 || maxX - minX < 4 || maxY - minY < 4) continue;
            // Text, thin divider lines, and photographic texture are poor region candidates.
            if (tail / ((maxX - minX + 1) * (maxY - minY + 1)) < .2) continue;
            result.push({ id, minX, minY, maxX, maxY, area: tail, points: outline(queue, tail, ids, id, w, h), cropHull: hull(boundary),
                fill: '#' + [red, green, blue].map(sum => Math.round(sum / tail).toString(16).padStart(2, '0')).join('') });
        }
        return { items: result, ids, width: w, height: h };
    }
    function candidates(words) {
        const clean = text => text.toUpperCase().replace(/[|]/g, 'I').replace(/[^A-Z0-9 -]/g, '').trim();
        return words.flatMap((word, index) => {
            if (word.confidence < 25) return [];
            let text = clean(word.text).replace(/^(SECTION|SEC|BLOCK|ZONE|FLOOR|ROW)(?=[A-Z0-9])/, '$1 '), bbox = { ...word };
            if (/^(SECTION|SEC|BLOCK|ZONE|FLOOR|ROW)$/.test(text)) {
                const next = words[index + 1];
                if (!next || next.line !== word.line || !/^[A-Z0-9]{1,5}$/.test(clean(next.text))) return [];
                text += ' ' + clean(next.text); bbox.x1 = next.x1; bbox.y1 = Math.max(word.y1, next.y1);
            }
            const line = words.filter(other => other.line === word.line).map(other => clean(other.text)).join(' ');
            if (/\b(RM\s*\d|PRICE|CAT\s*\d|CATEGORY|TICKET|BOOKING|SEATMAP|SUBJECT TO|NOT DRAWN|PURPOSES|CHARGES)/.test(line)) return [];
            if (/^(STAGE|FOH)$/.test(text)) return [{ ...bbox, text, kind: 'decoration' }];
            if (/^(STANDING|STANDING ZONE)$/.test(text)) return [{ ...bbox, text: 'Standing floor', kind: 'standing' }];
            if (/^(SECTION|SEC|BLOCK|ZONE|FLOOR|ROW) [A-Z0-9 -]{1,16}$/.test(text) || /^V{0,2}IP$/.test(text)
                || /^\d{1,4}[A-Z]?$/.test(text) || /^[A-Z]{1,2}\d{1,3}$/.test(text) || /^[A-Z]$/.test(text)
                || (/^[A-Z]{2,24}$/.test(text) && line.split(' ').length < 5)) {
                return [{ ...bbox, text, kind: /^[A-Z]{1,2}\d{1,3}$/.test(text) ? 'seat' : 'seated' }];
            }
            return [];
        });
    }
    function regionCrop(image, region, segmentation, scale = 3) {
        const padding = 5, width = (region.maxX - region.minX + 1 + padding * 2) * scale;
        const height = (region.maxY - region.minY + 1 + padding * 2) * scale;
        const data = new Uint8ClampedArray(width * height * 4).fill(255);
        const { width: w, height: h } = image;
        const brightness = rgb => .299 * rgb[0] + .587 * rgb[1] + .114 * rgb[2];
        const color = region.fill.match(/[0-9a-f]{2}/g).map(s => parseInt(s, 16));
        const background = brightness(color);
        let glyphPixels = 0;
        for (let y = region.minY; y <= region.maxY; y++) for (let x = region.minX; x <= region.maxX; x++) {
            const offset = (y * w + x) * 4, light = brightness(image.data.subarray(offset, offset + 3));
            if (!(light < Math.min(110, background * .62) || light > background + 85)) continue;
            let inside = true;
            const cropHull = region.cropHull || region.points;
            for (let i = 0; i < cropHull.length; i++) {
                const a = cropHull[i], b = cropHull[(i + 1) % cropHull.length];
                const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
                if (cross < Math.hypot(b.x - a.x, b.y - a.y) * 1.3) { inside = false; break; }
            }
            if (!inside) continue;
            glyphPixels++;
            for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
                const dest = (((y - region.minY + padding) * scale + sy) * width + (x - region.minX + padding) * scale + sx) * 4;
                data[dest] = data[dest + 1] = data[dest + 2] = 0;
            }
        }
        return glyphPixels < 4 ? null : { width, height, data, x: region.minX - padding, y: region.minY - padding, scale };
    }
    function detect(image, inputWords, page = 1, segmentation) {
        const { width: w, height: h } = image;
        const blobs = segmentation || regions(image), byId = new Map(blobs.items.map(item => [item.id, item]));
        const normalized = point => ({ x: round(point.x / w * 104), y: round(point.y / h * 106) });
        const matched = new Map(), fallback = [], decorations = [], rows = new Map();
        const findRegion = word => {
            if (byId.has(word.regionId)) return byId.get(word.regionId);
            const votes = new Map();
            const padding = Math.max(2, Math.ceil((word.y1 - word.y0) * .35));
            for (let y = Math.max(0, Math.floor(word.y0 - padding)); y <= Math.min(h - 1, word.y1 + padding); y += 2) {
                for (let x = Math.max(0, Math.floor(word.x0 - padding)); x <= Math.min(w - 1, word.x1 + padding); x += 2) {
                    const id = blobs.ids[y * w + x];
                    if (byId.has(id)) votes.set(id, (votes.get(id) || 0) + 1);
                }
            }
            return byId.get([...votes].sort((a, b) => b[1] - a[1])[0]?.[0]);
        };
        const words = candidates(inputWords);
        for (const word of words) {
            if (word.kind === 'seat') {
                const row = word.text.match(/^[A-Z]+/)[0];
                const list = rows.get(row) || []; list.push(word); rows.set(row, list); continue;
            }
            const region = findRegion(word);
            if (word.kind === 'decoration') { decorations.push({ ...word, region }); continue; }
            if (region) {
                const list = matched.get(region.id) || [];
                const same = list.findIndex(prev => {
                    const dx = (prev.x0 + prev.x1 - word.x0 - word.x1) / 2, dy = (prev.y0 + prev.y1 - word.y0 - word.y1) / 2;
                    return Math.hypot(dx, dy) < Math.max(5, (word.y1 - word.y0) * .8);
                });
                if (same < 0) list.push({ ...word, region });
                else if (word.confidence > list[same].confidence || (word.text.length > list[same].text.length && word.confidence > list[same].confidence - 15)) list[same] = { ...word, region };
                matched.set(region.id, list);
            } else {
                // On a white plan, text bounds are useful when outlines cannot be traced.
                // On dark event artwork, unmatched text is usually the legend or prices.
                const x = Math.max(0, Math.min(w - 1, Math.floor(word.x0 - 3))), y = Math.max(0, Math.min(h - 1, Math.floor(word.y0 - 3)));
                const offset = (y * w + x) * 4;
                if ((image.data[offset] + image.data[offset + 1] + image.data[offset + 2]) / 3 > 170) fallback.push(word);
            }
        }
        const sections = [], used = new Set();
        function add(word, markers) {
            const region = word.region;
            const rawPoints = region?.points?.length >= 3 ? region.points : [
                { x: Math.max(0, word.x0 - 5), y: Math.max(0, word.y0 - 5) }, { x: Math.min(w, word.x1 + 5), y: Math.max(0, word.y0 - 5) },
                { x: Math.min(w, word.x1 + 5), y: Math.min(h, word.y1 + 5) }, { x: Math.max(0, word.x0 - 5), y: Math.min(h, word.y1 + 5) }
            ];
            const label = normalized({ x: (word.x0 + word.x1) / 2, y: (word.y0 + word.y1) / 2 });
            let sectionId = word.text.toUpperCase().replace(/[^A-Z0-9_-]+/g, '_').slice(0, 60), suffix = 2;
            const base = sectionId || 'SECTION';
            while (used.has(sectionId)) sectionId = `${base}_${suffix++}`;
            used.add(sectionId);
            const geometry = { type: 'polygon', layout: 'ocr', kind: word.kind === 'standing' ? 'standing' : 'seated', page,
                imageWidth: w, imageHeight: h, points: rawPoints.map(normalized), fill: region?.fill || '#c3a47e',
                labelX: label.x, labelY: label.y, confidence: round(word.confidence), reviewed: false,
                boundarySource: region ? 'color-region' : 'text-bounds' };
            if (markers) geometry.seatMarkers = markers;
            sections.push({ sectionId, name: word.text, seatCount: markers?.length || 0, geometry });
        }
        function clip(polygon, anchor, other) {
            const dx = other.x - anchor.x, dy = other.y - anchor.y;
            const boundary = (other.x * other.x + other.y * other.y - anchor.x * anchor.x - anchor.y * anchor.y) / 2;
            const value = p => p.x * dx + p.y * dy - boundary;
            const output = [];
            for (let i = 0; i < polygon.length; i++) {
                const a = polygon[i], b = polygon[(i + 1) % polygon.length], va = value(a), vb = value(b);
                if (va <= 0) output.push(a);
                if ((va <= 0) !== (vb <= 0)) { const t = va / (va - vb); output.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
            }
            return output;
        }
        for (const list of matched.values()) {
            const filtered = list.filter(word => !list.some(other => other !== word && other.text.endsWith(' ' + word.text)));
            for (const word of filtered) {
                let polygon = word.region.points;
                const center = item => ({ x: (item.x0 + item.x1) / 2, y: (item.y0 + item.y1) / 2 });
                for (const other of filtered) if (other !== word) polygon = clip(polygon, center(word), center(other));
                add({ ...word, region: { ...word.region, points: polygon } });
            }
        }
        for (const word of fallback) {
            // Joining "ZONE A" also produces a single-letter A token; discard that duplicate.
            if (words.some(other => other !== word && other.text.endsWith(' ' + word.text) && Math.abs(other.y0 - word.y0) < word.y1 - word.y0)) continue;
            add(word);
        }
        for (const [row, seats] of rows) {
            // A single alphanumeric label is more likely a block name than a row of seats.
            if (seats.length < 2) { const word = seats[0]; add({ ...word, region: findRegion(word) }); continue; }
            const unique = new Map();
            seats.sort((a, b) => b.confidence - a.confidence).forEach(seat => { if (!unique.has(seat.text)) unique.set(seat.text, seat); });
            const markers = [...unique.values()].sort((a, b) => a.text.localeCompare(b.text, undefined, { numeric: true })).map(word => ({
                label: word.text, ...normalized({ x: (word.x0 + word.x1) / 2, y: (word.y0 + word.y1) / 2 }), confidence: round(word.confidence)
            }));
            add({ text: 'ROW ' + row, kind: 'seated', confidence: Math.min(...seats.map(s => s.confidence)),
                x0: Math.min(...seats.map(s => s.x0)), y0: Math.min(...seats.map(s => s.y0)), x1: Math.max(...seats.map(s => s.x1)), y1: Math.max(...seats.map(s => s.y1)) }, markers);
        }
        if (sections.length > 300) throw new Error('More than 300 candidate sections were found. Crop the image to one floor and scan it again.');
        const stageGeometry = decorations.map(item => ({ name: item.text,
            points: (item.region?.points || [{ x: item.x0, y: item.y0 }, { x: item.x1, y: item.y0 }, { x: item.x1, y: item.y1 }, { x: item.x0, y: item.y1 }]).map(normalized) }));
        if (sections.length && stageGeometry.length) sections[0].geometry.decorations = stageGeometry;
        return { sections, decorations: stageGeometry, words: inputWords.length, regions: blobs.items.length };
    }
    const api = { parseTsv, candidates, regions, regionCrop, detect };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.tsBlueprintDetection = api;
})(typeof window !== 'undefined' ? window : globalThis);
