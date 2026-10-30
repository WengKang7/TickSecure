(() => {
    const el = id => document.getElementById(id);
    if (!el('event-detail-container')) return;
    const eventId = new URLSearchParams(window.location.search).get('id');
    const statuses = { DRAFT: 'Draft', PENDING_REVIEW: 'Pending review', PUBLISHED: 'Published',
        APPROVED: 'Approved', REJECTED: 'Rejected', SUSPENDED: 'Suspended', CANCELLED: 'Cancelled' };
    const tones = { PENDING_REVIEW: 'warning', PUBLISHED: 'success', APPROVED: 'info',
        REJECTED: 'error', SUSPENDED: 'warning', CANCELLED: 'error' };
    const statusName = value => statuses[value] || String(value || 'Not provided').replaceAll('_', ' ');
    const text = (id, value, fallback = 'Not provided') => { el(id).textContent = value || fallback; };
    const node = (tag, value, className = '') => {
        const result = document.createElement(tag);
        result.textContent = value;
        result.className = className;
        return result;
    };
    const number = value => value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value);
    const count = value => number(value) == null ? 'Not set' : Number(value).toLocaleString('en-MY');
    const money = value => number(value) == null ? 'Not set' : 'RM' + Number(value).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const date = value => window.tsEventPolicy.date(value);
    const timestamp = value => window.tsEventPolicy.timestamp(value);
    let initialized = false, busy = false, currentEventName = 'Selected event', currentEventStatus = null;
    const allowedActions = { approve: ['PENDING_REVIEW'], reject: ['PENDING_REVIEW'], suspend: ['PUBLISHED', 'APPROVED'] };

    function error(message) {
        text('review-error', message);
        el('review-error').hidden = false;
        el('review-error').scrollIntoView({ behavior: 'smooth', block: 'center' });
        el('review-error').focus({ preventScroll: true });
    }

    function poster(event) {
        const image = el('val-poster'), copy = el('poster-copy'), link = el('poster-link');
        text('poster-org', event.organizerName, 'Organizer');
        text('poster-title', event.name, 'Event');
        image.hidden = link.hidden = true;
        copy.hidden = false;
        image.removeAttribute('src');
        link.removeAttribute('href');
        try {
            if (!event.posterUrl) return;
            const url = new URL(event.posterUrl, window.location.href);
            if (!['http:', 'https:'].includes(url.protocol)) return;
            image.alt = `Promotional poster for ${event.name || 'this event'}`;
            image.onerror = () => { image.hidden = link.hidden = true; copy.hidden = false; };
            image.src = link.href = url.href;
            image.hidden = link.hidden = false;
            copy.hidden = true;
        } catch { /* Keep the text preview when the artwork URL is invalid. */ }
    }

    function renderTickets(event, venue) {
        const categories = Array.isArray(event.categories)
            ? event.categories.map(category => ({ ...category, sectionId: category.sectionId || category.section || category.id || '' }))
            : Object.entries(event.categories || {}).map(([sectionId, category]) => ({ ...category, sectionId }));
        const sections = Array.isArray(venue?.sections) ? venue.sections : [];
        const body = el('ticket-table-body');
        body.replaceChildren();
        for (const category of categories) {
            const id = String(category.sectionId || '');
            const section = sections.find(item => String(item.sectionId || item.letter || item.id || '') === id);
            const row = document.createElement('tr');
            const exact = Array.isArray(category.seatLabels);
            const mapped = exact ? sections.filter(s => category.seatLabels.some(label => label.startsWith(s.sectionId + '-'))) : [];
            const capacity = exact ? mapped.reduce((sum, s) => sum + (number(s.seatCount ?? s.seats) || 0), 0) : section ? number(section.seatCount ?? section.seats) : null;
            [category.name || 'Unnamed category', exact ? `${category.seatLabels.length} selected seats · ${mapped.map(s => s.name).join(', ')}` : section?.name || (id ? `Section ${id}` : 'Not mapped'),
                money(category.price), count(category.quantity), capacity == null ? 'Not available' : count(capacity)]
                .forEach(value => row.appendChild(node('td', value)));
            body.appendChild(row);
        }
        if (!categories.length) {
            const cell = node('td', 'No ticket categories configured.', 'text-center secondary');
            cell.colSpan = 5;
            const row = document.createElement('tr');
            row.appendChild(cell);
            body.appendChild(row);
        }
        const quantities = categories.map(category => number(category.quantity));
        const total = quantities.some(value => value == null) ? 'Not fully configured' : count(quantities.reduce((sum, value) => sum + value, 0));
        const prices = categories.map(category => number(category.price)).filter(value => value != null);
        const priceRange = !prices.length ? 'Not set' : Math.min(...prices) === Math.max(...prices)
            ? money(prices[0]) : `${money(Math.min(...prices))} – ${money(Math.max(...prices))}`;
        const totals = el('ticket-totals');
        totals.replaceChildren();
        [['Categories', count(categories.length)], ['Tickets offered', total], ['Price per ticket', priceRange]].forEach(([label, value]) => {
            const item = document.createElement('div');
            item.append(node('span', label), node('strong', value));
            totals.appendChild(item);
        });
    }

    function renderHistory(event, organizer) {
        const history = (Array.isArray(event.statusHistory) ? event.statusHistory : [])
            .filter(item => item && typeof item === 'object')
            .slice().sort((a, b) => (timestamp(a.timestamp) || 0) - (timestamp(b.timestamp) || 0));
        const submitted = history.filter(item => item.to === 'PENDING_REVIEW').at(-1)?.timestamp || event.submittedAt;
        text('val-created', date(event.createdAt));
        text('val-submitted', date(submitted), 'Not recorded');
        text('val-updated', date(event.updatedAt));
        const timeline = el('review-history');
        timeline.replaceChildren();
        const labels = { DRAFT: 'Event saved as draft', PENDING_REVIEW: 'Submitted for approval',
            PUBLISHED: 'Approved and published', REJECTED: 'Event rejected', SUSPENDED: 'Event suspended', CANCELLED: 'Event cancelled' };
        if (!history.length) timeline.appendChild(node('p', 'No submission or decision history recorded.', 'small secondary'));
        history.forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = 'ts-timeline-item' + (index === history.length - 1 ? ' current' : '');
            item.appendChild(node('div', labels[entry.to] || statusName(entry.to), 'ts-timeline-title'));
            let actor = '';
            if (entry.changedBy && entry.changedBy === event.organizerUid) actor = organizer?.fullName || event.organizerName || 'Organizer';
            else if (entry.changedBy && entry.changedBy === window.tsCurrentUser?.uid) actor = 'Your administrator account';
            item.appendChild(node('div', date(entry.timestamp) + (actor ? ` · ${actor}` : ''), 'ts-timeline-meta'));
            if (entry.reason) item.appendChild(node('p', `Reason: ${entry.reason}`, 'small secondary ts-review-history-reason'));
            timeline.appendChild(item);
        });
        // Older moderation records may only store the reason on the event itself.
        const reason = event.status === 'REJECTED' ? event.rejectReason : event.status === 'SUSPENDED' ? event.suspendReason : '';
        if (reason && !history.some(entry => entry.to === event.status && entry.reason === reason)) {
            timeline.appendChild(node('p', `Current decision reason: ${reason}`, 'small secondary ts-review-history-reason'));
        }
    }

    function render(event, venue, organizer, organization) {
        currentEventName = event.name || 'Untitled event';
        const status = String(event.status || 'DRAFT').toUpperCase();
        currentEventStatus = status;
        document.querySelector('.ts-page-title').textContent = event.name || 'Event Review';
        document.querySelector('.ts-page-subtitle').textContent = `Submitted by ${event.organizerName || organizer?.fullName || 'Unknown organizer'}`;
        poster(event);
        const badges = el('val-badges');
        badges.replaceChildren(node('span', statusName(status), `ts-chip ts-chip-${tones[status] || 'neutral'}`));
        if (event.eventCategory) badges.appendChild(node('span', event.eventCategory, 'ts-chip ts-chip-neutral'));
        text('val-status', statusName(status));
        text('val-schedule', event.date && event.time ? date(`${event.date}T${event.time}`)
            : event.date ? `${date(event.date).split(',')[0]} · Start time not set` : 'Not set');
        text('val-category', event.eventCategory);
        text('val-venue-name', event.venueName || venue?.name, 'Not configured');
        text('val-location', event.venueLocation || venue?.address);
        text('val-desc', event.description, 'No description provided.');
        renderTickets(event, venue);
        window.tsEventPolicy.render(el('review-rules'), event);
        text('val-org-name', organizer?.fullName || event.organizerName, 'Unknown organizer');
        text('val-org-company', organization?.organizationName || organizer?.organizationName);
        text('val-org-email', organizer?.email);
        text('val-org-phone', organization?.organizationPhone || organizer?.organizationPhone || organizer?.phone);
        text('val-org-address', organization?.organizationAddress || organizer?.organizationAddress || organizer?.address);
        text('val-org-status', organizer?.status ? String(organizer.status).replace(/^./, character => character.toUpperCase()) : null, 'Not available');
        const organizerLink = el('organizer-link');
        organizerLink.hidden = !event.organizerUid;
        if (event.organizerUid) organizerLink.href = `organizer-detail.php?id=${encodeURIComponent(event.organizerUid)}`;
        text('val-layout-status', venue
            ? `${venue.name || 'Venue'} · Layout status: ${statusName(venue.layoutStatus)} · ${count(venue.capacity ?? venue.sections?.reduce((sum, section) => sum + (number(section.seatCount) || 0), 0))} physical seats`
            : 'The current venue layout is not available. Submitted venue details are shown above.');
        el('review-venue-board').replaceChildren();
        el('review-venue-board').hidden = !venue?.sections?.length;
        if (venue?.sections?.length) window.tsVenueRenderer.renderBoard('review-venue-board', window.tsSeatCategories?.project(venue.sections, event.categories) || venue.sections, { cleanLayout: true, seatOnly: true });
        el('venue-link').hidden = !venue;
        if (venue) el('venue-link').href = `venue-layout.php?id=${encodeURIComponent(event.venueId)}`;
        renderHistory(event, organizer);
        el('action-buttons').hidden = !['PENDING_REVIEW', 'PUBLISHED', 'APPROVED'].includes(status);
        el('btn-approve').hidden = el('btn-reject').hidden = status !== 'PENDING_REVIEW';
        el('btn-suspend').hidden = !['PUBLISHED', 'APPROVED'].includes(status);
        el('event-detail-container').hidden = false;
    }

    async function loadEvent() {
        currentEventStatus = null;
        el('action-buttons').hidden = true;
        el('review-error').hidden = el('review-retry').hidden = el('review-notice').hidden = true;
        try {
            const event = await window.tsEvents.getAdminEvent(eventId);
            if (!event || !['PENDING_REVIEW', 'PUBLISHED', 'APPROVED', 'REJECTED', 'SUSPENDED', 'CANCELLED'].includes(event.status)) {
                throw new Error('Event not found or not submitted for review. Drafts are visible only in the organizer workspace.');
            }
            const results = await Promise.allSettled([
                event.venueId ? window.tsVenues.getVenue(event.venueId) : Promise.resolve(null),
                event.organizerUid ? window.tsUsers.getUser(event.organizerUid) : Promise.resolve(null),
                event.organizerUid ? window.tsUsers.getOrganizerProfile(event.organizerUid) : Promise.resolve(null)
            ]);
            const [venue, organizer, organization] = results.map(result => result.status === 'fulfilled' ? result.value : null);
            const notices = [];
            if (!venue) notices.push('The current venue layout could not be found or loaded; section capacities are unavailable.');
            if (!organizer) notices.push('The organizer account could not be found or loaded; submitted organizer details are shown where available.');
            if (results[2].status === 'rejected') notices.push('Additional organization contact details could not be loaded.');
            if (notices.length) {
                text('review-notice', notices.join(' '));
                el('review-notice').hidden = false;
            }
            render(event, venue, organizer, organization);
        } catch (failure) {
            el('event-detail-container').hidden = el('action-buttons').hidden = true;
            el('review-retry').hidden = false;
            document.querySelector('.ts-page-title').textContent = 'Unable to load event';
            error(failure?.message || 'Unable to load event information. Please try again.');
        }
    }

    async function moderate(action) {
        if (busy || !allowedActions[action]?.includes(currentEventStatus)) return;
        busy = true;
        const buttons = ['btn-approve', 'btn-reject', 'btn-suspend'].map(el);
        try {
            const decision = await window.tsAdminConfirm(action + 'Event', currentEventName);
            if (!decision) return;
            buttons.forEach(button => { button.disabled = true; });
            el('review-error').hidden = true;
            const latest = await window.tsEvents.getAdminEvent(eventId);
            if (!latest || !allowedActions[action].includes(latest.status)) {
                await loadEvent();
                if (latest && latest.status !== 'DRAFT') error('The event status has changed. Review its current status before taking another action.');
                return;
            }
            if (action === 'approve') await window.tsEvents.approveEvent(eventId);
            else if (action === 'reject') await window.tsEvents.rejectEvent(eventId, decision.reason);
            else await window.tsEvents.suspendEvent(eventId, decision.reason);
            await loadEvent();
        } catch (failure) {
            error(failure?.message || 'Unable to save the decision. Please try again.');
        } finally {
            busy = false;
            buttons.forEach(button => { button.disabled = false; });
        }
    }

    el('btn-approve').addEventListener('click', () => moderate('approve'));
    el('btn-reject').addEventListener('click', () => moderate('reject'));
    el('btn-suspend').addEventListener('click', () => moderate('suspend'));
    el('review-retry').addEventListener('click', loadEvent);
    function ready() {
        if (initialized || window.tsCurrentUser?.role !== 'admin' || window.tsCurrentUser.status !== 'active') return;
        initialized = true;
        if (!eventId) {
            document.querySelector('.ts-page-title').textContent = 'Event not found';
            error('No event was selected for review. Return to Events and select an event.');
            return;
        }
        return loadEvent();
    }
    window.addEventListener('ts-auth-ready', ready);
    ready();
})();
