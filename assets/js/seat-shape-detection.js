// Adapted from the guide's contour + distance-transform approach for OpenCV.js.
(function (root) {
    'use strict';
    function detect(cv, image, options = {}) {
        const minimum = Number(options.minSize || 5), maximum = Number(options.maxSize || 80);
        if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 2 || maximum > 500 || maximum < minimum) throw new Error('Choose seat sizes between 2 and 500 pixels, with maximum at least minimum.');
        if (image.width * image.height > 4000000) throw new Error('Resize this blueprint before detecting seats.');
        const mats = [], keep = mat => { mats.push(mat); return mat; }, shapes = [];
        const round = n => Math.round(n * 100) / 100;
        try {
            const source = keep(cv.matFromImageData(image)), gray = keep(new cv.Mat()), rgb = keep(new cv.Mat()), hsv = keep(new cv.Mat());
            cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY); cv.cvtColor(source, rgb, cv.COLOR_RGBA2RGB); cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
            // A theatre plan can use solid coloured dots for seats and equally
            // large black letters for row labels. Measure the coloured cores
            // independently so antialiased edges and lettering do not join rows.
            const ink = keep(new cv.Mat(image.height, image.width, cv.CV_8UC1));
            const mask = ink.data;
            for (let i = 0; i < mask.length; i++) {
                const offset = i * 4;
                const r = image.data[offset], g = image.data[offset + 1], b = image.data[offset + 2];
                mask[i] = Math.max(r, g, b) - Math.min(r, g, b) >= 80 ? 255 : 0;
            }
            const dotLabels = keep(new cv.Mat()), dotStats = keep(new cv.Mat()), dotCenters = keep(new cv.Mat());
            const components = cv.connectedComponentsWithStats(ink, dotLabels, dotStats, dotCenters, 8, cv.CV_32S);
            const dots = [];
            let colouredArea = 0, dotArea = 0;
            for (let i = 1; i < components; i++) {
                const [, , w, h, area] = dotStats.data32S.subarray(i * 5, i * 5 + 5);
                colouredArea += area;
                const size = Math.sqrt(w * h), fill = area / (w * h);
                if (size < minimum || size > maximum || Math.max(w, h) > 1.25 * Math.min(w, h) || fill < .63 || fill > .91) continue;
                const x = dotCenters.data64F[2 * i], y = dotCenters.data64F[2 * i + 1];
                const offset = (Math.round(y) * image.width + Math.round(x)) * 4;
                const color = '#' + Array.from(image.data.subarray(offset, offset + 3), c => c.toString(16).padStart(2, '0')).join('');
                dots.push({ x: round(x), y: round(y), w, h, angle: 0, shape: 'circle', color });
                dotArea += area;
            }
            if (dots.length >= 24 && dotArea >= colouredArea * .98) {
                const sizes = dots.map(dot => Math.sqrt(dot.w * dot.h)).sort((a, b) => a - b);
                const typical = sizes[Math.floor(sizes.length / 2)];
                // Mixed plans may also contain grey or outlined seats. Keep
                // the general detector if repeated neutral seat-sized boxes exist.
                const neutral = keep(new cv.Mat());
                cv.threshold(gray, neutral, 218, 255, cv.THRESH_BINARY_INV);
                const halo = keep(new cv.Mat()), kernel = keep(cv.Mat.ones(3, 3, cv.CV_8U));
                cv.dilate(ink, halo, kernel);
                neutral.setTo(new cv.Scalar(0), halo);
                const outlines = keep(new cv.MatVector()), tree = keep(new cv.Mat());
                cv.findContours(neutral, outlines, tree, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
                const neutralSeats = [];
                for (let i = 0; i < outlines.size(); i++) {
                    const contour = outlines.get(i);
                    try {
                        const box = cv.boundingRect(contour);
                        if (Math.min(box.width, box.height) >= typical * .75 && Math.max(box.width, box.height) <= typical * 1.5 &&
                            cv.contourArea(contour) >= box.width * box.height * .52) neutralSeats.push(box);
                    } finally { contour.delete(); }
                }
                const neutralRow = neutralSeats.some(a => neutralSeats.filter(b => Math.abs(a.y - b.y) < typical * .5 && Math.abs(a.x - b.x) <= typical * 4).length >= 4);
                if (!neutralRow && sizes[0] >= typical * .75 && sizes.at(-1) <= typical * 1.3) {
                    if (dots.length > 3000) throw new Error('More than 3,000 seat shapes were found. Crop to one floor and retry.');
                    return { seats: dots, typicalSize: round(typical), candidates: dots.length };
                }
            }
            const paper = keep(new cv.Mat()); cv.threshold(gray, paper, 205, 255, cv.THRESH_BINARY);
            // Scanned diagonal borders often contain one-pixel breaks. Close
            // those breaks before looking for enclosed chair interiors.
            const borderKernel = keep(cv.Mat.ones(3, 3, cv.CV_8U));
            const contours = keep(new cv.MatVector()), hierarchy = keep(new cv.Mat());
            for (const threshold of [205, 245]) {
                cv.threshold(gray, paper, threshold, 255, cv.THRESH_BINARY);
                for (const repair of [false, true]) {
                    if (repair) cv.erode(paper, paper, borderKernel);
                    cv.findContours(paper, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
                    for (let i = 0; i < contours.size(); i++) {
                        const contour = contours.get(i);
                        try {
                            const area = cv.contourArea(contour); if (area < 9) continue;
                            const rect = cv.minAreaRect(contour); let { width: w, height: h } = rect.size, angle = rect.angle;
                            if (!w || !h || Math.max(w, h) / Math.min(w, h) > 2 || area / (w * h) < .82) continue;
                            while (angle >= 45) { angle -= 90; [w, h] = [h, w]; }
                            while (angle < -45) { angle += 90; [w, h] = [h, w]; }
                            if (repair) {
                                const radians = angle * Math.PI / 180;
                                const restoredBorder = 2 * (Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians)));
                                w += restoredBorder; h += restoredBorder;
                            }
                            const size = Math.sqrt(w * h); if (size < minimum || size > maximum) continue;
                            shapes.push({ x: rect.center.x, y: rect.center.y, w, h, angle, shape: 'rect', size, method: repair ? 'outline-repaired' : 'outline' });
                        } finally { contour.delete(); }
                    }
                }
            }
            // Dark page backgrounds must not become a single solid foreground blob.
            const corners = [0, image.width - 1, (image.height - 1) * image.width, image.width * image.height - 1];
            const darkBackground = corners.filter(i => gray.data[i] < 100).length >= 3;
            // Very pale, filled chairs disappear from the saturated/dark mask.
            // Measure their outside edges directly instead of treating gaps or
            // antialiased interiors as separate chairs. Do not use this pass on
            // dark artwork or infer seats in empty spaces between detections.
            if (corners.filter(i => gray.data[i] > 245).length >= 3) {
                const pale = keep(new cv.Mat()), paleContours = keep(new cv.MatVector()), paleHierarchy = keep(new cv.Mat());
                // Tighter masks separate antialiased bridges without
                // splitting a chair or filling an aisle with inferred seats.
                for (const threshold of [245, 243, 235, 225]) {
                    cv.threshold(gray, pale, threshold, 255, cv.THRESH_BINARY_INV);
                    cv.findContours(pale, paleContours, paleHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
                    for (let i = 0; i < paleContours.size(); i++) {
                        const contour = paleContours.get(i);
                        try {
                            const rect = cv.minAreaRect(contour), area = cv.contourArea(contour);
                            let { width: w, height: h } = rect.size, angle = rect.angle;
                            const size = Math.sqrt(w * h);
                            if (size < minimum || size > maximum || Math.max(w, h) / Math.min(w, h) > 1.8 || area / (w * h) < .70) continue;
                            const x = Math.round(rect.center.x), y = Math.round(rect.center.y), light = gray.data[y * image.width + x];
                            if (light < 175 || light > 245 || hsv.data[(y * image.width + x) * 3 + 1] > 60) continue;
                            while (angle >= 45) { angle -= 90; [w, h] = [h, w]; }
                            while (angle < -45) { angle += 90; [w, h] = [h, w]; }
                            shapes.push({ x: rect.center.x, y: rect.center.y, w, h, angle, shape: 'rect', size, method: 'light-filled' });
                        } finally { contour.delete(); }
                    }
                }
            }
            const solid = keep(cv.Mat.zeros(image.height, image.width, cv.CV_8UC1));
            for (let i = 0; i < gray.data.length; i++) solid.data[i] = ((hsv.data[i * 3 + 1] > 60 && hsv.data[i * 3 + 2] > 65) || (!darkBackground && gray.data[i] < 110)) ? 255 : 0;
            const outer = keep(new cv.MatVector()), outerHierarchy = keep(new cv.Mat());
            cv.findContours(solid, outer, outerHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            const filled = keep(cv.Mat.zeros(image.height, image.width, cv.CV_8UC1));
            cv.drawContours(filled, outer, -1, new cv.Scalar(255), -1);
            const distance = keep(new cv.Mat()); cv.distanceTransform(filled, distance, cv.DIST_L2, 5);
            const values = distance.data32F, peaks = [];
            for (let y = 1; y < image.height - 1; y++) for (let x = 1; x < image.width - 1; x++) {
                const i = y * image.width + x, value = values[i];
                if (value < minimum / 2 || value > maximum / 2) continue;
                if ([i - 1, i + 1, i - image.width, i + image.width, i - image.width - 1, i + image.width + 1].every(j => values[j] <= value)) peaks.push(value);
            }
            peaks.sort((a, b) => a - b);
            const radius = peaks[Math.floor(peaks.length / 2)] || 0;
            if (radius) {
                const core = keep(cv.Mat.zeros(image.height, image.width, cv.CV_8UC1));
                for (let i = 0; i < values.length; i++) core.data[i] = values[i] >= radius * .7 ? 255 : 0;
                const labels = keep(new cv.Mat()), stats = keep(new cv.Mat()), centers = keep(new cv.Mat());
                const count = cv.connectedComponentsWithStats(core, labels, stats, centers, 8, cv.CV_32S);
                const radii = new Float32Array(count);
                for (let i = 0; i < labels.data32S.length; i++) radii[labels.data32S[i]] = Math.max(radii[labels.data32S[i]], values[i]);
                for (let i = 1; i < count; i++) {
                    const w0 = stats.data32S[i * 5 + 2], h0 = stats.data32S[i * 5 + 3], r = radii[i], side = r * 2;
                    if (Math.max(w0, h0) > 3 * Math.min(w0, h0) + 2 || side < minimum || side > maximum) continue;
                    const x = centers.data64F[i * 2], y = centers.data64F[i * 2 + 1];
                    const corners = [[-1,-1],[-1,1],[1,-1],[1,1]].filter(([dx, dy]) => {
                        const px = Math.round(x + dx * r * .8), py = Math.round(y + dy * r * .8);
                        return px >= 0 && px < image.width && py >= 0 && py < image.height && filled.data[py * image.width + px];
                    }).length;
                    shapes.push({ x, y, w: side, h: side, angle: 0, shape: corners >= 3 ? 'rect' : 'circle', size: side, method: 'filled' });
                }
            }
            if (!shapes.length) return { seats: [], typicalSize: 0, candidates: 0 };
            const logs = shapes.map(s => Math.log(s.size)), low = Math.min(...logs), high = Math.max(...logs), bins = new Uint32Array(25);
            const binFor = value => Math.min(24, Math.floor((value - low) / Math.max(high - low, .001) * 25));
            logs.forEach(value => bins[binFor(value)]++);
            let peak = 0; bins.forEach((count, i) => { if (count > bins[peak]) peak = i; });
            const typical = Math.exp(low + (peak + .5) / 25 * (high - low));
            const seats = [];
            const priority = { 'light-filled': 0, outline: 1, 'outline-repaired': 2, filled: 3 };
            shapes.filter(s => s.size >= typical * .65 && s.size <= typical * 1.5).sort((a, b) => priority[a.method] - priority[b.method]).forEach(shape => {
                if (seats.some(seat => Math.hypot(shape.x - seat.x, shape.y - seat.y) < typical * .7)) return;
                let r = 0, g = 0, b = 0, n = 0;
                for (let y = Math.max(0, Math.floor(shape.y - shape.h / 4)); y < Math.min(image.height, shape.y + shape.h / 4); y++) for (let x = Math.max(0, Math.floor(shape.x - shape.w / 4)); x < Math.min(image.width, shape.x + shape.w / 4); x++) {
                    const offset = (y * image.width + x) * 4; if (Math.min(...image.data.subarray(offset, offset + 3)) > 220) continue;
                    r += image.data[offset]; g += image.data[offset + 1]; b += image.data[offset + 2]; n++;
                }
                const color = '#' + [r, g, b].map(total => Math.round(n ? total / n : 180).toString(16).padStart(2, '0')).join('');
                seats.push({ x: round(shape.x), y: round(shape.y), w: round(shape.w), h: round(shape.h), angle: round(shape.angle), shape: shape.shape, color });
            });
            // Repeated chair shapes have nearby peers. Isolated letter holes,
            // legend symbols and door details should not become extra chairs.
            const parent = seats.map((_, i) => i);
            const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
            for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) {
                if (Math.hypot(seats[i].x - seats[j].x, seats[i].y - seats[j].y) <= typical * 4) parent[find(j)] = find(i);
            }
            const counts = new Map();
            seats.forEach((_, i) => counts.set(find(i), (counts.get(find(i)) || 0) + 1));
            const supported = seats.filter((_, i) => counts.get(find(i)) >= 3);
            const resultSeats = seats.length >= 12 && supported.length >= seats.length * .75 ? supported : seats;
            if (resultSeats.length > 3000) throw new Error('More than 3,000 seat shapes were found. Crop to one floor and retry.');
            return { seats: resultSeats, typicalSize: round(typical), candidates: shapes.length };
        } finally { mats.reverse().forEach(mat => mat.delete()); }
    }
    const api = { detect };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.tsSeatShapeDetection = api;
})(typeof self !== 'undefined' ? self : globalThis);
