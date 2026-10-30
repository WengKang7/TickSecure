(function () {
    const el = id => document.getElementById(id), create = (tag, className, text) => { const node = document.createElement(tag); node.className = className || ''; if (text !== undefined) node.textContent = text; return node; };
    const params = new URLSearchParams(window.location.search), eventId = params.get('eventId') || '', sectionId = params.get('sectionId') || '';
    const quantity = Number(params.get('qty') || 1), selected = new Set();
    let revision = 0;
    let model, hold, busy = false, uid, version = 0, viewport = [0,0,104,106], interval, loading = false;
    let view3D = null, viewMode = '3d', focusedSeatId = null, viewInfo = {}, failed3D = false;
    const error = message => { el('picker-error').hidden = !message; el('picker-error').textContent = message || ''; };
    const sameSelection = () => hold && hold.seats.length === selected.size && hold.seats.every(seat => selected.has(seat.id)) && Date.parse(hold.reservationExpiry) > Date.now();
    const mapSeats = () => new Map((model?.seats || []).map(seat => [seat.id, seat]));
    const owns = () => hold?.seats.map(seat => seat.id) || (model?.seats || []).filter(seat => seat.status === 'MINE').map(seat => seat.id);
    function renderPreview() {
        const seat = mapSeats().get(focusedSeatId);
        el('picker-seat-preview').hidden = !seat;
        if (!seat) return;
        el('picker-preview-label').textContent = `Seat ${seat.seatLabel}`;
        el('picker-preview-status').textContent = `${selected.has(seat.id) ? 'Selected · ' : ''}${seat.status === 'MINE' ? 'Held by you' : seat.status.toLowerCase()}`;
        el('picker-view-seat').disabled = !seat.position || failed3D || !window.tsSeatView3D;
        el('picker-view-seat').textContent = viewInfo.viewSeatId === seat.id && viewMode === '3d' ? 'Viewing from this seat' : 'View from this seat';
    }
    function syncViewControls() {
        const active = viewMode === '3d' && !!view3D;
        el('picker-mode-3d').setAttribute('aria-pressed', String(active));
        el('picker-mode-2d').setAttribute('aria-pressed', String(!active));
        el('picker-mode-3d').disabled = failed3D || !window.tsSeatView3D || !model?.seats.some(s => s.position);
        el('picker-3d-heading').hidden = !active;
        el('picker-3d-note').hidden = !active;
        el('picker-people-controls').hidden = !active;
        el('picker-people').checked = !!viewInfo.showPeople;
        el('picker-people').disabled = !active || !viewInfo.peopleAvailable;
        const motion = el('picker-people-motion');
        motion.disabled = !active || !viewInfo.showPeople || !!viewInfo.reducedMotion;
        motion.setAttribute('aria-pressed', String(!!viewInfo.showPeople && !!viewInfo.peopleMotion));
        motion.textContent = viewInfo.reducedMotion ? 'Reduced motion' : viewInfo.peopleMotion === false ? 'Play animation' : 'Pause animation';
        motion.title = viewInfo.reducedMotion ? 'Animation is paused to match your reduced-motion preference.' : '';
        el('picker-context-legend').hidden = !active || !model?.geometry?.layoutSeats?.length;
        el('picker-3d-fallback').hidden = !failed3D;
        el('picker-overview').hidden = !viewInfo.viewSeatId;
        const seat = mapSeats().get(viewInfo.viewSeatId);
        el('picker-view-status').textContent = seat ? `View from ${seat.seatLabel}` : 'Venue overview';
        el('picker-3d-note').textContent = `${seat ? 'Drag to look around.' : 'Drag to rotate.'} Illustrative view: actual attendees, floor slopes and obstructions are not modelled.${viewInfo.estimatedStage ? ' Stage position is estimated.' : ''}`;
        const pages = el('picker-plan-page'); pages.replaceChildren();
        (viewInfo.pages || []).forEach(page => { const option = create('option', '', `Plan page ${page}`); option.value = String(page); pages.appendChild(option); });
        pages.value = String(viewInfo.page || 1); pages.hidden = (viewInfo.pages || []).length < 2;
        renderPreview();
    }
    function showSeatView(id) {
        const seat = mapSeats().get(id);
        if (!seat?.position || failed3D || !window.tsSeatView3D) return;
        focusedSeatId = id; viewMode = '3d'; render(); view3D?.viewFrom(id); renderPreview();
    }
    function clear3D() { view3D?.dispose(); view3D = null; focusedSeatId = null; viewInfo = {}; el('buyer-seat-3d').hidden = true; syncViewControls(); }
    function renderSummary() {
        const records = mapSeats(); el('picker-selected').replaceChildren();
        [...selected].forEach(id => {
            const seat = records.get(id); if (!seat) return;
            const canPreview = seat.position && window.tsSeatView3D && !failed3D;
            const pill = create(canPreview ? 'button' : 'span', 'ts-seat-pill', seat.seatLabel);
            if (canPreview) { pill.type = 'button'; pill.setAttribute('aria-label', `View toward the stage from ${seat.seatLabel}`); pill.addEventListener('click', () => showSeatView(id)); }
            el('picker-selected').appendChild(pill);
        });
        el('picker-count').textContent = `${selected.size} of ${quantity} seats selected`;
        el('picker-total').textContent = model ? `RM${(model.unitPrice * selected.size + (selected.size ? 20 : 0)).toFixed(2)}` : '—';
        el('picker-reserve').disabled = busy || !model || selected.size !== quantity;
        el('picker-release').disabled = busy || !owns().length;
        el('picker-release').hidden = !owns().length;
        const next = el('picker-continue'), ready = !busy && sameSelection();
        next.hidden = !ready; el('picker-reserve').hidden = ready;
        next.setAttribute('aria-disabled', String(!ready)); next.style.pointerEvents = ready ? '' : 'none';
        if (!ready) { next.removeAttribute('href'); next.textContent = 'Reserve seats to continue'; }
        else {
            const query = new URLSearchParams({ eventId, sectionId, qty: String(hold.seats.length), seatIds: hold.seats.map(s => s.id).join(','),
                seatLabels: hold.seats.map(s => s.seatLabel).join(','), reservationExpiry: hold.reservationExpiry });
            if (hold.reservationId) query.set('reservationId', hold.reservationId);
            const checkout = `checkout.php?${query}`;
            const hasWallet = /^0x[a-fA-F0-9]{40}$/.test(window.tsCurrentUser?.walletAddress || '');
            next.href = hasWallet ? checkout : `wallet.php?redirect=${encodeURIComponent(checkout)}`;
            next.textContent = hasWallet ? 'Continue to Payment' : 'Continue to Wallet';
        }
        el('picker-hold').hidden = !hold;
        renderPreview();
    }
    function toggle(id) {
        if (busy) return;
        const seat = mapSeats().get(id); if (!seat) return;
        focusedSeatId = id; renderPreview();
        if (!['AVAILABLE', 'MINE'].includes(seat.status)) return;
        if (selected.has(id)) selected.delete(id);
        else if (selected.size < quantity) selected.add(id);
        else { error(`Choose exactly ${quantity} seats. Deselect a seat before selecting another.`); return; }
        error(''); render();
    }
    function render() {
        if (!model) return;
        const positioned = model.seats.filter(seat => seat.position);
        const note = el('picker-position-note'); note.hidden = positioned.length === model.seats.length;
        const details = el('picker-list-details'); if (details && positioned.length !== model.seats.length) details.open = true;
        const board = el('buyer-seat-map'), threeBoard = el('buyer-seat-3d');
        if (positioned.length && viewMode === '3d' && !failed3D && window.tsSeatView3D) {
            threeBoard.hidden = false;
            if (!view3D) {
                try { view3D = window.tsSeatView3D.mount(threeBoard, {
                    onSeatSelect: toggle, onFocus: id => { focusedSeatId = id; renderPreview(); },
                    onViewChange: info => { viewInfo = info; syncViewControls(); }
                }); } catch (_) { view3D = null; }
                if (!view3D) { failed3D = true; viewMode = '2d'; }
            }
            view3D?.update(model, [...selected], busy);
        }
        const show3D = positioned.length && viewMode === '3d' && !!view3D;
        threeBoard.hidden = !show3D; board.hidden = !positioned.length || show3D;
        view3D?.setVisible?.(!!show3D);
        syncViewControls();
        if (positioned.length && !show3D) {
            const pages = [...new Set(positioned.map(s => s.position.page || 1))];
            const sections = pages.map(page => ({ sectionId: 'PAGE_' + page, name: model.categoryName, seatCount: positioned.filter(s => (s.position.page || 1) === page).length,
                geometry: { type: 'polygon', layout: 'ocr', page, imageWidth: model.geometry.pages?.[page]?.imageWidth || model.geometry.imageWidth, imageHeight: model.geometry.pages?.[page]?.imageHeight || model.geometry.imageHeight,
                    decorations: model.geometry.pages?.[page]?.decorations || (page === model.geometry.page ? model.geometry.decorations : []), points: [], seatMarkers: positioned.filter(s => (s.position.page || 1) === page).map(seat => ({
                        ...seat.position, id: seat.id, label: seat.seatLabel, number: seat.number || seat.seatLabel, status: seat.status === 'MINE' ? 'AVAILABLE' : seat.status
                    })) } }));
            window.tsVenueRenderer.renderBoard('buyer-seat-map', sections, { seatOnly: true, selectedSeatIds: [...selected], viewport, editTool: 'pan',
                onViewportChange: value => { viewport = value; }, onSeatSelect: (_, label, event, id) => toggle(id) });
        }
        const filter = el('picker-search').value.trim().toLowerCase(), list = el('picker-seat-list'); list.replaceChildren();
        model.seats.filter(seat => !filter || seat.seatLabel.toLowerCase().includes(filter) || seat.row.toLowerCase().includes(filter)).forEach(seat => {
            const button = create('button', 'ts-picker-seat-option', seat.seatLabel); button.type = 'button';
            button.disabled = !['AVAILABLE', 'MINE'].includes(seat.status) || busy;
            button.setAttribute('aria-pressed', String(selected.has(seat.id))); button.setAttribute('aria-label', `${seat.seatLabel}, ${seat.status.toLowerCase()}`);
            button.addEventListener('click', () => toggle(seat.id)); list.appendChild(button);
        });
        renderSummary();
    }
    async function load(initial = false) {
        if (loading || busy || !uid) return;
        loading = true; const requestVersion = version, requestUid = uid, requestRevision = revision;
        try {
            const result = await window.tsSeats.getSeatMap(eventId, sectionId);
            if (requestVersion !== version || requestUid !== window.tsCurrentUser?.uid || requestRevision !== revision || busy) return;
            if (!Array.isArray(result.seats) || !Number.isFinite(result.unitPrice) || result.unitPrice <= 0) throw Error('The seat map returned incomplete event data.');
            if (quantity > Math.min(20, result.maxPerBuyer)) throw Error('Your requested quantity exceeds the event ticket limit. Change your category or quantity.');
            model = result;
            const records = mapSeats(); [...selected].forEach(id => { if (!records.has(id) || !['AVAILABLE', 'MINE'].includes(records.get(id).status)) selected.delete(id); });
            if (initial) model.seats.filter(s => s.status === 'MINE').slice(0, quantity).forEach(s => selected.add(s.id));
            if (hold && hold.seats.some(s => records.get(s.id)?.status !== 'MINE')) { hold = null; error('Your previous hold is no longer valid. Choose seats again.'); }
            el('picker-event').textContent = `${model.eventName} · ${model.venueName}`; el('picker-category').textContent = `${model.categoryName} · RM${model.unitPrice.toFixed(2)} per seat`;
            render();
        } catch (failure) { if (requestVersion === version) error(failure.message || 'Could not refresh availability.'); }
        finally { if (requestVersion === version) loading = false; }
    }
    async function reserve() {
        if (busy || !model || selected.size !== quantity) return;
        busy = true; revision++; error(''); renderSummary(); const requestUid = uid, requestVersion = version; let failed = false;
        try {
            const result = await window.tsSeats.holdSelectedSeats(eventId, sectionId, [...selected]);
            if (requestVersion !== version || requestUid !== window.tsCurrentUser?.uid) return;
            if (!Array.isArray(result.seats) || result.seats.length !== quantity || new Set(result.seats.map(s => s.id)).size !== quantity
                || result.seats.some(s => !selected.has(s.id) || !s.seatLabel) || !(Date.parse(result.reservationExpiry) > Date.now())) throw Error('The reservation response was incomplete. Refresh availability before continuing.');
            hold = result;
            model.seats.forEach(seat => { if (selected.has(seat.id)) { seat.status = 'MINE'; seat.reservationExpiry = result.reservationExpiry; } else if (seat.status === 'MINE') seat.status = 'AVAILABLE'; });
        } catch (failure) { if (requestVersion === version) { failed = true; error(failure.message || 'These seats could not be reserved.'); } }
        finally { if (requestVersion === version) { busy = false; render(); if (failed) await load(); } }
    }
    async function release() {
        const ids = owns(); if (busy || !ids.length) return true;
        busy = true; revision++; const requestVersion = version; renderSummary();
        try {
            if (!await window.tsDecision('releaseReservation', model?.eventName || 'Reserved seats', [['Quantity', ids.length]])) return false;
            if (requestVersion !== version) return false;
            await window.tsSeats.releaseSeats(ids, { eventId }); if (requestVersion !== version) return false; hold = null; selected.clear(); model?.seats.forEach(s => { if (ids.includes(s.id) && s.status === 'MINE') s.status = 'AVAILABLE'; }); error(''); return true; }
        catch (failure) { if (requestVersion === version) error(failure.message || 'Could not release your held seats.'); return false; }
        finally { if (requestVersion === version) { busy = false; render(); } }
    }
    const zoom = factor => { if (viewMode === '3d' && view3D) { view3D.zoom(factor); return; } const w = Math.min(104, Math.max(6.5, viewport[2] * factor)), h = w / 104 * 106; viewport = [Math.max(0, Math.min(104 - w, viewport[0] + (viewport[2] - w) / 2)), Math.max(0, Math.min(106 - h, viewport[1] + (viewport[3] - h) / 2)), w, h]; render(); };
    el('picker-zoom-in').addEventListener('click', () => zoom(.75)); el('picker-zoom-out').addEventListener('click', () => zoom(1.333333));
    el('picker-fit').addEventListener('click', () => { if (viewMode === '3d' && view3D) view3D.reset(); else { viewport = [0,0,104,106]; render(); } });
    el('picker-mode-3d').addEventListener('click', () => { viewMode = '3d'; render(); });
    el('picker-people').addEventListener('change', () => view3D?.setPeople(el('picker-people').checked));
    el('picker-people-motion').addEventListener('click', () => view3D?.setPeopleMotion(!viewInfo.peopleMotion));
    el('picker-mode-2d').addEventListener('click', () => { viewMode = '2d'; render(); });
    el('picker-view-seat').addEventListener('click', () => showSeatView(focusedSeatId));
    el('picker-overview').addEventListener('click', () => view3D?.overview());
    el('picker-plan-page').addEventListener('change', () => view3D?.setPage(Number(el('picker-plan-page').value)));
    el('picker-search').addEventListener('input', render); el('picker-refresh').addEventListener('click', () => load());
    el('picker-reserve').addEventListener('click', reserve); el('picker-release').addEventListener('click', release);
    const autoQuery = new URLSearchParams({ eventId, sectionId, qty: String(quantity) }); el('picker-auto').href = `seat-assignment.php?${autoQuery}`;
    const categoryQuery = new URLSearchParams({ id: eventId, sectionId, qty: String(quantity) }); el('picker-back').href = `../public/event-detail.php?${categoryQuery}`;
    ['picker-back', 'picker-auto'].forEach(id => el(id).addEventListener('click', async event => { event.preventDefault(); if (!busy && await release()) window.location.href = el(id).href; }));
    el('picker-continue').addEventListener('click', event => { if (busy || !sameSelection()) event.preventDefault(); });
    async function ready() {
        const current = window.tsCurrentUser?.uid;
        if (!current) { version++; uid = null; busy = loading = false; model = hold = null; selected.clear(); clearInterval(interval); clear3D(); el('buyer-seat-map').replaceChildren(); el('picker-seat-list').replaceChildren(); renderSummary(); return; }
        if (uid === current) return;
        uid = current; version++; revision++; loading = busy = false; model = hold = null; selected.clear(); clear3D(); el('buyer-seat-map').replaceChildren(); el('picker-seat-list').replaceChildren(); renderSummary(); clearInterval(interval);
        const startVersion = version;
        if (!/^[A-Za-z0-9_-]{1,160}$/.test(eventId) || !/^[A-Za-z0-9_-]{1,160}$/.test(sectionId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) { error('Choose a valid category and quantity before selecting seats.'); return; }
        await load(true);
        if (version !== startVersion || uid !== current) return;
        interval = setInterval(() => {
            if (hold) {
                const seconds = Math.max(0, Math.ceil((Date.parse(hold.reservationExpiry) - Date.now()) / 1000));
                el('picker-countdown').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
                if (!seconds) { hold = null; selected.clear(); error('Your hold expired. Choose seats again.'); render(); load(); }
            }
        }, 1000);
    }
    const refresh = () => { if (!document.hidden) load(); };
    let refreshInterval = setInterval(refresh, 30000);
    window.addEventListener('ts-auth-ready', ready); window.addEventListener('pagehide', () => { clearInterval(interval); clearInterval(refreshInterval); view3D?.dispose(); view3D = null; });
    window.addEventListener('pageshow', event => { if (event.persisted) { refreshInterval = setInterval(refresh, 30000); uid = null; ready(); } });
    if (window.tsCurrentUser) ready();
})();
