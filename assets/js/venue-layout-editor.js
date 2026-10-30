(function () {
    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };
    window.tsVenueLayoutEditor = function (data, venueName, options = {}) {
        let active = 0, seatPage = 0, selectedSeatLabel;
        const review = document.getElementById('dynamic-editor-cards');
        const boardIds = ['dynamic-blueprint-boxes', 'dynamic-generated-board', 'dynamic-step5-board'];
        const board = boardIds.find(id => document.getElementById(id));
        if (!board) return;
        const reviewMode = !!review;
        const editable = reviewMode && !options.readOnly;
        let tools = null;
        const panel = review || el('div', 'ts-seat-inspector');
        if (!review) { const node = document.getElementById(board); if (node.nextElementSibling) node.nextElementSibling.prepend(panel); else node.parentElement.appendChild(panel); }
        const setText = (id, text) => { const node = document.getElementById(id); if (node) node.textContent = text; };
        const select = id => { active = Math.max(0, data.findIndex(s => s.letter === id)); seatPage = 0; selectedSeatLabel = undefined; render(); };
        const invalidate = section => {
            if (section.geometry?.layout === 'ocr') {
                section.geometry.reviewed = false;
                const check = document.getElementById('review-ocr-section'); if (check) check.checked = false;
            }
        };
        const orderedMarkers = section => section.geometry?.seatMarkers ? [...section.geometry.seatMarkers].sort((a, b) => {
            const left = String(a.label || a.number || ''), right = String(b.label || b.number || '');
            if (!left || !right) return left ? -1 : right ? 1 : 0;
            return left.localeCompare(right, 'en', { numeric: true }) || String(a.id || '').localeCompare(String(b.id || ''));
        }) : null;
        const seatLabel = (section, i, marker) => marker
            ? `${section.letter}-${marker.label}` : `${section.letter}${String(i).padStart(2, '0')}`;
        function renderMap() {
            window.tsVenueRenderer.renderBoard(board, data, { ...options, ...tools?.mapOptions(), selectedSectionId: data[active]?.letter, selectedSeatLabel, onSectionSelect: id => { tools?.selected.clear(); select(id); },
                onSeatSelect: (id, label, event, markerId) => {
                    tools?.selectSeat(id, label, event, markerId);
                    select(id);
                    const index = orderedMarkers(data[active]).findIndex(marker => markerId && marker.id ? marker.id === markerId : marker.label === label);
                    if (index < 0) return;
                    selectedSeatLabel = label; seatPage = Math.floor(index / 100); renderMap(); renderPanel();
                    if (!tools || tools.selected.size === 1) panel.querySelectorAll('.ts-seat-choice')[index % 100]?.click();
                } });
        }
        function renderSeats(parent) {
            const section = data[active];
            const standing = section.geometry?.kind === 'standing';
            parent.appendChild(el('h3', 'ts-card-title mt-20', standing ? 'Standing places' : 'Seat preview'));
            if (!section.seats) {
                parent.appendChild(el('p', 'small muted mt-8', 'Enter the verified capacity for this section to preview its places.'));
                return;
            }
            const detectedSeats = orderedMarkers(section);
            parent.appendChild(el('p', 'small muted mt-8', standing ? 'Standing allocations have identifiers, with no fixed seat position.'
                : ['nearest-stage', 'row-by-row'].includes(section.geometry?.numbering?.mode) ? 'Seat numbers are assigned automatically. Click a seat to inspect it.'
                : detectedSeats ? 'Seat labels and positions were read from the uploaded blueprint. Click a seat to inspect it.'
                : 'Click a seat to inspect its identifier. Seat positions within a section are illustrative.'));
            const status = el('div', 'ts-seat-selection small mt-12', 'Choose a place below.');
            status.setAttribute('role', 'status');
            status.setAttribute('aria-live', 'polite');
            const grid = el('div', 'ts-seat-grid mt-12');
            const start = seatPage * 100 + 1, end = Math.min(section.seats, start + 99);
            for (let i = start; i <= end; i++) {
                // Match the physical seat labels produced by activateLayout.
                const marker = detectedSeats?.[i - 1];
                const label = seatLabel(section, i, marker);
                const button = el('button', 'ts-seat-choice', marker ? marker.label || '?' : String(i));
                button.type = 'button';
                button.setAttribute('aria-label', `${standing ? 'Place' : 'Seat'} ${label}`);
                button.setAttribute('aria-pressed', String(Boolean(marker && marker.label === selectedSeatLabel)));
                button.addEventListener('click', () => {
                    if (marker) { selectedSeatLabel = marker.label; tools?.selectSeat(section.letter, marker.label, undefined, marker.id); renderMap(); tools?.sync(); }
                    grid.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
                    status.textContent = `${section.name} · ${standing ? 'Place' : 'Seat'} ${label}`;
                    if (marker && editable && section.geometry.source !== 'shape-detection') {
                        editLabel.value = marker.label; editLabel.hidden = false;
                        editLabel.onchange = () => {
                            const value = editLabel.value.trim().toUpperCase();
                            if (!/^[A-Z0-9_-]{1,40}$/.test(value) || detectedSeats.some(other => other !== marker && other.label === value)) {
                                status.textContent = 'Use a unique seat label with letters, numbers, hyphens or underscores.'; return;
                            }
                            marker.label = value; invalidate(section); renderMap(); renderPanel();
                        };
                    }
                });
                grid.appendChild(button);
            }
            const editLabel = el('input', 'ts-input mt-8'); editLabel.hidden = true; editLabel.maxLength = 40;
            editLabel.setAttribute('aria-label', 'Correct selected OCR seat label');
            parent.append(grid, status, editLabel);
            if (section.seats > 100) {
                const pager = el('div', 'flex justify-between items-center mt-12');
                const previous = el('button', 'ts-btn ts-btn-secondary', 'Previous');
                const next = el('button', 'ts-btn ts-btn-secondary', 'Next');
                previous.type = next.type = 'button';
                previous.disabled = seatPage === 0;
                next.disabled = end >= section.seats;
                previous.onclick = () => { seatPage--; renderPanel(); };
                next.onclick = () => { seatPage++; renderPanel(); };
                pager.append(previous, el('span', 'small muted', `${start}–${end} of ${section.seats}`), next);
                parent.appendChild(pager);
            }
        }
        function renderPanel() {
            panel.replaceChildren();
            if (!data.length) { panel.appendChild(el('p', 'small muted', 'No sections are configured. Run OCR on the uploaded file or add a missing section.')); return; }
            const section = data[active];
            const label = el('label', 'ts-label', 'Selected section');
            label.htmlFor = 'layout-section-select';
            const chooser = el('select', 'ts-input');
            chooser.id = 'layout-section-select';
            data.forEach(s => {
                const option = el('option', '', `${s.name} · ${s.seats} ${s.geometry?.kind === 'standing' ? 'places' : 'seats'}`);
                option.value = s.letter;
                chooser.appendChild(option);
            });
            chooser.value = section.letter;
            chooser.onchange = () => select(chooser.value);
            panel.append(label, chooser);
            if (editable) {
                const nameLabel = el('label', 'ts-label mt-16', 'Section name');
                nameLabel.htmlFor = 'edit-section-name';
                const name = el('input', 'ts-input');
                name.id = 'edit-section-name'; name.value = section.name; name.maxLength = 80;
                name.oninput = () => { section.name = name.value; invalidate(section); chooser.selectedOptions[0].textContent = `${section.name} · ${section.seats} seats`; renderMap(); };
                const countLabel = el('label', 'ts-label mt-16', section.geometry?.kind === 'standing' ? 'Standing capacity' : 'Seat count');
                countLabel.htmlFor = 'edit-section-seats';
                const count = el('input', 'ts-input');
                count.id = 'edit-section-seats'; count.type = 'number'; count.min = '0'; count.max = '100000'; count.step = '1'; count.value = section.seats;
                count.readOnly = !!section.geometry?.seatMarkers;
                const seatPreview = el('div');
                count.oninput = () => {
                    section.seats = Number.isSafeInteger(Number(count.value)) && Number(count.value) >= 0 ? Number(count.value) : 0;
                    invalidate(section);
                    seatPage = 0; renderMap(); renderSummary(); seatPreview.replaceChildren(); renderSeats(seatPreview);
                    chooser.selectedOptions[0].textContent = `${section.name} · ${section.seats} seats`;
                };
                panel.append(nameLabel, name, countLabel, count);
                if (section.geometry?.seatMarkers) {
                    const manual = el('button', 'ts-btn ts-btn-secondary mt-12', 'Use manual capacity instead'); manual.type = 'button';
                    manual.onclick = () => { delete section.geometry.seatMarkers; invalidate(section); render(); };
                    panel.appendChild(manual);
                }
                if (section.geometry?.layout === 'ocr') {
                    const g = section.geometry;
                    panel.appendChild(el('p', 'small muted mt-12', `OCR confidence: ${Math.round(g.confidence || 0)}%. ${g.boundarySource === 'text-bounds' ? 'Only the label boundary was found; adjust it to cover the section.' : 'Check the detected section boundary.'}`));
                    const bounds = el('fieldset', 'ts-ocr-bounds mt-12'); bounds.appendChild(el('legend', 'ts-label', 'Adjust section boundary (%)'));
                    const x = Math.min(...g.points.map(p => p.x)), y = Math.min(...g.points.map(p => p.y));
                    const width = Math.max(...g.points.map(p => p.x)) - x, height = Math.max(...g.points.map(p => p.y)) - y;
                    [['Left', x / 104 * 100], ['Top', y / 106 * 100], ['Width', width / 104 * 100], ['Height', height / 106 * 100]].forEach(([label, value], index) => {
                        const field = el('label', 'small', label), input = el('input', 'ts-input'); input.type = 'number'; input.min = index < 2 ? '0' : '.5'; input.max = '100'; input.step = '.1'; input.value = Math.round(value * 10) / 10;
                        input.onchange = () => {
                            const val = Number(input.value); if (!Number.isFinite(val)) return;
                            const nextX = index === 0 ? Math.min(104 - width, Math.max(0, val / 100 * 104)) : x;
                            const nextY = index === 1 ? Math.min(106 - height, Math.max(0, val / 100 * 106)) : y;
                            const nextW = index === 2 ? Math.min(104 - x, Math.max(.52, val / 100 * 104)) : width;
                            const nextH = index === 3 ? Math.min(106 - y, Math.max(.53, val / 100 * 106)) : height;
                            const move = p => ({ x: nextX + (p.x - x) * nextW / Math.max(width, .01), y: nextY + (p.y - y) * nextH / Math.max(height, .01) });
                            g.points = g.points.map(move); const labelPoint = move({ x: g.labelX, y: g.labelY }); g.labelX = labelPoint.x; g.labelY = labelPoint.y;
                            if (g.seatMarkers) g.seatMarkers = g.seatMarkers.map(marker => ({ ...marker, ...move(marker) }));
                            invalidate(section); render();
                        };
                        field.appendChild(input); bounds.appendChild(field);
                    });
                    const approval = el('label', 'ts-ocr-review mt-16');
                    const checked = el('input'); checked.type = 'checkbox'; checked.id = 'review-ocr-section'; checked.checked = !!g.reviewed;
                    checked.onchange = () => { g.reviewed = checked.checked; };
                    approval.append(checked, el('span', 'small', 'I checked this section, its seat labels and capacity.'));
                    const adjustments = el('details', 'ts-simple-details mt-16'); adjustments.appendChild(el('summary', '', 'Adjust section boundary')); adjustments.appendChild(bounds);
                    panel.append(adjustments, approval);
                }
                const remove = el('button', 'ts-btn ts-btn-secondary mt-12', 'Remove section');
                remove.type = 'button'; remove.disabled = data.length <= 1;
                remove.onclick = () => { data.splice(active, 1); active = Math.min(active, data.length - 1); seatPage = 0; render(); };
                panel.append(remove, seatPreview);
                const seatDetails = el('details', 'ts-simple-details mt-16'); seatDetails.appendChild(el('summary', '', 'Inspect seat identifiers')); seatPreview.appendChild(seatDetails);
                renderSeats(seatDetails);
            } else renderSeats(panel);
        }
        function renderSummary() {
            const total = data.reduce((sum, s) => sum + s.seats, 0);
            setText('dynamic-sections-sub', `${data.length} sections · ${data.filter(s => s.seats > 0).length} capacities entered`);
            ['dynamic-seats-generated', 'dynamic-total-seats', 'dynamic-success-seats'].forEach(id => setText(id, total));
            ['dynamic-sections-completed', 'dynamic-success-sections'].forEach(id => setText(id, data.length));
            setText('dynamic-checklist-sections', `${data.length} physical venue sections confirmed.`);
            setText('dynamic-checklist-seats', `${total} physical places configured.`);
            const rows = document.getElementById('dynamic-generation-rows');
            if (rows) {
                rows.replaceChildren();
                data.forEach(s => {
                    const row = el('button', 'ts-generation-row ts-layout-section-row');
                    row.type = 'button'; row.append(el('strong', '', s.name), el('span', 'small muted', `${s.seats} places`));
                    row.onclick = () => select(s.letter); rows.appendChild(row);
                });
            }
            const preview = document.getElementById('dynamic-seat-preview');
            if (preview) { preview.replaceChildren(); preview.appendChild(el('p', 'small muted', 'Select a section on the map to inspect and click its individual seats. Physical records are created when you activate the layout.')); }
            const summary = document.getElementById('dynamic-activation-summary');
            if (summary) {
                summary.replaceChildren();
                [['Venue', venueName || 'Venue'], ['Sections', data.length], ['Configured places', total], ['Layout status', 'Ready']].forEach(([label, value]) => {
                    const item = el('div', 'ts-activation-item'); item.append(el('span', 'small muted', label), el('strong', '', value)); summary.appendChild(item);
                });
            }
        }
        function render() { renderMap(); renderPanel(); renderSummary(); tools?.sync(); }
        const add = document.getElementById('add-layout-section');
        if (add) { add.disabled = !!options.readOnly; add.onclick = () => {
            if (options.readOnly) return;
            let number = data.length + 1;
            while (data.some(s => s.letter === `S${number}`)) number++;
            const letter = `S${number}`;
            const section = { id: `sec-${letter}`, letter, name: `Section ${number}`, seats: 0 };
            if (options.backgroundUrl || options.backgroundUrls || data.some(s => s.geometry)) {
                const source = data[active]?.geometry || data.find(s => s.geometry)?.geometry;
                section.geometry = { type: 'polygon', layout: source?.layout || 'ocr', fill: '#c3a47e', kind: 'seated', confidence: 0, reviewed: false,
                    page: source?.page || 1, imageWidth: source?.imageWidth || options.imageWidth || 104, imageHeight: source?.imageHeight || options.imageHeight || 106,
                    points: [{ x: 3, y: 3 }, { x: 19, y: 3 }, { x: 19, y: 9 }, { x: 3, y: 9 }], labelX: 11, labelY: 6 };
            }
            data.push(section); active = data.length - 1; seatPage = 0; render();
        };
        }
        if (editable && window.tsVenueSeatTools) tools = window.tsVenueSeatTools.mount(document.getElementById(board), data, options, {
            getSection: () => data[active],
            redraw: () => renderMap(),
            changed: section => { if (section) active = data.indexOf(section); active = Math.max(0, Math.min(active, data.length - 1)); selectedSeatLabel = undefined; render(); }
        });
        window._tsSyncActiveInputs = () => {};
        render();
        return { tools, render };
    };
})();
