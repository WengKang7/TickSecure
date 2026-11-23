// Shared physical-section renderer used by the administrator and organizer views.
window.tsVenueRenderer = {
    renderGeometry: function(container, sections, options) {
        const ns = 'http://www.w3.org/2000/svg';
        const node = (tag, attributes, content) => {
            const el = document.createElementNS(ns, tag);
            Object.entries(attributes || {}).forEach(([key, value]) => el.setAttribute(key, value));
            if (content !== undefined) el.textContent = content;
            return el;
        };
        const selected = sections.find(s => String(s.sectionId || s.letter) === options.selectedSectionId);
        const pages = [...new Set(sections.map(s => s.geometry?.page || 1))].sort((a, b) => a - b);
        const page = selected?.geometry?.page || options.page || pages[0] || 1;
        if (pages.length > 1) {
            const chooser = document.createElement('select'); chooser.className = 'ts-input ts-map-page-select'; chooser.setAttribute('aria-label', 'Blueprint page');
            pages.forEach(number => { const option = document.createElement('option'); option.value = number; option.textContent = `Page ${number}`; chooser.appendChild(option); });
            chooser.value = page;
            chooser.addEventListener('change', () => {
                const section = sections.find(s => (s.geometry?.page || 1) === Number(chooser.value));
                if (options.onSectionSelect) options.onSectionSelect(String(section.sectionId || section.letter));
                else this.renderBoard(container.id, sections, { ...options, page: Number(chooser.value) });
            });
            container.appendChild(chooser);
        }
        const visible = sections.filter(s => (s.geometry?.page || 1) === page);
        const backgroundUrl = options.backgroundUrls?.[page] || options.backgroundUrl;
        const layout = visible.find(s => s.geometry?.layout)?.geometry.layout || (backgroundUrl ? 'ocr' : '');
        const scanned = layout === 'ocr';
        const outlineOnly = !options.cleanLayout && scanned && typeof backgroundUrl === 'string' && backgroundUrl.startsWith('blob:');
        const size = selected?.geometry?.imageWidth ? selected.geometry : visible.find(s => s.geometry?.imageWidth)?.geometry || options;
        const markers = visible.flatMap(section => section.geometry?.seatMarkers || []);
        const median = values => { const list = values.filter(value => Number.isFinite(value) && value > 0).sort((a,b) => a-b); const mid = Math.floor(list.length / 2); return list.length ? list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2 : 0; };
        const imageWidth = size.imageWidth || 104, imageHeight = size.imageHeight || 106;
        // One shared physical size per page; scanned positions and IDs stay intact.
        const uniformWidth = median(markers.map(marker => (marker.width || 2.8) / 104 * imageWidth)) || 12;
        const uniformHeight = median(markers.map(marker => (marker.height || 2.8) / 106 * imageHeight)) || 12;
        const squareSize = Math.min(uniformWidth, uniformHeight);
        const sharedWidth = squareSize / imageWidth * 104, sharedHeight = squareSize / imageHeight * 106;
        const longestNumber = Math.max(1, ...markers.map(marker => String(marker.number || marker.label || '?').length));
        // Fit even four-digit numbers inside dense plans; strokes must not
        // consume the gaps between small seats. All clean frames share a size.
        const cleanFontSize = Math.min(1.3, sharedHeight * .52, sharedWidth * .80 / (longestNumber * .62));
        container.style.aspectRatio = scanned ? 'auto' : '';
        const svg = node('svg', { viewBox: options.viewport?.join(' ') || '0 0 104 106', preserveAspectRatio: scanned ? 'none' : 'xMidYMid meet', class: 'ts-venue-map' + (outlineOnly ? ' ts-map-outline' : ''), role: 'group', 'aria-label': 'Physical venue sections' });
        if (scanned) {
            svg.style.aspectRatio = size.imageWidth && size.imageHeight ? `${size.imageWidth} / ${size.imageHeight}` : '104 / 106';
            svg.style.height = 'auto';
            if (outlineOnly) svg.style.maxHeight = 'none';
            if (options.fitContainer) {
                const ratio = size.imageWidth && size.imageHeight ? size.imageWidth / size.imageHeight : 104 / 106;
                svg.style.width = `min(100%, calc(var(--ts-venue-fit-height, 500px) * ${ratio}))`;
                svg.style.maxHeight = 'var(--ts-venue-fit-height, 500px)';
                svg.style.margin = 'auto';
            }
        }
        if (outlineOnly) {
            svg.appendChild(node('image', { href: backgroundUrl, x: 0, y: 0, width: 104, height: 106, preserveAspectRatio: 'none' }));
        }
        const validArea = item => Array.isArray(item?.points) && item.points.length >= 3
            && item.points.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 104 && p.y >= 0 && p.y <= 106);
        const drawnStages = new Set();
        const drawStage = item => {
            if (!validArea(item)) return false;
            const xs = item.points.map(p => p.x), ys = item.points.map(p => p.y);
            const left = Math.min(...xs), top = Math.min(...ys), w = Math.max(...xs) - left, h = Math.max(...ys) - top;
            if (w <= 0 || h <= 0) return false;
            const key = [left, top, w, h].join('|');
            if (drawnStages.has(key)) return true;
            drawnStages.add(key);
            // These are the saved OCR bounds. Never enlarge, clamp, or move a
            // detected stage to a default position relative to the chairs.
            const x = left + w / 2, y = top + h / 2;
            svg.appendChild(node('rect', { class: 'ts-map-stage', x: left, y: top, width: w, height: h, rx: Math.min(w, h) * .08, fill: '#111111' }));
            svg.appendChild(node('text', { class: 'ts-map-stage-label', x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: '#ffffff', 'font-size': Math.min(1.5, h * .5, w / 4), 'font-weight': 700 }, 'STAGE'));
            return true;
        };
        const standing = layout === 'standing-bowl';
        if (!scanned && standing) {
            svg.appendChild(node('path', { d: 'M5 40 Q22 97 51 91 Q83 97 98 40', fill: 'none', stroke: '#555c64', 'stroke-width': 5, 'stroke-dasharray': '7 1' }));
        }
        let stageDrawn = false;
        if (!outlineOnly) {
            visible.flatMap(s => s.geometry?.decorations || []).forEach(item => {
                if (!validArea(item)) return;
                if (options.cleanLayout && /^STAGE$/i.test(item.name || '')) { stageDrawn = drawStage(item) || stageDrawn; return; }
                if (/^STAGE$/i.test(item.name || '')) stageDrawn = true;
                svg.appendChild(node('polygon', { points: item.points.map(p => `${p.x},${p.y}`).join(' '), fill: '#929aa2', opacity: backgroundUrl ? .35 : 1 }));
                const x = item.points.reduce((sum, p) => sum + p.x, 0) / item.points.length;
                const y = item.points.reduce((sum, p) => sum + p.y, 0) / item.points.length;
                svg.appendChild(node('text', { x, y, 'text-anchor': 'middle', fill: '#ffffff', 'font-size': 2 }, item.name));
            });
        }
        if (options.cleanLayout && !stageDrawn && visible.length) this.showMissingStage(container);
        visible.forEach((section, index) => {
            if (options.seatOnly && section.geometry?.seatMarkers) return;
            const g = section.geometry;
            if (g?.type !== 'polygon' || !Array.isArray(g.points) || g.points.length < 3) return;
            const id = String(section.sectionId || section.letter || section.id || index);
            const interactive = typeof options.onSectionSelect === 'function';
            const selected = id === options.selectedSectionId;
            const group = node('g', { class: 'ts-map-section' + (selected ? ' active' : ''),
                'data-section-id': id, 'aria-label': `${section.name}, ${section.seatCount ?? section.seats ?? 0} ${g.kind === 'standing' ? 'places' : 'seats'}` });
            group.appendChild(node('title', {}, `${section.name} · ${section.seatCount ?? section.seats ?? 0} ${g.kind === 'standing' ? 'places' : 'seats'}`));
            group.appendChild(node('polygon', { points: g.points.map(p => `${p.x},${p.y}`).join(' '),
                fill: outlineOnly || (options.cleanLayout && g.seatMarkers) ? 'transparent' : /^#[0-9a-f]{6}$/i.test(g.fill) ? g.fill : '#c3a47e',
                'pointer-events': 'all', stroke: scanned ? '#eef4ff' : '#18212b', 'stroke-width': '.45', 'stroke-linejoin': 'round' }));
            const label = section.name || id;
            const textEl = node('text', { x: g.labelX, y: g.labelY, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
                fill: '#101820', 'font-size': label.length > 10 ? 1.55 : 2, 'font-weight': 700 }, label);
            if (!outlineOnly && !(options.cleanLayout && g.seatMarkers)) group.appendChild(textEl);
            if (interactive) {
                group.setAttribute('role', 'button');
                group.setAttribute('tabindex', '0');
                group.setAttribute('aria-pressed', String(selected));
                group.addEventListener('click', () => options.onSectionSelect(id));
                group.addEventListener('keydown', event => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); options.onSectionSelect(id); }
                });
            }
            svg.appendChild(group);
        });
        visible.forEach(section => {
            const id = String(section.sectionId || section.letter);
            (section.geometry?.seatMarkers || []).forEach((marker, index) => {
                const markerId = marker.id || `${id}:${index}`;
                const state = marker.status || 'AVAILABLE';
                const disabled = ['SOLD', 'HELD', 'BLOCKED', 'CONTEXT'].includes(state) || Boolean(options.onCategorySelect && !marker.categoryId);
                const seat = node('g', { class: 'ts-ocr-seat' + (marker.status ? ' ts-seat-' + state.toLowerCase() : ''),
                    'aria-label': `Seat ${id}-${marker.label || 'unlabelled'}${marker.status ? ', ' + state.toLowerCase() : ''}`,
                    'data-seat-label': marker.label || '', 'data-physical-seat-label': `${id}-${marker.label || ''}`, 'data-seat-id': markerId, 'data-category-id': marker.categoryId || '',
                    style: /^#[0-9a-f]{6}$/i.test(marker.color || '') ? `--ts-seat-color:${marker.color}` : '' });
                seat.appendChild(node('title', {}, `Seat ${id}-${marker.label || 'unlabelled'}${marker.categoryName ? ' · ' + marker.categoryName : ''}`));
                const w = options.cleanLayout ? sharedWidth : marker.width || (outlineOnly ? 3.2 : 2.8), h = options.cleanLayout ? sharedHeight : marker.height || (outlineOnly ? 3.2 : 2.8);
                const attrs = { class: 'ts-seat-frame', fill: outlineOnly ? 'transparent' : /^#[0-9a-f]{6}$/i.test(marker.color || '') ? marker.color : '#e4f1e9', stroke: outlineOnly ? '#eef4ff' : '#23734b', 'stroke-width': options.cleanLayout ? Math.min(.3, w * .09, h * .09) : '.3', 'pointer-events': 'all' };
                if (options.cleanLayout) {
                    const ring = Math.min(w, h) * .10;
                    seat.appendChild(node('rect', { class: 'ts-seat-selection-ring', x: marker.x - w / 2 - ring, y: marker.y - h / 2 - ring,
                        width: w + ring * 2, height: h + ring * 2, rx: Math.min(w, h) * .30 + ring, fill: 'none', 'pointer-events': 'none', visibility: 'hidden' }));
                    seat.appendChild(node('rect', { ...attrs, x: marker.x - w / 2, y: marker.y - h / 2, width: w, height: h, rx: Math.min(w, h) * .30 }));
                }
                else if (marker.shape === 'circle') seat.appendChild(node('ellipse', { ...attrs, cx: marker.x, cy: marker.y, rx: w / 2, ry: h / 2 }));
                else if (marker.shape === 'rect' && marker.rotation) {
                    const sx = (section.geometry.imageWidth || 104) / 104, sy = (section.geometry.imageHeight || 106) / 106, angle = marker.rotation * Math.PI / 180;
                    const corners = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([dx, dy]) => {
                        const px = dx * w / 2 * sx, py = dy * h / 2 * sy;
                        return `${marker.x + (px * Math.cos(angle) - py * Math.sin(angle)) / sx},${marker.y + (px * Math.sin(angle) + py * Math.cos(angle)) / sy}`;
                    });
                    seat.appendChild(node('polygon', { ...attrs, points: corners.join(' ') }));
                } else if (outlineOnly || marker.shape === 'rect') seat.appendChild(node('rect', { ...attrs, x: marker.x - w / 2, y: marker.y - h / 2, width: w, height: h, rx: .3 }));
                else seat.appendChild(node('circle', { ...attrs, cx: marker.x, cy: marker.y, r: 1.4 }));
                if (!outlineOnly || marker.labelSource === 'auto') seat.appendChild(node('text', { x: marker.x, y: marker.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': options.cleanLayout || outlineOnly ? cleanFontSize : Math.min(1.3, h * .5),
                    ...(outlineOnly ? { fill: '#fff', stroke: '#161616', 'stroke-width': cleanFontSize * .21, 'paint-order': 'stroke' } : { fill: '#143b24' }), 'pointer-events': 'none' }, marker.number || marker.label || '?'));
                if (options.onSeatSelect || options.onCategorySelect) {
                    const activate = event => { if (disabled) return; if (options.onCategorySelect) { if (marker.categoryId) options.onCategorySelect(marker.categoryId); } else options.onSeatSelect(id, marker.label, event, markerId); };
                    seat.setAttribute('role', 'button'); seat.setAttribute('tabindex', disabled ? '-1' : '0');
                    seat.setAttribute('aria-disabled', String(disabled));
                    seat.setAttribute('aria-pressed', String(options.selectedSeatIds ? options.selectedSeatIds.includes(markerId) : !!(id === options.selectedSectionId && marker.label && marker.label === options.selectedSeatLabel)));
                    seat.addEventListener('click', activate);
                    seat.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(event); } });
                }
                svg.appendChild(seat);
            });
        });
        if (!scanned) {
            svg.appendChild(node('rect', { x: 50.5, y: standing ? 37 : 28, width: 3, height: 4, fill: '#777f87', stroke: '#cbd1d6', 'stroke-width': '.2' }));
            svg.appendChild(node('text', { x: 52, y: standing ? 39.5 : 30.5, 'text-anchor': 'middle', fill: '#ffffff', 'font-size': .9 }, 'FOH'));
        }
        container.appendChild(svg);
        window.tsSeatMapInteractions?.attach(svg, options, page);
    },
    showMissingStage: function(container) {
        const message = document.createElement('p');
        message.className = 'ts-stage-not-detected small secondary text-center';
        message.setAttribute('role', 'status');
        message.textContent = 'Stage position was not detected in the floor plan. Use a clear STAGE label and scan again.';
        container.appendChild(message);
    },
    getSectionPositions: function(count) {
        if (!Number.isInteger(count) || count < 1) return [];
        const columns = 2;
        const rows = Math.ceil(count / columns);
        const padding = 8;
        const topStart = 22;
        const availableHeight = 72;
        const height = Math.min(20, Math.floor(availableHeight / rows) - 4);
        const gap = Math.max(2, Math.floor((availableHeight - height * rows) / (rows + 1)));
        const width = (100 - padding * 2 - 4) / columns;
        return Array.from({ length: count }, (_, index) => ({
            left: index % columns === 0 ? padding : 100 - padding - width,
            top: topStart + Math.floor(index / columns) * (height + gap),
            width,
            height
        }));
    },
    renderBoard: function(containerId, sectionsArray, options = {}) {
        const container = document.getElementById(containerId);
        if (!container || !Array.isArray(sectionsArray)) return;
        container.replaceChildren();
        container.classList.toggle('ts-clean-venue-board', options.cleanLayout === true);
        container.classList.toggle('ts-venue-fit', options.fitContainer === true);
        container.classList.toggle('ts-geometry-board', !!(options.backgroundUrl || options.backgroundUrls) || sectionsArray.some(s => s.geometry?.type === 'polygon'));
        if (options.backgroundUrl || options.backgroundUrls || sectionsArray.some(s => s.geometry?.type === 'polygon')) {
            this.renderGeometry(container, sectionsArray, options);
            return;
        }
        container.style.aspectRatio = '';
        if (!sectionsArray.length) return;
        this.showMissingStage(container);
        const positions = this.getSectionPositions(sectionsArray.length);
        sectionsArray.forEach((section, index) => {
            const interactive = typeof options.onSectionSelect === 'function';
            const sectionId = String(section.sectionId || section.letter || section.id || index);
            const box = document.createElement(interactive ? 'button' : 'div');
            box.className = 'ts-generated-section';
            const position = positions[index];
            box.style.cssText = `left:${position.left}%;top:${position.top}%;width:${position.width}%;height:${position.height}%;position:absolute;`;
            box.dataset.sectionId = sectionId;
            if (interactive) {
                box.type = 'button';
                box.setAttribute('aria-pressed', String(sectionId === options.selectedSectionId));
                box.addEventListener('click', () => options.onSectionSelect(sectionId));
            }
            const content = document.createElement('div');
            content.className = 'ts-generated-section-content';
            const name = document.createElement('strong');
            name.textContent = section.name || 'Section ' + sectionId;
            const seats = document.createElement('span');
            seats.textContent = `${section.seatCount ?? section.seats ?? 0} seats`;
            content.append(name, seats);
            box.appendChild(content);
            container.appendChild(box);
        });
    }
};
