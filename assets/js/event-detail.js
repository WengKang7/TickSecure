const el = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const money = value => value !== '' && value != null && Number.isFinite(Number(value))
    ? 'RM' + Number(value).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Price TBA';
let currentEvent = null;
let categories = [];
let selectedSection = null;
let quantity = 1;
let saved = false;
let loadVersion = 0;
let availability = null;
let availabilityLoading = false;
let availabilityTimer = null;
const categoryAvailabilityLabels = new Map();

function remainingFor(sectionId) {
    const item = availability?.categories.find(item => item.sectionId === sectionId);
    return item ? item.remaining : null;
}

function renderAvailability() {
    el('event-remaining').textContent = availability
        ? `${availability.remaining} seat${availability.remaining === 1 ? '' : 's'} remaining`
        : availabilityLoading ? 'Checking remaining seats...' : 'Remaining seats unavailable';
    el('availability-note').textContent = availability
        ? 'Excludes sold tickets and active reservations. Updates every 30 seconds.'
        : availabilityLoading ? 'Sold tickets and active reservations are excluded.' : 'Refresh to try again. Availability is checked when you continue.';
    el('refresh-availability').disabled = availabilityLoading || !currentEvent;
    categories.forEach(category => {
        const count = remainingFor(category.sectionId);
        const label = categoryAvailabilityLabels.get(category.sectionId);
        if (label) {
            label.textContent = count === null ? (availabilityLoading ? 'Checking remaining seats...' : 'Remaining seats unavailable') : count === 0 ? 'Sold out' : `${count} seat${count === 1 ? '' : 's'} remaining`;
            label.className = 'ts-event-remaining' + (count === 0 ? ' is-sold-out' : '');
        }
    });
    el('cat-list').querySelectorAll('[data-category-section]').forEach(card => {
        card.disabled = categoryLimit(categories.find(category => category.sectionId === card.dataset.categorySection)) < 1;
    });
    el('ven-board').querySelectorAll('[data-section-id]').forEach(section => {
        const content = section.children[0];
        let label = content.children[2];
        if (!label) { label = document.createElement('span'); content.append(label); }
        const count = remainingFor(section.dataset.sectionId);
        const configured = categories.some(category => category.sectionId === section.dataset.sectionId);
        label.className = 'ts-event-map-remaining';
        label.textContent = !configured ? 'Not on sale for this event' : count === null ? (availabilityLoading ? 'Checking remaining seats...' : 'Remaining seats unavailable') : count === 0 ? 'Sold out' : `${count} remaining`;
    });
    highlightSection(selectedSection);
}

async function refreshAvailability(version = loadVersion) {
    if (!currentEvent || availabilityLoading) return;
    const eventId = currentEvent.id;
    availabilityLoading = true;
    el('refresh-availability').disabled = true;
    try {
        const result = await window.tsEvents.getEventAvailability(eventId);
        if (version !== loadVersion) return;
        if (result.eventId !== eventId || !Array.isArray(result.categories)
            || !Number.isInteger(result.remaining) || result.remaining < 0
            || !categories.every(category => result.categories.some(item => item.sectionId === category.sectionId
                && Number.isInteger(item.remaining) && item.remaining >= 0 && item.remaining <= category.quantity))) {
            throw new Error('Invalid availability response');
        }
        availability = result;
    } catch (error) {
        if (version !== loadVersion) return;
        availability = null;
        console.info('Seat availability unavailable:', error);
    } finally {
        if (version === loadVersion) {
            availabilityLoading = false;
            renderAvailability();
        }
    }
}

function salesMessage() {
    if (!currentEvent) return '';
    if (currentEvent.status && currentEvent.status !== 'PUBLISHED') return 'Sales unavailable';
    const parseDate = (value, end) => {
        const raw = String(value || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return Date.parse(raw + (end ? 'T23:59:59.999+08:00' : 'T00:00:00+08:00'));
        return Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(raw) ? raw + '+08:00' : raw);
    };
    if (currentEvent.salesStartDate) {
        const start = parseDate(currentEvent.salesStartDate, false);
        if (!Number.isFinite(start)) return 'Sales unavailable';
        if (Date.now() < start) return 'Sales not started';
    }
    if (currentEvent.salesEndDate) {
        const end = parseDate(currentEvent.salesEndDate, true);
        if (!Number.isFinite(end)) return 'Sales unavailable';
        if (Date.now() > end) return 'Sales closed';
    }
    return '';
}

function categoryLimit(category) {
    const configured = Number(currentEvent?.maxTicketsPerBuyer ?? 4);
    const maximum = Number.isInteger(configured) && configured >= 1 && configured <= 20 ? configured : 4;
    return category && Number(category.price) > 0 ? Math.min(maximum, category.quantity, remainingFor(category.sectionId) ?? category.quantity) : 0;
}

function updateOrder() {
    const category = categories.find(item => item.sectionId === selectedSection);
    const limit = categoryLimit(category);
    const salesStatus = salesMessage();
    const available = Boolean(currentEvent?.id && limit > 0 && !salesStatus);
    const signedIn = Boolean(window.tsCurrentUser?.uid);
    quantity = available ? Math.max(1, Math.min(quantity, limit)) : 1;
    el('event-order').hidden = !available || !signedIn;
    el('ticket-quantity').textContent = String(quantity);
    el('quantity-minus').disabled = !available || !signedIn || quantity <= 1;
    el('quantity-plus').disabled = !available || !signedIn || quantity >= limit;
    el('ticket-quantity-limit').textContent = `You can select up to ${limit} ticket${limit === 1 ? '' : 's'} in this category.`;
    el('ticket-subtotal').textContent = available ? money(category.price * quantity) : 'Unavailable';
    el('ticket-total').textContent = available ? money(category.price * quantity + 20) : 'Unavailable';
    const button = el('category-book-btn');
    button.textContent = salesStatus || (category && remainingFor(category.sectionId) === 0 ? 'Sold out' : !signedIn ? 'Sign in to book' : available ? 'Continue to seat assignment' : 'Select a ticket category');
    const params = new URLSearchParams({ eventId: currentEvent?.id || '', sectionId: selectedSection || '', qty: String(quantity) });
    button.href = signedIn && available ? `../buyer/seat-assignment.php?${params}` : '../auth/login.php';
    button.setAttribute('aria-disabled', String(!currentEvent?.id || Boolean(salesStatus) || (category && remainingFor(category.sectionId) === 0) || (signedIn && !available)));
}

function showLayoutMessage(message) {
    const note = document.createElement('div');
    note.className = 'ts-event-layout-empty';
    note.textContent = message;
    el('ven-board').replaceChildren(note);
    el('ven-status').textContent = 'Seating plan';
    el('ven-status').className = 'ts-chip ts-chip-neutral';
    el('venue-section-count').textContent = '';
}

function highlightSection(sectionId) {
    if (selectedSection !== sectionId) quantity = 1;
    selectedSection = sectionId;
    el('ven-board').querySelectorAll('[data-section-id]').forEach(section => {
        const selected = section.dataset.sectionId === sectionId;
        section.classList.toggle('is-selected', selected);
        section.setAttribute('aria-pressed', String(selected));
    });
    el('cat-list').querySelectorAll('[data-category-section]').forEach(card => {
        const selected = card.dataset.categorySection === sectionId;
        card.classList.toggle('is-selected', selected);
        card.setAttribute('aria-pressed', String(selected));
    });
    const category = categories.find(item => item.sectionId === sectionId);
    el('selected-category-label').textContent = category ? category.name : 'Tickets from';
    el('selected-category-price').textContent = category ? money(category.price) : startingPrice();
    el('category-selection-note').textContent = salesMessage() || (category
        ? categoryLimit(category) > 0 ? `${category.name} / Section ${sectionId}. ${window.tsCurrentUser?.uid ? 'Choose your quantity below.' : 'Sign in to book tickets.'}` : 'Tickets are not available in this category.'
        : 'Select a ticket category from the list or venue layout.');
    updateOrder();
}

function startingPrice() {
    const prices = categories.filter(category => category.price !== '' && category.price != null)
        .map(category => Number(category.price)).filter(Number.isFinite);
    return prices.length ? money(Math.min(...prices)) : currentEvent?.startingPrice || 'Price TBA';
}

function renderCategories(event) {
    const source = Array.isArray(event.categories)
        ? event.categories.map((category, index) => [category?.sectionId || category?.id || category?.section || String(index), category])
        : Object.entries(event.categories || {});
    categories = source.filter(([, category]) => category && typeof category === 'object').map(([sectionId, category]) => ({
        ...category, sectionId: String(category.sectionId || category.id || category.section || sectionId), name: category.name || category.categoryName || 'Section ' + sectionId,
        price: Number(String(category.price ?? category.unitPrice ?? '').replace(/[^\d.-]/g, '')),
        quantity: Math.max(0, Math.floor(Number(category.quantity ?? category.available) || 0))
    }));
    categoryAvailabilityLabels.clear();
    const cards = categories.map(category => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'ts-event-category';
        card.dataset.categorySection = category.sectionId;
        card.setAttribute('aria-pressed', 'false');
        card.disabled = categoryLimit(category) < 1;
        const info = document.createElement('span');
        const name = document.createElement('strong');
        name.textContent = category.name;
        const detail = document.createElement('span');
        detail.className = 'small secondary';
        const allocation = Math.max(0, Number(category.quantity) || 0);
        detail.textContent = `Section ${category.sectionId} / ${allocation ? allocation + ' tickets allocated' : 'Ticket setup pending'}`;
        const remaining = document.createElement('span');
        remaining.className = 'ts-event-remaining';
        remaining.textContent = 'Checking remaining seats...';
        categoryAvailabilityLabels.set(category.sectionId, remaining);
        info.append(name, detail, remaining);
        const price = document.createElement('strong');
        price.className = 'ts-event-category-price';
        price.textContent = money(category.price);
        card.append(info, price);
        card.addEventListener('click', () => highlightSection(category.sectionId));
        return card;
    });
    if (!cards.length) {
        const empty = document.createElement('p');
        empty.className = 'small secondary';
        empty.textContent = 'Ticket categories have not been configured yet.';
        cards.push(empty);
    }
    el('cat-list').replaceChildren(...cards);
    el('category-count').textContent = `${categories.length} ${categories.length === 1 ? 'category' : 'categories'} / automatic seat assignment`;
    el('ev-price').innerHTML = `<strong>From ${esc(startingPrice())}</strong><span>Availability checked at booking</span>`;
    const params = new URLSearchParams(window.location.search);
    quantity = 1;
    highlightSection(params.get('sectionId'));
    const requestedQuantity = Number(params.get('qty'));
    if (Number.isInteger(requestedQuantity) && requestedQuantity > 0) quantity = requestedQuantity;
    updateOrder();
}

function renderEvent(event) {
    currentEvent = event;
    el('ev-title').textContent = event.name || 'Event';
    document.title = `${event.name || 'Event Details'} / TickSecure`;
    el('ev-category').textContent = event.eventCategory || 'Live event';
    const description = event.description || 'More event information will be provided by the organizer.';
    el('ev-desc').textContent = description;
    el('ev-about').textContent = description;
    const date = event.date ? new Date(`${event.date}T${event.time || '00:00'}`) : null;
    el('ev-date').innerHTML = date && !Number.isNaN(date.valueOf())
        ? `<strong>${esc(date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))}</strong><span>${esc(event.time ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time TBA')}</span>`
        : '<strong>Date to be announced</strong>';
    el('ev-venue').innerHTML = `<strong>${esc(event.venueName || 'Venue TBA')}</strong><span>${esc(event.venueLocation || 'Location to be announced')}</span>`;
    el('ev-org').innerHTML = `<strong>${esc(event.organizerName || 'Organizer TBA')}</strong><span>Event organizer</span>`;
    const poster = el('event-poster');
    poster.hidden = true;
    if (event.posterUrl) {
        try {
            const url = new URL(event.posterUrl, window.location.origin);
            if (['http:', 'https:'].includes(url.protocol)) {
                poster.src = url.href;
                poster.alt = event.name || 'Event poster';
                poster.hidden = false;
            }
        } catch (_) { /* The summary remains usable without a poster. */ }
    }
    el('ven-name').textContent = event.venueName || 'Venue TBA';
    el('ven-address').textContent = event.venueLocation || 'Detailed venue information is not available.';
    renderCategories(event);
    const transferEnabled = event.transferEnabled !== false;
    const resaleEnabled = event.resaleEnabled !== false;
    ['ev-transfer', 'ev-resale'].forEach((id, index) => {
        const allowed = index === 0 ? transferEnabled : resaleEnabled;
        el(id).innerHTML = `<span class="ts-chip ts-chip-${allowed ? 'info' : 'neutral'}">${allowed ? 'Allowed' : 'Not allowed'}</span>`;
    });
    el('transfer-policy').textContent = transferEnabled
        ? 'Eligible tickets can be transferred to a valid wallet through TickSecure.' : 'Ticket transfer is not enabled for this event.';
    el('resale-policy').textContent = resaleEnabled
        ? 'Official resale follows the organizer\'s timing and price limits.' : 'Official resale is not enabled for this event.';
}

async function loadVenue(event, version) {
    if (!event.venueId) { showLayoutMessage('The organizer has not selected a venue layout yet.'); return; }
    if (!window.tsCurrentUser?.uid) {
        showLayoutMessage('Sign in to view the approved seating layout. You can browse ticket categories here.');
        return;
    }
    try {
        const venue = await window.tsVenues.getVenue(event.venueId);
        if (version !== loadVersion) return;
        if (!venue || venue.layoutStatus !== 'ACTIVE' || !Array.isArray(venue.sections) || !venue.sections.length) {
            showLayoutMessage('The venue seating layout is not available yet.');
            return;
        }
        // Same section order, positions, stage, sizes and CSS as the admin layout.
        window.tsVenueRenderer.renderBoard('ven-board', venue.sections, { onSectionSelect: highlightSection });
        el('ven-name').textContent = venue.name || event.venueName || 'Venue';
        el('ven-address').textContent = venue.address || event.venueLocation || 'Approved physical venue layout';
        el('venue-section-count').textContent = `${venue.sections.length} sections / ${venue.sections.reduce((sum, section) => sum + (Number(section.seatCount) || 0), 0)} physical seats`;
        el('ven-status').textContent = 'Approved layout';
        el('ven-status').className = 'ts-chip ts-chip-success';
        renderAvailability();
    } catch (error) {
        if (version !== loadVersion) return;
        console.info('Venue layout unavailable:', error);
        showLayoutMessage('The approved seating layout could not be loaded. Event details and ticket categories are shown here.');
    }
}

function updateSaveLabel() {
    const button = el('save-event-btn');
    const label = saved ? 'Remove from saved events' : 'Save event';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', String(saved));
}

async function loadFavorite(eventId, version) {
    const uid = window.tsCurrentUser?.uid || null;
    saved = false;
    updateSaveLabel();
    if (!uid) return;
    try {
        const favorites = await window.tsUsers.getFavoriteEventIds();
        if (version !== loadVersion || uid !== window.tsCurrentUser?.uid) return;
        saved = favorites.includes(eventId);
        updateSaveLabel();
    } catch (error) { console.info('Saved events unavailable:', error); }
}

el('refresh-availability').addEventListener('click', () => refreshAvailability());
window.addEventListener('focus', () => { if (!document.hidden) refreshAvailability(); });
el('event-poster').addEventListener('error', () => { el('event-poster').hidden = true; });
el('quantity-minus').addEventListener('click', () => {
    if (el('quantity-minus').disabled) return;
    quantity -= 1;
    updateOrder();
});
el('quantity-plus').addEventListener('click', () => {
    if (el('quantity-plus').disabled) return;
    quantity += 1;
    updateOrder();
});
el('category-book-btn').addEventListener('click', event => {
    if (el('category-book-btn').getAttribute('aria-disabled') === 'true') event.preventDefault();
});
el('save-event-btn').addEventListener('click', async () => {
    if (!window.tsCurrentUser?.uid) { window.location.href = '../auth/login.php'; return; }
    if (!currentEvent?.id || el('save-event-btn').disabled) return;
    const uid = window.tsCurrentUser.uid;
    const eventId = currentEvent.id;
    const nextSaved = !saved;
    const version = loadVersion;
    el('save-event-btn').disabled = true;
    try {
        await window.tsUsers.setFavoriteEvent(eventId, nextSaved);
        if (version !== loadVersion || uid !== window.tsCurrentUser?.uid) return;
        saved = nextSaved;
        updateSaveLabel();
        window.tsShowToast?.(saved ? 'Event saved to your account' : 'Event removed from saved list');
    } catch (error) {
        if (version === loadVersion) alert(error.message || 'This event could not be saved.');
    }
    finally { if (version === loadVersion) el('save-event-btn').disabled = false; }
});

window.addEventListener('ts-auth-ready', async () => {
    const version = ++loadVersion;
    if (availabilityTimer !== null) window.clearInterval(availabilityTimer);
    availability = null;
    availabilityLoading = false;
    el('event-remaining').textContent = 'Checking remaining seats...';
    el('refresh-availability').disabled = true;
    el('save-event-btn').disabled = true;
    currentEvent = null;
    categories = [];
    selectedSection = null;
    quantity = 1;
    updateOrder();
    el('event-error').hidden = true;
    showLayoutMessage('Loading the seating layout...');
    const eventId = new URLSearchParams(window.location.search).get('id');
    try {
        if (!eventId) throw new Error('Choose an event from the events page to view its details.');
        const event = await window.tsEvents.getEvent(eventId);
        if (version !== loadVersion) return;
        if (!event) throw new Error('This event could not be found.');
        renderEvent({ ...event, id: eventId });
        await Promise.allSettled([loadVenue(event, version), loadFavorite(eventId, version), refreshAvailability(version)]);
        if (version === loadVersion) availabilityTimer = window.setInterval(() => {
            if (!document.hidden) refreshAvailability(version);
        }, 30000);
        if (version === loadVersion) el('save-event-btn').disabled = false;
    } catch (error) {
        if (version !== loadVersion) return;
        currentEvent = null;
        availability = null;
        el('event-remaining').textContent = 'Remaining seats unavailable';
        el('availability-note').textContent = '';
        el('ev-title').textContent = 'Event details unavailable';
        el('event-error').textContent = error.message || 'Unable to load this event. Please try again.';
        el('event-error').hidden = false;
        el('event-poster').hidden = true;
        ['ev-date', 'ev-venue', 'ev-org', 'ev-price'].forEach(id => { el(id).textContent = 'Unavailable'; });
        el('selected-category-label').textContent = 'Tickets';
        el('selected-category-price').textContent = 'Unavailable';
        el('ev-about').textContent = 'No event information is available.';
        el('category-selection-note').textContent = '';
        el('cat-list').replaceChildren();
        el('category-count').textContent = 'No categories to display';
        el('ev-desc').textContent = 'Return to events to choose another event.';
        showLayoutMessage('Select an available event to view its venue layout.');
    }
});
