(function () {
    window.tsSeatMapInteractions = { attach(svg, options, page) {
        if (!options.editTool) return;
        const ns = 'http://www.w3.org/2000/svg';
        const viewport = () => (svg.getAttribute('viewBox') || '0 0 104 106').split(/\s+/).map(Number);
        const point = event => {
            const box = svg.getBoundingClientRect(), [x, y, w, h] = viewport();
            return { x: x + (event.clientX - box.left) / box.width * w, y: y + (event.clientY - box.top) / box.height * h };
        };
        let gesture, suppressClick = false;
        svg.style.touchAction = 'none';
        svg.addEventListener('click', event => { if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; } }, true);
        svg.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            const origin = point(event), marker = event.target.closest?.('[data-seat-id]');
            if (options.editTool === 'add') { event.preventDefault(); options.onAddSeat?.(origin, page); return; }
            if (options.editTool === 'stage') { event.preventDefault(); options.onStagePoint?.(origin, page); return; }
            const type = options.editTool === 'pan' ? 'pan' : marker && !options.selectionOnly ? 'move' : 'box';
            gesture = { type, origin, initial: viewport(), id: marker?.getAttribute('data-seat-id'), section: event.target.closest?.('[data-section-id]'), append: event.shiftKey, moved: false, pointerId: event.pointerId };
            if (type === 'box') {
                const box = document.createElementNS(ns, 'rect'); box.setAttribute('class', 'ts-seat-marquee'); box.setAttribute('pointer-events', 'none');
                box.setAttribute('x', origin.x); box.setAttribute('y', origin.y); box.setAttribute('width', 0); box.setAttribute('height', 0); svg.appendChild(box); gesture.box = box;
            }
            event.preventDefault();
        });
        svg.addEventListener('pointermove', event => {
            if (!gesture) return;
            const at = point(event), dx = at.x - gesture.origin.x, dy = at.y - gesture.origin.y;
            if (!gesture.moved && Math.hypot(dx, dy) > .3) { gesture.moved = true; svg.setPointerCapture?.(event.pointerId); }
            if (gesture.type === 'box') {
                gesture.box.setAttribute('x', Math.min(at.x, gesture.origin.x)); gesture.box.setAttribute('y', Math.min(at.y, gesture.origin.y));
                gesture.box.setAttribute('width', Math.abs(dx)); gesture.box.setAttribute('height', Math.abs(dy));
            }
            if (gesture.type === 'pan') {
                const rect = svg.getBoundingClientRect(), current = gesture.initial;
                const vx = current[0] - (event.clientX - (rect.left + (gesture.origin.x - current[0]) / current[2] * rect.width)) / rect.width * current[2];
                const vy = current[1] - (event.clientY - (rect.top + (gesture.origin.y - current[1]) / current[3] * rect.height)) / rect.height * current[3];
                svg.setAttribute('viewBox', `${vx} ${vy} ${current[2]} ${current[3]}`);
            }
            if (gesture.type === 'move' && gesture.moved) svg.style.cursor = 'grabbing';
        });
        const end = event => {
            if (!gesture) return;
            const state = gesture; gesture = null; const at = point(event);
            state.box?.remove(); svg.style.cursor = ''; svg.releasePointerCapture?.(event.pointerId);
            if (state.type === 'pan') { options.onViewportChange?.(viewport()); suppressClick = state.moved; return; }
            if (!state.moved) { if (state.type === 'box' && !state.id && !state.section && !state.append) options.onSelectBox?.({ x: at.x, y: at.y, width: 0, height: 0 }, false, page); return; }
            suppressClick = true;
            if (state.type === 'move') options.onMoveSeats?.(state.id, at.x - state.origin.x, at.y - state.origin.y, page);
            else options.onSelectBox?.({ x: Math.min(at.x, state.origin.x), y: Math.min(at.y, state.origin.y), width: Math.abs(at.x - state.origin.x), height: Math.abs(at.y - state.origin.y) }, state.append, page);
        };
        svg.addEventListener('pointerup', end);
        svg.addEventListener('pointercancel', () => { gesture?.box?.remove(); gesture = null; svg.style.cursor = ''; });
    } };
})();
