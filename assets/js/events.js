const el = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
let allEvents = [];
let favoriteIds = new Set();
let savedOnly = new URLSearchParams(window.location.search).get('view') === 'saved';
let favoritesError = false;
let loadError = false;
let loading = true;
let loadVersion = 0;

const icons = {
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>'
};

function eventPrice(event) {
    const prices = Object.values(event.categories || {}).map(category => Number(category?.price ?? category?.unitPrice))
        .filter(price => Number.isFinite(price) && price > 0);
    return prices.length ? 'RM' + Math.min(...prices).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : event.startingPrice || 'Price TBA';
}

function eventCard(event) {
    const eventDate = event.date ? new Date(`${event.date}T${event.time || '00:00'}+08:00`) : null;
    const validDate = eventDate && !Number.isNaN(eventDate.valueOf());
    const dateOptions = { timeZone: 'Asia/Singapore' };
    const day = validDate ? eventDate.toLocaleDateString('en-GB', { ...dateOptions, day: '2-digit' }) : '--';
    const month = validDate ? eventDate.toLocaleDateString('en-GB', { ...dateOptions, month: 'short' }) : 'TBA';
    const date = validDate ? eventDate.toLocaleDateString('en-GB', { ...dateOptions, day: 'numeric', month: 'long', year: 'numeric' }) : 'Date to be announced';
    const time = validDate && event.time ? eventDate.toLocaleTimeString('en-MY', { ...dateOptions, hour: 'numeric', minute: '2-digit', hour12: true }) : '';
    let poster = '';
    if (event.posterUrl) {
        try {
            const url = new URL(event.posterUrl, window.location.href);
            if (['http:', 'https:'].includes(url.protocol)) poster = `<img class="ts-events-poster" src="${esc(url.href)}" alt="" loading="lazy" decoding="async">`;
        } catch (_) { /* Keep the designed cover when a poster is unavailable. */ }
    }
    return `<a class="ts-event-card" href="event-detail.php?id=${encodeURIComponent(event.id)}" aria-label="${esc('View ' + (event.name || 'event'))}">
        <div class="ts-event-art">
            <div class="ts-events-cover" aria-hidden="true"><span class="ts-events-cover-brand">TICKSECURE PRESENTS</span><span class="ts-events-cover-type">Live<br><i>experiences.</i></span><span class="ts-events-cover-line">BE PART OF THE MOMENT</span></div>
            ${poster}
            <div class="ts-events-date-stamp" aria-hidden="true"><strong>${esc(day)}</strong><span>${esc(month)}</span></div>
            ${favoriteIds.has(event.id) ? '<span class="ts-events-saved-mark" aria-label="Saved event">&#9829; Saved</span>' : ''}
        </div>
        <div class="ts-event-body">
            <div class="ts-events-card-type">${esc(event.eventCategory || 'Live event')}</div>
            <h3 class="ts-event-name">${esc(event.name || 'Event')}</h3>
            <div class="ts-event-date">${esc(date)}${time ? '<span>' + esc(time) + '</span>' : ''}</div>
            <div class="ts-event-meta">${icons.pin}<span>${esc(event.venueName || 'Venue to be announced')}</span></div>
            <div class="ts-event-foot"><div class="ts-events-card-price"><span>Tickets from</span><strong>${esc(eventPrice(event))}</strong></div>
                <span class="ts-events-card-action">View event <span>${icons.arrow}</span></span></div>
        </div></a>`;
}

function showMessage(message, signIn = false) {
    const note = document.createElement('div');
    note.className = 'text-center secondary ts-events-empty';
    note.textContent = message;
    if (signIn) {
        const link = document.createElement('a');
        link.className = 'ts-btn ts-btn-primary';
        link.href = '../auth/login.php';
        link.textContent = 'Sign in';
        note.appendChild(link);
    }
    el('events-grid').replaceChildren(note);
    el('events-count').textContent = '';
}

function renderEvents() {
    el('all-events-btn').setAttribute('aria-pressed', String(!savedOnly));
    el('saved-events-btn').setAttribute('aria-pressed', String(savedOnly));
    el('events-grid').setAttribute('aria-busy', String(loading));
    el('events-results-title').textContent = savedOnly ? 'Your saved events' : 'Explore events';
    if (loading) { showMessage('Loading events...'); return; }
    if (savedOnly && !window.tsCurrentUser?.uid) { showMessage('Sign in to view your saved events.', true); return; }
    if (loadError) { showMessage('Events could not be loaded. Refresh to try again.'); return; }
    if (savedOnly && favoritesError) { showMessage('Your saved events could not be loaded. Refresh to try again.'); return; }
    const query = el('event-search').value.trim().toLowerCase();
    const events = allEvents.filter(event => (!savedOnly || favoriteIds.has(event.id))
        && [event.name, event.venueName].some(value => String(value || '').toLowerCase().includes(query)));
    if (!events.length) {
        showMessage(query ? 'No events match your search.' : savedOnly
            ? 'No published events saved yet. Tap the heart on an event to save it here.' : 'No events found.');
    } else {
        el('events-grid').setAttribute('data-single', String(events.length === 1));
        el('events-grid').innerHTML = events.map(eventCard).join('');
        el('events-grid').querySelectorAll('.ts-events-poster').forEach(image => {
            image.addEventListener('error', () => { image.hidden = true; });
        });
    }
    el('events-count').textContent = `${events.length} ${savedOnly ? 'saved' : 'published'} event${events.length === 1 ? '' : 's'}${query ? ' matching your search' : ''}`;
}

function setView(saved) {
    savedOnly = saved;
    const url = new URL(window.location.href);
    saved ? url.searchParams.set('view', 'saved') : url.searchParams.delete('view');
    window.history.replaceState(null, '', url);
    renderEvents();
}

el('all-events-btn').addEventListener('click', () => setView(false));
el('saved-events-btn').addEventListener('click', () => setView(true));
el('event-search').addEventListener('input', renderEvents);
window.addEventListener('ts-auth-ready', async () => {
    const version = ++loadVersion;
    loading = true;
    loadError = false;
    favoritesError = false;
    allEvents = [];
    favoriteIds = new Set();
    renderEvents();
    const [events, favorites] = await Promise.allSettled([
        window.tsEvents.getPublishedEvents(),
        window.tsCurrentUser?.uid ? window.tsUsers.getFavoriteEventIds() : Promise.resolve([])
    ]);
    if (version !== loadVersion) return;
    allEvents = events.status === 'fulfilled' ? events.value : [];
    loadError = events.status === 'rejected';
    favoriteIds = new Set(favorites.status === 'fulfilled' ? favorites.value : []);
    favoritesError = favorites.status === 'rejected';
    loading = false;
    renderEvents();
});
