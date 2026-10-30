(function () {
    window.tsOrganizerSeatCategories = function ({ venue, categories, editing, changed, isBusy }) {
        const model = window.tsSeatCategories, el = id => document.getElementById(id);
        if (!model || !model.seats(venue.sections).length) return null;
        el('seat-category-controls').hidden = false;
        el('legacy-category-note').hidden = true;
        el('catQuantity').readOnly = true;
        const seats = model.seats(venue.sections), selected = new Set();
        let categoryId = '', color = model.colors[categories().length % model.colors.length], viewport = [0, 0, 104, 106];
        const used = () => new Set(categories().filter((c, i) => i !== editing()).flatMap(c => model.labels(c, venue.sections)));
        const newId = () => 'CAT_' + (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`).replace(/-/g, '');
        const option = (parent, value, text) => { const node = document.createElement('option'); node.value = value; node.textContent = text; parent.appendChild(node); };
        function rows() {
            const section = el('catSection').value, select = el('category-row'); select.replaceChildren();
            option(select, '', 'All rows');
            [...new Set(seats.filter(s => (s.section.sectionId || s.section.letter) === section).map(s => s.marker.row || s.marker.label.match(/^[A-Z]+/)?.[0] || ''))].filter(Boolean)
                .forEach(row => option(select, row, `Row ${row}`));
            range();
        }
        function range() {
            const section = el('catSection').value, row = el('category-row').value;
            const available = seats.filter(s => (s.section.sectionId || s.section.letter) === section && (!row || (s.marker.row || s.marker.label.match(/^[A-Z]+/)?.[0]) === row));
            ['category-from', 'category-to'].forEach(id => { el(id).replaceChildren(); available.forEach(s => option(el(id), s.label, s.marker.label)); });
            if (available.length) el('category-to').value = available.at(-1).label;
        }
        function update() {
            el('catQuantity').value = selected.size || '';
            el('category-selected-count').textContent = `${selected.size} seats selected`;
            el('category-color').value = color;
            render();
        }
        function render() {
            const blocked = used();
            const projected = model.project(venue.sections, categories()).map(section => ({ ...section, geometry: section.geometry ? { ...section.geometry,
                seatMarkers: section.geometry.seatMarkers.map(marker => {
                    const label = `${section.sectionId || section.letter}-${marker.label}`;
                    return { ...marker, id: label, color: selected.has(label) ? color : marker.color, status: blocked.has(label) ? 'BLOCKED' : 'AVAILABLE' };
                })
            } : undefined }));
            window.tsVenueRenderer.renderBoard('mini-venue-board', projected, { cleanLayout: true, fitContainer: true, seatOnly: true, selectedSeatIds: [...selected], viewport, editTool: 'select', selectionOnly: true,
                onViewportChange: value => { viewport = value; },
                onSeatSelect: (sectionId, label) => {
                    if (isBusy()) return;
                    const full = `${sectionId}-${label}`;
                    if (blocked.has(full)) return;
                    if (selected.has(full)) selected.delete(full); else selected.add(full);
                    update(); changed();
                },
                onSelectBox: (box, append, page) => {
                    if (isBusy()) return;
                    if (!append) selected.clear();
                    seats.filter(s => !blocked.has(s.label) && (s.section.geometry.page || 1) === page && s.marker.x >= box.x && s.marker.x <= box.x + box.width && s.marker.y >= box.y && s.marker.y <= box.y + box.height).forEach(s => selected.add(s.label));
                    update(); changed();
                }
            });
        }
        el('catSection').addEventListener('change', rows);
        el('category-row').addEventListener('change', range);
        el('category-select-range').addEventListener('click', () => {
            if (isBusy()) return;
            const blocked = used(), from = el('category-from').value, to = el('category-to').value;
            const options = Array.from(el('category-from').options).map(o => o.value), a = options.indexOf(from), b = options.indexOf(to);
            if (a < 0 || b < 0) return;
            options.slice(Math.min(a, b), Math.max(a, b) + 1).filter(label => !blocked.has(label)).forEach(label => selected.add(label));
            update(); changed();
        });
        el('category-clear-seats').addEventListener('click', () => { if (!isBusy()) { selected.clear(); update(); changed(); } });
        el('category-color').addEventListener('input', () => { if (!isBusy()) { color = el('category-color').value; render(); changed(); } });
        const zoom = factor => { const w = Math.max(6.5, Math.min(104, viewport[2] * factor)), h = w * 106 / 104; viewport = [Math.max(0, viewport[0] + (viewport[2] - w) / 2), Math.max(0, viewport[1] + (viewport[3] - h) / 2), w, h]; render(); };
        el('category-zoom-in').addEventListener('click', () => zoom(.75));
        el('category-zoom-out').addEventListener('click', () => zoom(4 / 3));
        el('category-fit').addEventListener('click', () => { viewport = [0, 0, 104, 106]; render(); });
        rows();
        return {
            render,
            value() { categoryId ||= newId(); return { sectionId: categoryId, seatLabels: [...selected].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), color }; },
            clear() { categoryId = ''; selected.clear(); color = model.colors[categories().length % model.colors.length]; rows(); update(); },
            edit(category) {
                categoryId = category.sectionId || ''; color = category.color || model.colors[Math.max(0, editing()) % model.colors.length];
                selected.clear(); model.labels(category, venue.sections).forEach(label => selected.add(label));
                const first = seats.find(s => selected.has(s.label));
                if (first) el('catSection').value = first.section.sectionId || first.section.letter;
                rows(); update();
            }
        };
    };
})();
