(function () {
    const el = id => document.getElementById(id), create = (tag, className, text) => { const node = document.createElement(tag); node.className = className || ''; if (text !== undefined) node.textContent = text; return node; };
    const params = new URLSearchParams(window.location.search), eventId = params.get('eventId') || '', sectionId = params.get('sectionId') || '';
    const quantity = Number(params.get('qty') || 1), selected = new Set();
    let revision = 0;
    let model, hold, busy = false, uid, version = 0, viewport = [0,0,104,106], interval, loading = false;
    let view3D = null, viewMode = '3d', focusedSeatId = null, viewInfo = {}, failed3D = false;
    const comparison = window.tsSeatComparison?.mount(el('picker-comparison'), {onPreview:id=>showSeatView(id)});
    const error = message => { el('picker-error').hidden = !message; el('picker-error').textContent = message || ''; };
    const sameSelection = () => hold && hold.seats.length === selected.size && hold.seats.every(seat => selected.has(seat.id)) && Date.parse(hold.reservationExpiry) > Date.now();
    // Keep the exact reservation selection fixed until the hold is released or expires.
    const selectionLocked = () => busy || (!!hold && Date.parse(hold.reservationExpiry) > Date.now());
    const mapSeats = () => new Map((model?.seats || []).map(seat => [seat.id, seat]));
    const seatName = seat => window.tsTicketDisplay?.seatLabel({seatLabel:seat.seatLabel,categoryName:model?.categoryName}) || seat.seatLabel;
    const owns = () => hold?.seats.map(seat => seat.id) || (model?.seats || []).filter(seat => seat.status === 'MINE').map(seat => seat.id);
    let backGuard = !!window.history?.state?.tsSeatPickerGuard, leavingByBack = false;
    function protectBrowserBack() {
        if (!window.history || backGuard || leavingByBack || (!busy && !owns().length)) return;
        window.history.pushState({ ...window.history.state, tsSeatPickerGuard: true }, '');
        backGuard = true;
    }
    async function browserBack(event) {
        if (!backGuard || leavingByBack || event.state?.tsSeatPickerGuard) return;
        if (!busy && !owns().length) {
            leavingByBack = true;
            if (window.history.length > 2) window.history.back();
            else window.location.href = el('picker-back').href;
            return;
        }
        // Restore this document before showing the asynchronous confirmation.
        // Only leave after the server confirms that the held seats were released.
        window.history.pushState({ ...window.history.state, tsSeatPickerGuard: true }, '');
        if (busy) { error('Please wait for seat processing to finish before going back.'); return; }
        if (await release()) {
            leavingByBack = true;
            if (window.history.length > 2) window.history.go(-2);
            else window.location.href = el('picker-back').href;
        }
    }
    window.addEventListener('popstate', browserBack);
    const seenOffers = new Set();
    let offerAlertOpen = false;
    async function alertSeatOffer() {
        if (document.hidden || offerAlertOpen || selectionLocked() || !uid || quantity !== 1
            || !window.tsDecision || el('ts-decision-dialog')?.open) return;
        const offer = model?.seats.find(seat => seat.waitlistOffer && Date.parse(seat.reservationExpiry) > Date.now());
        if (!offer) return;
        const key = `ts-seat-offer:${uid}:${offer.id}:${Date.parse(offer.reservationExpiry)}`;
        if (seenOffers.has(key)) return;
        try { if (window.sessionStorage?.getItem(key)) { seenOffers.add(key); return; } } catch (_) {}
        seenOffers.add(key); offerAlertOpen = true;
        try { window.sessionStorage?.setItem(key, 'shown'); } catch (_) {}
        const alertVersion = version, alertUid = uid;
        try {
            const claim = await window.tsDecision('seatOfferAvailable', `${model.eventName} · ${seatName(offer)}`,
                [['Seat', seatName(offer)], ['Claim before', new Date(offer.reservationExpiry).toLocaleTimeString()]]);
            if (!claim || version !== alertVersion || window.tsCurrentUser?.uid !== alertUid || selectionLocked()) return;
            const current = mapSeats().get(offer.id);
            if (!current?.waitlistOffer || current.reservationExpiry !== offer.reservationExpiry
                || !(Date.parse(current.reservationExpiry) > Date.now())) {
                error('This seat offer has expired or changed. Refresh availability to check your waiting list.'); return;
            }
            selected.clear(); selected.add(offer.id); focusedSeatId = offer.id;
            await reserve();
        } finally { offerAlertOpen = false; }
    }
    function renderWaitlist() {
        const root=el('picker-waitlist-details');if(!root)return;
        const supported=quantity===1 && window.tsSeats?.seatWaitlist && !window.tsFirebase?.emulator?.enabled;
        const member=model?.seats.find(seat=>seat.waitlistPosition || seat.waitlistOffer);
        const choice=el('picker-waitlist-seat'), previous=choice.value;choice.replaceChildren();
        (model?.seats||[]).filter(seat=>seat.status==='HELD' || seat.id===member?.id).forEach(seat=>{
            const option=create('option','',seatName(seat));option.value=seat.id;choice.appendChild(option);
        });
        if([...choice.children].some(option=>option.value===previous))choice.value=previous;
        choice.disabled=selectionLocked() || !!member || !supported;
        el('picker-waitlist-join').hidden=!!member;
        el('picker-waitlist-join').disabled=selectionLocked() || !supported || !choice.children.length;
        el('picker-waitlist-leave').hidden=!member;
        el('picker-waitlist-leave').disabled=busy;
        el('picker-waitlist-claim').hidden=!member?.waitlistOffer;
        el('picker-waitlist-claim').disabled=selectionLocked() || !(Date.parse(member?.reservationExpiry||'')>Date.now());
        el('picker-waitlist-position').textContent=!supported?'Choose a quantity of 1 to join a seat waiting list on the hosted website.'
            :member?.waitlistOffer?`Seat ${seatName(member)} is offered to you until ${new Date(member.reservationExpiry).toLocaleTimeString()}. Claim it to start checkout.`
            :member?`Seat ${seatName(member)}: your waiting-list position is ${member.waitlistPosition}. You will be notified if offered this seat.`
            :choice.children.length?'Join explicitly to receive priority if a held seat is released.':'No held seats are available to queue for.';
        if(member || params.get('waitlist')==='1')root.open=true;
    }
    async function waitlistAction(leave=false) {
        if(busy || (!leave && selectionLocked()) || quantity!==1 || !uid)return;
        const member=model?.seats.find(seat=>seat.waitlistPosition || seat.waitlistOffer);
        const id=leave?member?.id:el('picker-waitlist-seat').value;if(!id)return;
        const actionVersion=version;busy=true;renderWaitlist();
        try{await window.tsSeats.seatWaitlist(eventId,id,leave);if(actionVersion===version)error('');}
        catch(failure){if(actionVersion===version)error(failure.message||'Could not update the waiting list.');}
        finally{if(actionVersion===version){busy=false;await load();renderWaitlist();}}
    }
    function renderPreview() {
        const seat = mapSeats().get(focusedSeatId);
        el('picker-seat-preview').hidden = !seat;
        el('picker-view-seat').hidden = !seat;
        if (!seat) return;
        el('picker-preview-label').textContent = `Seat ${seatName(seat)}`;
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
        const stageMotion = el('picker-stage-motion');
        stageMotion.disabled = !active || !!viewInfo.reducedMotion;
        stageMotion.setAttribute('aria-pressed', String(!viewInfo.reducedMotion && viewInfo.stageMotion !== false));
        stageMotion.textContent = viewInfo.reducedMotion ? 'Stage effects: reduced motion' : viewInfo.stageMotion === false ? 'Play stage effects' : 'Pause stage effects';
        el('picker-context-legend').hidden = !model?.geometry?.layoutSeats?.length;
        el('picker-3d-fallback').hidden = !failed3D;
        el('picker-overview').hidden = !viewInfo.viewSeatId;
        const seat = mapSeats().get(viewInfo.viewSeatId);
        el('picker-view-status').textContent = seat ? `View from ${seatName(seat)}` : 'Venue overview';
        el('picker-3d-note').textContent = `${seat ? 'Drag to look around.' : 'Drag to rotate.'} Illustrative concert environment: seats follow the uploaded plan; surrounding tiers are decorative. Actual slopes and obstructions are not modelled.${viewInfo.estimatedStage ? ' Stage position is estimated.' : ''}`;
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
    function clear3D() { view3D?.dispose(); comparison?.update(null); view3D = null; focusedSeatId = null; viewInfo = {}; el('buyer-seat-3d').hidden = true; syncViewControls(); }
    function renderSummary() {
        protectBrowserBack();
        renderWaitlist();
        const records = mapSeats(); el('picker-selected').replaceChildren();
        [...selected].forEach(id => {
            const seat = records.get(id); if (!seat) return;
            const canPreview = seat.position && window.tsSeatView3D && !failed3D;
            const pill = create(canPreview ? 'button' : 'span', 'ts-seat-pill', seatName(seat));
            if (canPreview) { pill.type = 'button'; pill.setAttribute('aria-label', `View toward the stage from ${seatName(seat)}`); pill.addEventListener('click', () => showSeatView(id)); }
            const chip = create('span', 'ts-selected-seat-chip');
            const remove = create('button', 'ts-seat-remove', '\u00d7');
            remove.type = 'button'; remove.disabled = selectionLocked();
            remove.setAttribute('aria-label', `Deselect ${seatName(seat)}`);
            remove.title = selectionLocked() ? 'Release held seats to change your selection' : `Deselect ${seatName(seat)}`;
            remove.addEventListener('click', () => toggle(id));
            chip.appendChild(pill); chip.appendChild(remove);
            el('picker-selected').appendChild(chip);
        });
        el('picker-count').textContent = `${selected.size} of ${quantity} seats selected`;
        el('picker-total').textContent = model ? `RM${(model.unitPrice * selected.size + (selected.size ? 20 : 0)).toFixed(2)}` : '—';
        ['picker-back', 'picker-auto'].forEach(id => {
            const link = el(id), locked = selectionLocked();
            link.setAttribute('aria-disabled', String(locked));
            link.setAttribute('tabindex', locked ? '-1' : '0');
            link.style.pointerEvents = locked ? 'none' : '';
        });
        el('picker-reserve').textContent = busy ? 'Reserving seats...' : 'Reserve selected seats';
        el('picker-reserve').disabled = selectionLocked() || !model || selected.size !== quantity;
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
    // Context chairs are visual references only; selection still uses model.seats.
    function planMarkers(page, positioned) {
        const offered = positioned.filter(seat => (seat.position.page || 1) === page);
        const labels = new Set(offered.map(seat => seat.seatLabel));
        const context = (model.geometry.layoutSeats || []).filter(seat =>
            seat.position && Number.isFinite(seat.position.x) && Number.isFinite(seat.position.y)
            && (seat.position.page || 1) === page && !labels.has(seat.seatLabel));
        return [
            ...context.map((seat, index) => ({ ...seat.position, id: `context:${page}:${index}`, label: seat.seatLabel,
                number: seat.number || seat.seatLabel, status: 'CONTEXT' })),
            ...offered.map(seat => ({ ...seat.position, id: seat.id, label: seatName(seat),
                number: seat.number || seatName(seat), status: seat.status === 'MINE' ? 'AVAILABLE' : seat.status }))
        ];
    }
    function toggle(id) {
        if (selectionLocked()) return;
        const seat = mapSeats().get(id); if (!seat) return;
        focusedSeatId = id; renderPreview();
        if(seat.status==='HELD' && quantity===1 && el('picker-waitlist-details')){
            renderWaitlist();el('picker-waitlist-details').open=true;el('picker-waitlist-seat').value=id;
        }
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
                    concertTheme: true,
                    onSeatSelect: toggle, onFocus: id => { focusedSeatId = id; renderPreview(); },
                    onViewChange: info => { viewInfo = info; syncViewControls(); }
                }); } catch (_) { view3D = null; }
                if (!view3D) { failed3D = true; viewMode = '2d'; }
            }
            view3D?.update(model, [...selected], selectionLocked());
        }
        const show3D = positioned.length && viewMode === '3d' && !!view3D;
        threeBoard.hidden = !show3D; board.hidden = !positioned.length || show3D;
        view3D?.setVisible?.(!!show3D);
        syncViewControls();
        if (positioned.length && !show3D) {
            const pages = [...new Set(positioned.map(s => s.position.page || 1))];
            const sections = pages.map(page => ({ sectionId: 'PAGE_' + page, name: model.categoryName, seatCount: positioned.filter(s => (s.position.page || 1) === page).length,
                geometry: { type: 'polygon', layout: 'ocr', page, imageWidth: model.geometry.pages?.[page]?.imageWidth || model.geometry.imageWidth, imageHeight: model.geometry.pages?.[page]?.imageHeight || model.geometry.imageHeight,
                    decorations: model.geometry.pages?.[page]?.decorations || (page === model.geometry.page ? model.geometry.decorations : []), points: [], seatMarkers: planMarkers(page, positioned) } }));
            window.tsVenueRenderer.renderBoard('buyer-seat-map', sections, { cleanLayout: true, seatOnly: true, selectedSeatIds: [...selected], viewport, editTool: 'pan',
                onViewportChange: value => { viewport = value; }, onSeatSelect: (_, label, event, id) => toggle(id) });
        }
        const filter = el('picker-search').value.trim().toLowerCase(), list = el('picker-seat-list'); list.replaceChildren();
        model.seats.filter(seat => !filter || seatName(seat).toLowerCase().includes(filter) || seat.seatLabel.toLowerCase().includes(filter) || seat.row.toLowerCase().includes(filter)).forEach(seat => {
            const button = create('button', 'ts-picker-seat-option', seatName(seat)); button.type = 'button';
            button.disabled = !['AVAILABLE', 'MINE'].includes(seat.status) || selectionLocked();
            button.setAttribute('aria-pressed', String(selected.has(seat.id))); button.setAttribute('aria-label', `${seatName(seat)}, ${seat.status.toLowerCase()}`);
            button.addEventListener('click', () => toggle(seat.id)); list.appendChild(button);
        });
        renderSummary();
        comparison?.update(model);
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
            model.seats.forEach(seat => { seat.displaySeatLabel=seatName(seat); });
            const records = mapSeats(); [...selected].forEach(id => { if (!records.has(id) || !['AVAILABLE', 'MINE'].includes(records.get(id).status)) selected.delete(id); });
            if (initial) model.seats.filter(s => s.status === 'MINE').slice(0, quantity).forEach(s => selected.add(s.id));
            if (hold && hold.seats.some(s => records.get(s.id)?.status !== 'MINE')) { hold = null; error('Your previous hold is no longer valid. Choose seats again.'); }
            el('picker-event').textContent = `${model.eventName} · ${model.venueName}`;
            el('picker-category').replaceChildren(create('span', 'ts-picker-category-name', model.categoryName),
                create('strong', 'ts-picker-unit-price', `RM${model.unitPrice.toFixed(2)}`), create('small', '', '/ person'));
            render();
            alertSeatOffer().catch(() => {});
        } catch (failure) { if (requestVersion === version) error(failure.message || 'Could not refresh availability.'); }
        finally { if (requestVersion === version) loading = false; }
    }
    async function reserve() {
        if (selectionLocked() || !model || selected.size !== quantity) return;
        busy = true; revision++; error(''); render(); const requestUid = uid, requestVersion = version; let failed = false;
        try {
            const result = await window.tsSeats.holdSelectedSeats(eventId, sectionId, [...selected]);
            if (requestVersion !== version || requestUid !== window.tsCurrentUser?.uid) return;
            if (!Array.isArray(result.seats) || result.seats.length !== quantity || new Set(result.seats.map(s => s.id)).size !== quantity
                || result.seats.some(s => !selected.has(s.id) || !s.seatLabel) || !(Date.parse(result.reservationExpiry) > Date.now())) throw Error('The reservation response was incomplete. Refresh availability before continuing.');
            hold = result; error('');
            model.seats.forEach(seat => { if (selected.has(seat.id)) { seat.status = 'MINE'; seat.reservationExpiry = result.reservationExpiry; delete seat.waitlistOffer; delete seat.waitlistPosition; } else if (seat.status === 'MINE') seat.status = 'AVAILABLE'; });
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
    el('picker-stage-motion').addEventListener('click', () => view3D?.setStageMotion(viewInfo.stageMotion === false));
    el('picker-mode-2d').addEventListener('click', () => { viewMode = '2d'; render(); });
    el('picker-view-seat').addEventListener('click', () => showSeatView(focusedSeatId));
    el('picker-overview').addEventListener('click', () => view3D?.overview());
    el('picker-plan-page').addEventListener('change', () => view3D?.setPage(Number(el('picker-plan-page').value)));
    el('picker-search').addEventListener('input', render); el('picker-refresh').addEventListener('click', () => load());
    el('picker-reserve').addEventListener('click', reserve); el('picker-release').addEventListener('click', release);
    el('picker-waitlist-join')?.addEventListener('click',()=>waitlistAction());
    el('picker-waitlist-leave')?.addEventListener('click',()=>waitlistAction(true));
    el('picker-waitlist-claim')?.addEventListener('click',async()=>{
        const offered=model?.seats.find(seat=>seat.waitlistOffer);if(selectionLocked() || quantity!==1 || !offered)return;
        selected.clear();selected.add(offered.id);await reserve();
    });
    const autoQuery = new URLSearchParams({ eventId, sectionId, qty: String(quantity) }); el('picker-auto').href = `seat-assignment.php?${autoQuery}`;
    const categoryQuery = new URLSearchParams({ id: eventId, sectionId, qty: String(quantity) }); el('picker-back').href = `../public/event-detail.php?${categoryQuery}`;
    ['picker-back', 'picker-auto'].forEach(id => el(id).addEventListener('click', async event => { event.preventDefault(); if (!selectionLocked() && await release()) window.location.href = el(id).href; }));
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
    window.addEventListener('pageshow', event => { if (event.persisted) { leavingByBack = false; backGuard = !!window.history?.state?.tsSeatPickerGuard; refreshInterval = setInterval(refresh, 30000); uid = null; ready(); } });
    if (window.tsCurrentUser) ready();
})();
