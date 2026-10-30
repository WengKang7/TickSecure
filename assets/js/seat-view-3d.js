// Perspective canvas renderer. Audience motion runs only while enabled and visible.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./seat-view-model'), require('./seat-view-people'));
    else root.tsSeatView3D = factory(root.tsSeatViewModel, root.tsSeatViewPeople);
})(typeof window === 'object' ? window : globalThis, function (Model, People) {
    'use strict';
    const palette = { available: [61,137,115], selected: [54,147,226], unavailable: [149,162,169], context: [196,204,201],
        stage: [36,49,53], backdrop: [28,42,47], floor: [234,231,220], floorBase: [186,184,174], support: [55,68,68],
        wood: [186,151,106], trim: [194,161,108], light: [253,222,154], screen: [24,63,66] };
    const shade = (color, light) => `rgb(${color.map(v => Math.min(255, Math.round(v * light))).join(',')})`;
    const polygon = (ctx, points) => { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); };
    function roundedRect(ctx, x, y, w, h, radius) {
        const r = Math.min(radius, w / 2, h / 2);
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    }
    const inside = (x, y, points) => {
        let yes = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const a = points[i], b = points[j];
            if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) yes = !yes;
        }
        return yes;
    };

    function draw(ctx, scene, state, width, height) {
        const selected = new Set(state.selected || []), firstPerson = !!state.viewSeatId;
        const camera = firstPerson ? Model.seatCamera(scene, state.viewSeatId, state.look) : Model.overviewCamera(scene, width / height, state.orbit);
        if (!camera) return [];
        ctx.clearRect(0, 0, width, height);
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, firstPerson ? '#dae5e5' : '#fafaf7'); sky.addColorStop(.6, '#f0f2ed'); sky.addColorStop(1, '#e5eae4');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
        const projected = [], hits = [], focal = height / (2 * Math.tan(camera.fov / 2));
        const projectPolygon = points => Model.clipNear(points.map(p => Model.cameraPoint(p, camera)), camera.near).map(p => Model.screenPoint(p, camera, width, height));
        const panelDepth = Model.cameraPoint([scene.stage.x + scene.stage.front[0] * (-scene.stage.depth / 2 + .1), 2.35,
            scene.stage.z + scene.stage.front[2] * (-scene.stage.depth / 2 + .1)], camera)[2];
        const seatSizes = scene.seats.map(seat => {
            const p = Model.cameraPoint([seat.x, .8, seat.z], camera);
            if (p[2] < -1.5) return 0;
            const size = focal / Math.max(.08, p[2]), screen = Model.screenPoint(p, camera, width, height);
            if (p[2] > 2 && (screen.x < -size * 2 || screen.x > width + size * 2 || screen.y < -size * 2 || screen.y > height + size * 2)) return 0;
            return size;
        });
        // Choose whole mesh groups before projecting, so large venues stay responsive.
        const audience = new Set(People?.seatIndices(scene, state) || []);
        const groups = [scene.meshes.venueFaces, ...scene.seats.map((seat,i) =>
            !seatSizes[i] || seat.id && seat.id === state.viewSeatId ? [] : seatSizes[i] < 14 ? scene.meshes.distantFaces[i] : scene.meshes.chairFaces[i])];
        if (audience.size) groups.push(People.buildFaces(scene, [...audience], state.peopleTime || 0, seatSizes));
        for (const group of groups) for (const face of group) {
            const seat = scene.seats[face.seatIndex];
            if (seat?.id && seat.id === state.viewSeatId) continue;
            // Keep all chairs pickable, but omit small hardware at distant zoom levels.
            if (seat && face.kind !== 'person' && (!seatSizes[face.seatIndex] || seatSizes[face.seatIndex] < 7 && face.part !== 'backrest' || seatSizes[face.seatIndex] < 24 && face.kind === 'support')) continue;
            if (Model.dot(face.normal, Model.subtract(camera.eye, face.center)) <= 0) continue;
            const points = projectPolygon(face.points);
            if (points.length < 3 || points.every(p => p.x < 0) || points.every(p => p.x > width) || points.every(p => p.y < 0) || points.every(p => p.y > height)) continue;
            let depth = points.reduce((sum, p) => sum + p.depth, 0) / points.length;
            // Coplanar backdrop decorations share the panel's depth, preventing the
            // wide panel from painting over its own trim when the camera rotates.
            if (face.kind === 'backdrop' && Model.dot(face.normal,scene.stage.front) > .99) depth = panelDepth + .002;
            if (face.kind === 'screen') depth = panelDepth + .001;
            if (face.kind === 'trim') depth = panelDepth;
            projected.push({ face, points, depth: face.kind === 'floor' || face.kind === 'floorBase' ? Infinity : depth });
        }
        // Draw a soft silhouette under the model; it never participates in picking.
        if (!firstPerson) {
            const base = projected.find(item => item.face.kind === 'floor');
            if (base) { ctx.save(); polygon(ctx, base.points.map(p => ({ x: p.x + 5, y: p.y + 10 }))); ctx.shadowColor = '#203c3430'; ctx.shadowBlur = 24; ctx.fillStyle = '#203c3415'; ctx.fill(); ctx.restore(); }
        }
        projected.sort((a, b) => b.depth - a.depth);
        for (const item of projected) {
            const { face, points } = item, seat = scene.seats[face.seatIndex];
            let color = face.color || palette[face.kind] || palette.available;
            if (face.kind === 'chair') color = seat.status === 'CONTEXT' ? palette.context : selected.has(seat.id) ? palette.selected : ['AVAILABLE','MINE'].includes(seat.status) ? palette.available : palette.unavailable;
            const light = .69 + Math.max(0, Model.dot(face.normal, [-.38,.83,.4])) * .38;
            polygon(ctx, points);
            if (face.kind === 'screen') {
                const ys = points.map(p => p.y), glow = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
                glow.addColorStop(0, '#285557'); glow.addColorStop(.55, '#183b40'); glow.addColorStop(1, '#112b32'); ctx.fillStyle = glow;
            } else if (face.kind === 'floor') {
                const surface = ctx.createLinearGradient(0, 0, width, height); surface.addColorStop(0, '#f1eee4'); surface.addColorStop(1, '#dddcd0'); ctx.fillStyle = surface;
            } else if (face.kind === 'chair' && face.points.length > 4 && seatSizes[face.seatIndex] >= 20) {
                const ys = points.map(p => p.y), fabric = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
                fabric.addColorStop(0, shade(color, light * 1.14)); fabric.addColorStop(.28, shade(color, light * 1.04)); fabric.addColorStop(1, shade(color, light * .91)); ctx.fillStyle = fabric;
            } else ctx.fillStyle = shade(color, face.kind === 'light' ? 1 : light);
            ctx.fill();
            ctx.strokeStyle = shade(color, light * .97); ctx.lineWidth = .45; ctx.lineJoin = 'round'; ctx.stroke();
            if (face.kind === 'chair' && face.points.length > 4 && seatSizes[face.seatIndex] >= 35) {
                const seam = projectPolygon(face.points.map(p => p.map((v,i) => face.center[i]+(v-face.center[i])*.88)));
                polygon(ctx, seam); ctx.strokeStyle = shade(color, light * 1.12); ctx.lineWidth = .7; ctx.stroke();
            }
            if (face.kind === 'wood' && face.normal[1] > .9) {
                ctx.save(); polygon(ctx,points); ctx.clip(); ctx.strokeStyle = '#5d432324'; ctx.lineWidth = .7;
                for (const plank of scene.meshes.stagePlanks) {
                    const [a,b] = plank.map(p => Model.project(p,camera,width,height));
                    if (a && b) { ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
                }
                ctx.restore();
            }
            if (face.kind === 'floor') {
                // Subtle floor joints and layered contact shadows anchor each chair.
                ctx.save(); polygon(ctx, points); ctx.clip(); ctx.strokeStyle = '#b7b9ac28'; ctx.lineWidth = .65;
                const { minX, maxX, minZ, maxZ } = scene.bounds;
                const spacing = Math.max(4, (maxX - minX) / 18, (maxZ - minZ) / 18);
                for (let z = minZ + spacing; z < maxZ; z += spacing) {
                    const a = Model.project([minX,-.035,z],camera,width,height), b = Model.project([maxX,-.035,z],camera,width,height);
                    if (a && b) { ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
                }
                for (const shadow of scene.meshes.shadows) {
                    if (seatSizes[shadow.seatIndex] < 7) continue;
                    const ground = projectPolygon(shadow.points); if (ground.length < 3) continue;
                    polygon(ctx, ground); ctx.fillStyle = '#20372d12'; ctx.fill();
                    const seat = scene.seats[shadow.seatIndex];
                    polygon(ctx, projectPolygon(shadow.points.map(p => [seat.x+(p[0]-seat.x)*.73,p[1],seat.z+(p[2]-seat.z)*.73]))); ctx.fillStyle = '#20372d13'; ctx.fill();
                }
                if (!firstPerson) for (const seat of scene.seats) {
                    if (!seat.id || !selected.has(seat.id) && seat.id !== state.focusId) continue;
                    const ring = projectPolygon(Array.from({length:24},(_,i) => { const a=i/24*Math.PI*2; return [seat.x+Math.cos(a)*.7,-.02,seat.z+Math.sin(a)*scene.depth*.66]; }));
                    if (ring.length < 3) continue;
                    polygon(ctx, ring); ctx.fillStyle = selected.has(seat.id) ? '#368fe329' : '#bd965926'; ctx.fill();
                    ctx.strokeStyle = selected.has(seat.id) ? '#348bd5' : '#b38a49'; ctx.lineWidth = 1.6; ctx.stroke();
                }
                ctx.restore();
            }
            if (face.kind === 'screen') {
                const p = Model.project(scene.meshes.stageLabel, camera, width, height);
                if (p) {
                    ctx.save(); polygon(ctx, points); ctx.clip();
                    const size = Model.clamp(focal / p.depth * scene.stage.width / 11, 9, 30);
                    ctx.font = `600 ${size}px system-ui, sans-serif`; ctx.fillStyle = '#f4f2e7'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('STAGE', p.x, p.y);
                    if (size > 15) { ctx.fillStyle = '#d5b47c'; ctx.fillRect(p.x-size*.7,p.y+size*.8,size*1.4,1.5); }
                    ctx.restore();
                }
            }
            // Include the stage and contextual chairs as occluders in picking.
            if (!firstPerson && face.kind !== 'floor' && face.kind !== 'floorBase') hits.push({ id: seat?.id || null, points });
        }
        if (!firstPerson) {
            const activeSeat = seat => selected.has(seat.id) || seat.id === state.focusId || seat.id === state.hoverId;
            const occupied = [];
            for (const item of [...scene.meshes.labels].sort((a, b) => Number(activeSeat(scene.seats[b.seatIndex])) - Number(activeSeat(scene.seats[a.seatIndex])))) {
                const seat = scene.seats[item.seatIndex];
                if (!seat.id) continue;
                const p = Model.project(audience.has(item.seatIndex) ? [item.point[0],2.15,item.point[2]] : item.point, camera, width, height);
                if (!p || p.x < 10 || p.x > width - 10 || p.y < 10 || p.y > height - 10) continue;
                const size = height / (2 * Math.tan(camera.fov / 2)) / p.depth;
                const active = activeSeat(seat);
                if (size < 27 && !active) continue;
                // A compact badge labels the chair without adding a DOM node per seat.
                ctx.font = `${active ? 700 : 500} ${active ? 11 : 10}px system-ui, sans-serif`;
                const checked = selected.has(seat.id), fullLabel = active ? seat.label : seat.number;
                // Full identifiers remain in the tooltip and seat list; badges fit mobile.
                let label = fullLabel;
                const maxLabelWidth = Math.min(180, width - 52);
                while (label.length > 1 && ctx.measureText(label).width > maxLabelWidth) label = label.slice(0,-2) + '\u2026';
                const textWidth = ctx.measureText(label).width;
                if (!active && textWidth + 10 > size) continue;
                const badgeHeight = active ? 24 : 17, badgeWidth = textWidth + (active ? 16 : 10) + (checked ? 13 : 0);
                const box = { x: Model.clamp(p.x - badgeWidth / 2, 6, width - badgeWidth - 6), y: p.y - badgeHeight / 2, w: badgeWidth, h: badgeHeight };
                if (occupied.some(other => box.x < other.x + other.w && box.x + box.w > other.x && box.y < other.y + other.h && box.y + box.h > other.y)) continue;
                occupied.push(box);
                roundedRect(ctx, box.x, box.y, box.w, box.h, active ? 7 : 4);
                ctx.fillStyle = active ? selected.has(seat.id) ? '#246eaf' : '#263d36' : '#fffffff0'; ctx.fill();
                ctx.strokeStyle = active ? '#ffffff' : '#c6d1c8'; ctx.lineWidth = active ? 1.4 : .6; ctx.stroke();
                if (checked) { ctx.beginPath(); ctx.moveTo(box.x+8,p.y); ctx.lineTo(box.x+11,p.y+3); ctx.lineTo(box.x+16,p.y-3); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(); }
                ctx.fillStyle = active ? '#ffffff' : '#3e5950'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, box.x + box.w / 2 + (checked ? 6.5 : 0), p.y);
                hits.push({ id: seat.id, points: [{x:box.x,y:box.y},{x:box.x+box.w,y:box.y},{x:box.x+box.w,y:box.y+box.h},{x:box.x,y:box.y+box.h}] });
            }
        }
        return hits;
    }
    function hitTest(hits, x, y) { for (let i = hits.length - 1; i >= 0; i--) if (inside(x, y, hits[i].points)) return hits[i].id; return null; }

    function mount(container, options = {}) {
        const canvas = document.createElement('canvas');
        let ctx; try { ctx = canvas.getContext('2d'); } catch (_) { return null; }
        if (!ctx || !Model) return null;
        canvas.className = 'ts-seat-3d-canvas'; canvas.tabIndex = 0;
        canvas.setAttribute('role', 'group');
        canvas.setAttribute('aria-label', '3D seats. Drag to rotate. Arrow keys browse seats, Enter selects, V views the stage, Escape returns to overview.');
        const tooltip = document.createElement('div'); tooltip.className = 'ts-seat-3d-tooltip'; tooltip.hidden = true; tooltip.setAttribute('aria-hidden', 'true');
        const hint = document.createElement('div'); hint.className = 'ts-seat-3d-hint'; hint.setAttribute('aria-hidden', 'true');
        container.replaceChildren(canvas, tooltip, hint);
        let model, scene, page, frame = 0, disposed = false, hits = [], drag = null, width = 0, height = 0;
        const state = { selected: [], focusId: null, hoverId: null, viewSeatId: null, orbit: {}, look: {}, showPeople: false, peopleMotion: true, peopleTime: 0 };
        const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        let reducedMotion = !!motionPreference?.matches, inViewport = true, dirty = true, lastTime = null, lastPaint = -Infinity;
        let busy = false;
        const listeners = [];
        function listen(target, name, fn, opts) { target.addEventListener(name, fn, opts); listeners.push(() => target.removeEventListener(name, fn, opts)); }
        function stopMotion() { if (frame) window.cancelAnimationFrame(frame); frame = 0; lastTime = null; }
        function paint(timestamp = 0) {
            frame = 0;
            if (disposed || !scene || container.hidden || document.hidden || !inViewport) { lastTime = null; return; }
            const animate = !!People && state.showPeople && state.peopleMotion && !reducedMotion && scene.seats.some(s => !s.id || s.id !== state.viewSeatId && !state.selected.includes(s.id));
            // Twelve frames per second is enough for breathing and gentle head turns.
            if (animate && !dirty && timestamp - lastPaint < 1000 / 12) { schedule(false); return; }
            const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
            if (width < 1 || height < 1) { lastTime = null; return; }
            if (animate && lastTime !== null) state.peopleTime += Math.max(0, Math.min(timestamp - lastTime, 200)) / 1000;
            lastTime = animate ? timestamp : null; lastPaint = timestamp; dirty = false;
            const ratio = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(width * ratio), h = Math.round(height * ratio);
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            hits = draw(ctx, scene, state, width, height);
            if (animate) schedule(false);
        }
        function schedule(invalidate = true) { if (invalidate) dirty = true; if (!frame && !disposed) frame = window.requestAnimationFrame(paint); }
        function info() {
            hint.textContent = state.viewSeatId ? 'Drag to look around \u00b7 Esc for overview' : 'Drag to rotate \u00b7 + / \u2212 to zoom';
            options.onViewChange?.({ viewSeatId: state.viewSeatId, page, pages: model ? Model.pages(model) : [], estimatedStage: scene?.stage.estimated,
                peopleAvailable: !!People, showPeople: state.showPeople, peopleMotion: state.peopleMotion && !reducedMotion, reducedMotion });
        }
        function focus(id) { state.focusId = id; options.onFocus?.(id); schedule(); }
        function overview() { state.viewSeatId = null; state.hoverId = null; state.look = {}; tooltip.hidden = true; info(); schedule(); }
        function viewFrom(id) {
            const seat = model?.seats.find(s => s.id === id && Model.validPosition(s.position));
            if (!seat) return false;
            const seatPage = seat.position.page || 1;
            if (page !== seatPage) { page = seatPage; scene = Model.createScene(model, page); state.orbit = {}; }
            state.viewSeatId = id; state.hoverId = null; state.look = {}; state.focusId = id; tooltip.hidden = true; options.onFocus?.(id); info(); schedule(); return true;
        }
        function zoom(factor) {
            if (state.viewSeatId) state.look.fov = Model.clamp((state.look.fov || 1.15) * factor, .65, 1.5);
            else state.orbit.zoom = Model.clamp((state.orbit.zoom || 1) * factor, .18, 2.5);
            schedule();
        }
        const locate = event => { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
        listen(canvas, 'pointerdown', event => {
            if (event.button !== 0 || drag) return;
            drag = { pointerId: event.pointerId, start: locate(event), last: locate(event), moved: false };
            canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true }); tooltip.hidden = true;
            if (state.hoverId) { state.hoverId = null; schedule(); }
        });
        listen(canvas, 'pointermove', event => {
            const p = locate(event);
            if (drag) {
                if (drag.pointerId !== event.pointerId) return;
                if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 6) drag.moved = true;
                if (drag.moved) {
                    const dx = (p.x - drag.last.x) * .008, dy = (p.y - drag.last.y) * .006;
                    if (state.viewSeatId) { state.look.yaw = Model.clamp((state.look.yaw || 0) - dx, -1.3, 1.3); state.look.pitch = Model.clamp((state.look.pitch || 0) + dy, -.6, .6); }
                    else { state.orbit.yaw = (state.orbit.yaw || 0) - dx; state.orbit.elevation = Model.clamp((state.orbit.elevation ?? .78) + dy, .2, 1.35); }
                    schedule();
                }
                drag.last = p; return;
            }
            const id = state.viewSeatId ? null : hitTest(hits, p.x, p.y), seat = scene?.seats.find(s => s.id === id && id);
            if (state.hoverId !== id) { state.hoverId = id; schedule(); }
            tooltip.hidden = !seat;
            if (seat) { tooltip.textContent = `${seat.label} · ${seat.status === 'MINE' ? 'Held by you' : seat.status.toLowerCase()}`; tooltip.style.left = `${Model.clamp(p.x, 90, width - 90)}px`; tooltip.style.top = `${Math.max(12, p.y - 42)}px`; }
            canvas.style.cursor = seat ? 'pointer' : 'grab';
        });
        function end(event, cancel = false) {
            if (!drag || drag.pointerId !== event.pointerId) return;
            const moved = drag.moved; drag = null;
            if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
            if (!cancel && !moved && !state.viewSeatId) { const p = locate(event), id = hitTest(hits, p.x, p.y); if (id) { focus(id); if (!busy) options.onSeatSelect?.(id); } }
        }
        listen(canvas, 'pointerup', event => end(event));
        listen(canvas, 'pointercancel', event => end(event, true));
        listen(canvas, 'lostpointercapture', () => { drag = null; });
        listen(canvas, 'pointerleave', () => { tooltip.hidden = true; if (state.hoverId) { state.hoverId = null; schedule(); } });
        // Scrolling the page remains normal; zoom uses the explicit + / − controls.
        listen(canvas, 'keydown', event => {
            if (!scene) return;
            if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
                event.preventDefault();
                if (state.viewSeatId) {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') state.look.yaw = Model.clamp((state.look.yaw || 0) + (event.key === 'ArrowLeft' ? .12 : -.12), -1.3, 1.3);
                    else state.look.pitch = Model.clamp((state.look.pitch || 0) + (event.key === 'ArrowUp' ? .1 : -.1), -.6, .6);
                    schedule(); return;
                }
                const seats = scene.seats.filter(s => s.id).sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
                const current = seats.findIndex(s => s.id === state.focusId), step = ['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1;
                const next = current < 0 ? step > 0 ? 0 : seats.length - 1 : (current + step + seats.length) % seats.length;
                focus(seats[next]?.id);
            } else if ((event.key === 'Enter' || event.key === ' ') && state.focusId && !state.viewSeatId) { event.preventDefault(); if (!busy) options.onSeatSelect?.(state.focusId); }
            else if (event.key.toLowerCase() === 'v' && state.focusId) { event.preventDefault(); viewFrom(state.focusId); }
            else if (event.key === 'Escape' || event.key === 'Home') { event.preventDefault(); state.orbit = {}; overview(); }
            else if (event.key === '+' || event.key === '-') { event.preventDefault(); zoom(event.key === '+' ? .8 : 1.25); }
        });
        const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
        resize?.observe(container); listen(window, 'resize', schedule);
        const visibility = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
            inViewport = entries.some(entry => entry.isIntersecting);
            if (inViewport) schedule(); else stopMotion();
        }) : null;
        visibility?.observe(container);
        if (document.addEventListener) listen(document, 'visibilitychange', () => { if (document.hidden) stopMotion(); else schedule(); });
        if (motionPreference?.addEventListener) listen(motionPreference, 'change', event => {
            reducedMotion = event.matches; stopMotion(); info(); schedule();
        });
        return {
            setPeople(enabled) { state.showPeople = !!People && !!enabled; stopMotion(); info(); schedule(); },
            setPeopleMotion(enabled) { state.peopleMotion = !!enabled; stopMotion(); info(); schedule(); },
            setVisible(visible) { if (!visible) stopMotion(); else schedule(); },
            update(next, selected = [], disabled = false) {
                busy = disabled; state.selected = selected;
                if (next !== model) {
                    model = next;
                    if (!Model.pages(model).includes(page)) page = Model.pages(model)[0];
                    scene = Model.createScene(model, page);
                    if (state.viewSeatId && !scene?.seats.some(s => s.id === state.viewSeatId)) state.viewSeatId = null;
                    info();
                } else if (scene) { const status = new Map(model.seats.map(s => [s.id, s.status])); scene.seats.forEach(s => { if (s.id) s.status = status.get(s.id) || 'BLOCKED'; }); }
                schedule();
            },
            setPage(value) { if (!Model.pages(model).includes(Number(value))) return; page = Number(value); scene = Model.createScene(model, page); state.orbit = {}; state.focusId = null; options.onFocus?.(null); overview(); },
            focus, viewFrom, overview, zoom, resize: schedule,
            reset() { state.orbit = {}; state.look = {}; schedule(); },
            dispose() { disposed = true; stopMotion(); resize?.disconnect(); visibility?.disconnect(); listeners.forEach(remove => remove()); container.replaceChildren(); }
        };
    }
    return { mount, draw, hitTest };
});
