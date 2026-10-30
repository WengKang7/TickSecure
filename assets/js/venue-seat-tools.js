(function () {
    const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
    window.tsVenueSeatTools = { mount(board, data, options, callbacks) {
        const model = window.tsSeatLayout;
        if (!model || options.readOnly) return null;
        window._tsDisposeSeatTools?.();
        const excluded = model.pruneNonSeats(data);
        const currentSeats = model.entries(data);
        const oldAutoNumbering = currentSeats.some(item => item.section.geometry.numbering?.mode === 'nearest-stage')
            && currentSeats.every(item => item.marker.labelSource === 'auto');
        if (excluded || oldAutoNumbering || currentSeats.some(item => !item.marker.label || !item.marker.row || !item.marker.number)) model.autoNumber(data);
        model.ensureIds(data);
        const old = document.getElementById('layout-seat-tools'); old?.remove();
        const host = element('section', 'ts-seat-tools'); host.id = 'layout-seat-tools'; board.before(host);
        const selected = new Set(), history = [], viewports = new Map(); let mode = 'select', serial = 0, stagePoint;
        const initial = data.find(s => s.geometry)?.geometry || { imageWidth: options.imageWidth || 104, imageHeight: options.imageHeight || 106, page: 1 };
        const source = () => callbacks.getSection()?.geometry || initial;
        const page = () => source().page || 1;
        const status = element('p', 'small muted mt-8'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
        const error = element('p', 'small ts-seat-tools-error'); error.setAttribute('role', 'alert');
        const toolbar = element('div', 'ts-seat-simple-toolbar');
        const corrections = element('details', 'ts-seat-tool-details ts-seat-corrections');
        corrections.appendChild(element('summary', '', 'Adjust layout'));
        const correctionButtons = element('div', 'ts-seat-tool-buttons mt-12');
        corrections.appendChild(correctionButtons);
        const modes = [];
        const button = (label, action) => { const node = element('button', 'ts-btn ts-btn-secondary', label); node.type = 'button'; node.onclick = action; return node; };
        const update = section => { model.ensureIds(data); error.textContent = ''; callbacks.changed(section); sync(); };
        const commit = action => {
            const snapshot = JSON.stringify(data);
            try { const target = action(); if (model.entries(data).length > 3000) throw new Error('A layout supports up to 3,000 positioned seats.'); history.push(snapshot); if (history.length > 20) history.shift(); update(target); }
            catch (failure) { data.splice(0, data.length, ...JSON.parse(snapshot)); callbacks.changed(); sync(); error.textContent = failure.message; }
        };
        const selection = () => model.entries(data).filter(item => selected.has(item.id));
        const dirty = section => { section.geometry.reviewed = false; section.seats = section.seatCount = section.geometry.seatMarkers.length; section.geometry = model.bounds(section.geometry.seatMarkers, section.geometry); };
        const setMode = value => { mode = value; callbacks.redraw(); sync(); };
        [['Select', 'select'], ['Pan', 'pan'], ['Add seat', 'add'], ['Pick stage', 'stage']].forEach(([label, value]) => { const node = button(label, () => setMode(value)); node.dataset.mode = value; modes.push(node); correctionButtons.appendChild(node); });
        const remove = () => commit(() => {
            data.forEach(section => { if (!section.geometry?.seatMarkers) return; section.geometry.seatMarkers = section.geometry.seatMarkers.filter(marker => !selected.has(marker.id)); dirty(section); });
            for (let i = data.length - 1; i >= 0; i--) if (data[i].geometry?.seatMarkers?.length === 0) data.splice(i, 1);
            selected.clear();
        });
        const deleteButton = button('Delete selected', remove);
        const undo = button('Undo', () => { if (!history.length) return; data.splice(0, data.length, ...JSON.parse(history.pop())); selected.clear(); update(); });
        const zoom = factor => { const box = viewports.get(page()) || [0, 0, 104, 106]; const w = Math.min(104, Math.max(6.5, box[2] * factor)), h = w / 104 * 106; viewports.set(page(), [Math.max(0, Math.min(104 - w, box[0] + (box[2] - w) / 2)), Math.max(0, Math.min(106 - h, box[1] + (box[3] - h) / 2)), w, h]); callbacks.redraw(); sync(); };
        correctionButtons.appendChild(button('Select all', () => { setMode('select'); selected.clear(); model.entries(data).filter(item => (item.section.geometry.page || 1) === page()).forEach(item => selected.add(item.id)); callbacks.redraw(); sync(); }));
        correctionButtons.append(deleteButton, undo, button('Zoom in', () => zoom(.75)), button('Zoom out', () => zoom(1.333333)), button('Fit', () => { viewports.delete(page()); callbacks.redraw(); sync(); }));
        toolbar.appendChild(status); host.append(toolbar, error);
        correctionButtons.appendChild(button('Renumber rows', () => commit(() => { model.autoNumber(data); })));
        function field(parent, label, value, choices) {
            const wrapper = element('label', 'ts-seat-tool-field', label), input = element(choices ? 'select' : 'input', 'ts-input');
            if (choices) choices.forEach(([key, name]) => { const option = element('option', '', name); option.value = key; input.appendChild(option); });
            input.value = String(value); wrapper.appendChild(input); parent.appendChild(wrapper); return input;
        }
        function number(parent, label, value, minimum, maximum, step = '1') { const input = field(parent, label, value); input.type = 'number'; input.min = String(minimum); input.max = String(maximum); input.step = step; return input; }
        const group = element('section', 'ts-seat-number-panel'); group.id = 'layout-seat-numbering'; group.hidden = true;
        const numberButton = button('Change numbering', () => {
            setMode('select'); group.hidden = !group.hidden;
            numberButton.setAttribute('aria-expanded', String(!group.hidden));
        });
        numberButton.className = 'ts-btn ts-btn-primary'; numberButton.setAttribute('aria-controls', group.id); numberButton.setAttribute('aria-expanded', 'false');
        correctionButtons.appendChild(numberButton);
        const groupForm = element('form', 'ts-seat-tool-form'); group.appendChild(groupForm);
        const target = field(groupForm, 'Section name', callbacks.getSection()?.name || 'Main'); target.maxLength = 80;
        const numberingDetails = element('details', 'ts-seat-tool-details ts-numbering-options');
        numberingDetails.appendChild(element('summary', '', 'More numbering options'));
        const numberingForm = element('div', 'ts-seat-tool-form'); numberingDetails.appendChild(numberingForm);
        const groupMode = field(numberingForm, 'Row layout', 'straight', [['straight', 'Straight'], ['arc', 'Curved around stage']]);
        const rowStyle = field(numberingForm, 'Row labels', 'letters', [['letters', 'A, B, C'], ['numbers', '1, 2, 3']]);
        const firstRow = number(numberingForm, 'First row index', 1, 1, 500);
        const numbering = field(numberingForm, 'Seat numbering', 'ltr', [['ltr', 'Left to right'], ['rtl', 'Right to left'], ['centre_odd_even', 'Odd left / even right']]);
        const start = number(groupForm, 'Starting seat', 1, 0, 9999), step = field(numberingForm, 'Number step', '1', [['1', '1'], ['2', '2']]);
        const reverse = field(numberingForm, 'Row order', 'false', [['false', 'Front to back'], ['true', 'Back to front']]);
        const groupingOptions = () => ({ mode: groupMode.value, rowStyle: rowStyle.value, firstRow: Number(firstRow.value), numbering: numbering.value, start: Number(start.value), step: Number(step.value), reverse: reverse.value === 'true', cx: stagePoint?.page === page() ? stagePoint.x : undefined, cy: stagePoint?.page === page() ? stagePoint.y : undefined });
        const applyGroup = button('Apply numbers', () => commit(() => {
            const grouped = model.regroup(data, [...selected], target.value, groupingOptions()); selected.clear(); grouped.geometry.seatMarkers.forEach(marker => selected.add(marker.id)); return grouped;
        })); groupForm.appendChild(applyGroup); group.appendChild(numberingDetails);
        groupForm.addEventListener('submit', event => { event.preventDefault(); applyGroup.click(); });
        const generate = element('details', 'ts-seat-tool-details'); generate.appendChild(element('summary', '', 'Generate a straight row or an arc'));
        const generateForm = element('form', 'ts-seat-tool-form'); generate.appendChild(generateForm);
        const genMode = field(generateForm, 'Layout', 'straight', [['straight', 'Straight rows'], ['arc', 'Curved rows']]);
        const genCount = number(generateForm, 'Seats per row', 12, 1, 300), genRows = number(generateForm, 'Rows', 1, 1, 100);
        const genX = number(generateForm, 'Origin / centre left (%)', 10, 0, 100, '.1'), genY = number(generateForm, 'Origin / centre top (%)', 20, 0, 100, '.1');
        const genSpacing = number(generateForm, 'Seat spacing (px)', 18, 1, 500), genPitch = number(generateForm, 'Row spacing (px)', 25, 1, 500);
        const genRadius = number(generateForm, 'First radius (px)', 100, 1, 5000), genA = number(generateForm, 'Start angle', 210, -360, 360), genB = number(generateForm, 'End angle', 330, -360, 360);
        function ensureSection() {
            const currentGeometry = source();
            let section = callbacks.getSection();
            if (!section || section.geometry?.kind === 'standing') {
                let letter = 'MANUAL_SEATS', suffix = 2; while (data.some(s => s.letter === letter)) letter = `MANUAL_SEATS_${suffix++}`;
                section = { id: 'sec-' + letter, letter, name: 'Manual seats', seats: 0, geometry: { ...currentGeometry, seatMarkers: [], decorations: [] } }; data.push(section);
            }
            section.geometry = { ...initial, ...section.geometry, type: 'polygon', layout: 'ocr', kind: 'seated', source: 'shape-detection', reviewed: false, seatMarkers: section.geometry?.seatMarkers || [], fill: section.geometry?.fill || '#a8d5c1' };
            return section;
        }
        const applyGenerate = button('Generate seats', () => commit(() => {
            const geometry = source(), section = ensureSection();
            const markers = model.generate({ mode: genMode.value, count: Number(genCount.value), rows: Number(genRows.value), x: Number(genX.value) / 100 * 104, y: Number(genY.value) / 100 * 106,
                spacing: Number(genSpacing.value), rowSpacing: Number(genPitch.value), radius: Number(genRadius.value), startAngle: Number(genA.value), endAngle: Number(genB.value) }, geometry);
            section.geometry.seatMarkers.push(...markers); selected.clear(); model.ensureIds(data); markers.forEach(marker => selected.add(marker.id));
            const origin = { x: Number(genX.value) / 100 * 104, y: Number(genY.value) / 100 * 106 };
            return model.regroup(data, [...selected], target.value, { ...groupingOptions(), mode: genMode.value, cx: origin.x, cy: origin.y });
        })); generateForm.appendChild(applyGenerate); generateForm.addEventListener('submit', event => { event.preventDefault(); applyGenerate.click(); });
        const edit = element('details', 'ts-seat-tool-details'); edit.appendChild(element('summary', '', 'Edit selected seat'));
        const editForm = element('form', 'ts-seat-tool-form'); edit.appendChild(editForm);
        const editRow = field(editForm, 'Row', ''), editNumber = field(editForm, 'Seat number', ''); editRow.maxLength = 10; editNumber.maxLength = 10;
        const editX = number(editForm, 'Left (%)', 0, 0, 100, '.1'), editY = number(editForm, 'Top (%)', 0, 0, 100, '.1');
        const editW = number(editForm, 'Width (px)', 12, 1, 500), editH = number(editForm, 'Height (px)', 12, 1, 500);
        const editAngle = number(editForm, 'Rotation', 0, -360, 360, '.1'), editShape = field(editForm, 'Seat shape', 'rect', [['rect', 'Box'], ['circle', 'Circle']]);
        const applyEdit = button('Save seat', () => commit(() => {
            const list = selection(); if (list.length !== 1) throw new Error('Select one seat to edit.');
            const { marker, section } = list[0], row = editRow.value.trim().toUpperCase(), number = editNumber.value.trim().toUpperCase(), label = row + (/^\d+$/.test(row) ? '-' : '') + number;
            if (!/^[A-Z0-9_-]{1,10}$/.test(row) || !/^[A-Z0-9_-]{1,10}$/.test(number) || !/^[A-Z0-9_-]{1,40}$/.test(label)) throw new Error('Enter a valid row and seat number.');
            if (section.geometry.seatMarkers.some(other => other !== marker && other.label === label)) throw new Error('That seat label already exists in this section.');
            const width = Number(editW.value), height = Number(editH.value), x = Number(editX.value) / 100 * 104, y = Number(editY.value) / 100 * 106, rotation = Number(editAngle.value);
            if (![x,y,width,height,rotation].every(Number.isFinite) || x < 0 || x > 104 || y < 0 || y > 106 || width <= 0 || height <= 0 || width > 500 || height > 500) throw new Error('Check the seat position and dimensions.');
            Object.assign(marker, { row, number, label, x, y, width: width / (section.geometry.imageWidth || 104) * 104, height: height / (section.geometry.imageHeight || 106) * 106, rotation, shape: editShape.value, labelSource: 'manual' });
            dirty(section); return section;
        })); editForm.appendChild(applyEdit); editForm.addEventListener('submit', event => { event.preventDefault(); applyEdit.click(); });
        corrections.append(generate, edit);
        host.append(group, corrections);
        corrections.ontoggle = () => { if (!corrections.open && mode !== 'select') setMode('select'); };
        function sync() {
            const existing = new Set(model.entries(data).map(item => item.id)); selected.forEach(id => { if (!existing.has(id)) selected.delete(id); });
            const list = selection(), unlabelled = model.entries(data).filter(item => !item.marker.row || !item.marker.number).length;
            const total = model.entries(data).length, fallback = data.some(section => section.geometry?.numbering?.stageSource === 'top');
            status.textContent = unlabelled ? `${unlabelled} seats need attention` : `${total} seats numbered automatically${fallback ? ' · row by row from the top' : ' · row by row from the stage'}`;
            modes.forEach(node => node.setAttribute('aria-pressed', String(node.dataset.mode === mode)));
            numberButton.disabled = !list.length; deleteButton.disabled = !list.length; undo.disabled = !history.length; applyGroup.disabled = !list.length; applyEdit.disabled = list.length !== 1;
            if (list.length === 1) {
                const { marker, section } = list[0], g = section.geometry;
                editRow.value = marker.row || marker.label?.match(/^[A-Z]+/)?.[0] || ''; editNumber.value = marker.number || marker.label?.match(/\d+[A-Z]?$/)?.[0] || '';
                editX.value = (marker.x / 104 * 100).toFixed(1); editY.value = (marker.y / 106 * 100).toFixed(1);
                editW.value = ((marker.width || 2.8) / 104 * (g.imageWidth || 104)).toFixed(1); editH.value = ((marker.height || 2.8) / 106 * (g.imageHeight || 106)).toFixed(1);
                editAngle.value = marker.rotation || 0; editShape.value = marker.shape || 'rect';
            }
        }
        const keydown = event => {
            if (event.target?.closest?.('input,select,textarea,[contenteditable="true"]') || !selected.size) return;
            if (['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); remove(); }
        };
        document.addEventListener?.('keydown', keydown);
        const dispose = () => document.removeEventListener?.('keydown', keydown); window._tsDisposeSeatTools = dispose;
        sync();
        return { sync, dispose, selected, setMode, remove,
            selectSeat(sectionId, label, event, markerId) {
                const entry = model.entries(data).find(item => markerId ? item.id === markerId : item.section.letter === sectionId && item.marker.label === label);
                if (!entry) return; if (!event?.shiftKey) selected.clear();
                if (event?.shiftKey && selected.has(entry.id)) selected.delete(entry.id); else selected.add(entry.id); sync();
            },
            mapOptions() { return { editTool: mode, selectedSeatIds: [...selected], viewport: viewports.get(page()) || [0,0,104,106],
                onViewportChange: viewport => { viewports.set(page(), viewport); },
                onStagePoint: (point, selectedPage) => commit(() => { stagePoint = { ...point, page: selectedPage }; model.autoNumber(data, { stagePoint }); setMode('select'); }),
                onAddSeat: point => commit(() => {
                    if (point.x < 0 || point.x > 104 || point.y < 0 || point.y > 106) throw new Error('Add seats inside the image.');
                    const section = ensureSection(), g = section.geometry;
                    const marker = { id: `added_${Date.now().toString(36)}_${++serial}`, label: '', row: '', number: '', x: point.x, y: point.y,
                        width: model.median(g.seatMarkers.map(s => s.width)) || 12 / (g.imageWidth || 104) * 104, height: model.median(g.seatMarkers.map(s => s.height)) || 12 / (g.imageHeight || 106) * 106,
                        rotation: 0, shape: 'rect', labelSource: 'manual', confidence: 0 };
                    g.seatMarkers.push(marker); selected.clear(); selected.add(marker.id); dirty(section); return section;
                }),
                onSelectBox: (box, append, selectedPage) => {
                    if (!append) selected.clear(); model.entries(data).forEach(item => { const s = item.marker; if ((item.section.geometry.page || 1) === selectedPage && s.x >= box.x && s.x <= box.x + box.width && s.y >= box.y && s.y <= box.y + box.height) selected.add(item.id); });
                    callbacks.redraw(); sync();
                },
                onMoveSeats: (markerId, dx, dy) => commit(() => {
                    if (!selected.has(markerId)) { selected.clear(); selected.add(markerId); }
                    const list = selection(); if (list.some(({ marker: s }) => s.x + dx < 0 || s.x + dx > 104 || s.y + dy < 0 || s.y + dy > 106)) throw new Error('Keep the selected seats inside the image.');
                    list.forEach(({ marker, section }) => { marker.x += dx; marker.y += dy; dirty(section); });
                })
            }; }
        };
    } };
})();
