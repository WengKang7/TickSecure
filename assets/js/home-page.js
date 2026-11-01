const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

export function updateHomeAccountActions(profile, root = document) {
    root.querySelectorAll('[data-home-guest]').forEach(link => { link.hidden = Boolean(profile); });
}

export function selectUpcomingEvents(events, now = new Date()) {
    // Event dates belong to Malaysia's calendar, regardless of the visitor's timezone.
    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(now);
    return events.filter(event => !event.date || (/^\d{4}-\d{2}-\d{2}$/.test(event.date) && event.date >= today))
        .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '').localeCompare(b.time || ''))
        .slice(0, 3);
}

export function homeEventPrice(event) {
    const prices = Object.values(event.categories || {}).map(category => Number(category?.price ?? category?.unitPrice))
        .filter(price => Number.isFinite(price) && price >= 0);
    if (prices.length) {
        const lowest = Math.min(...prices);
        return lowest === 0 ? 'Free' : 'RM' + lowest.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return event.startingPrice || 'Price TBA';
}

export function safeHomePoster(value, base) {
    if (!value) return '';
    try {
        const url = new URL(value, base);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
}

export function initHomeSlideshow(root = document, browser = window) {
    const showcase = root.querySelector('.home-showcase');
    if (!showcase) return;
    const slides = [...showcase.querySelectorAll('.home-slide')];
    const dots = [...showcase.querySelectorAll('[data-home-slide]')];
    const pause = root.getElementById('home-slide-pause');
    const track = root.getElementById('home-slides');
    const motion = browser.matchMedia('(prefers-reduced-motion: reduce)');
    let active = 0, timer, paused = motion.matches, hovering = false, focused = false;
    const show = index => {
        active = (index + slides.length) % slides.length;
        slides.forEach((slide, position) => {
            slide.classList.toggle('is-active', position === active);
            slide.setAttribute('aria-hidden', String(position !== active));
            dots[position].setAttribute('aria-pressed', String(position === active));
        });
    };
    const schedule = () => {
        browser.clearInterval(timer);
        const stopped = paused || hovering || focused || root.hidden;
        track.setAttribute('aria-live', stopped ? 'polite' : 'off');
        pause.setAttribute('aria-pressed', String(paused));
        pause.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
        pause.innerHTML = paused
            ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6Z"/></svg>'
            : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg>';
        if (!stopped && slides.length > 1) timer = browser.setInterval(() => show(active + 1), 6500);
    };
    dots.forEach((dot, index) => dot.addEventListener('click', () => { show(index); schedule(); }));
    root.getElementById('home-slide-next').addEventListener('click', () => { show(active + 1); schedule(); });
    pause.addEventListener('click', () => { paused = !paused; schedule(); });
    showcase.addEventListener('mouseenter', () => { hovering = true; schedule(); });
    showcase.addEventListener('mouseleave', () => { hovering = false; schedule(); });
    showcase.addEventListener('focusin', () => { focused = true; schedule(); });
    showcase.addEventListener('focusout', event => {
        focused = showcase.contains(event.relatedTarget);
        schedule();
    });
    motion.addEventListener('change', event => { paused = event.matches; schedule(); });
    root.addEventListener('visibilitychange', schedule);
    browser.addEventListener('pagehide', () => browser.clearInterval(timer));
    browser.addEventListener('pageshow', schedule);
    schedule();
}

function eventCard(event, scene) {
    const date = event.date ? new Date(`${event.date}T${event.time || '00:00'}+08:00`) : null;
    const valid = date && !Number.isNaN(date.valueOf());
    const options = { timeZone: 'Asia/Kuala_Lumpur' };
    const day = valid ? date.toLocaleDateString('en-GB', { ...options, day: '2-digit' }) : '—';
    const month = valid ? date.toLocaleDateString('en-GB', { ...options, month: 'short' }) : 'TBA';
    const dateLabel = valid ? date.toLocaleDateString('en-GB', { ...options, day: 'numeric', month: 'long', year: 'numeric' }) : 'Date to be announced';
    const poster = safeHomePoster(event.posterUrl, window.location.href);
    return `<a class="home-event-card" href="public/event-detail.php?id=${encodeURIComponent(event.id)}" aria-label="${escapeHtml('View ' + (event.name || 'event'))}">
        <div class="home-event-cover"><img class="home-event-fallback" src="${escapeHtml(scene)}" alt="" loading="lazy" width="1200" height="1100">
            ${poster ? `<img class="home-event-poster" src="${escapeHtml(poster)}" alt="" loading="lazy" decoding="async">` : ''}
            <div class="home-date-stamp" aria-hidden="true"><b>${escapeHtml(day)}</b><span>${escapeHtml(month)}</span></div>
            <span class="home-event-type">${escapeHtml(event.eventCategory || 'Live experience')}</span></div>
        <div class="home-event-body"><p class="home-event-date">${escapeHtml(dateLabel)}</p><h3>${escapeHtml(event.name || 'Event')}</h3>
            <p class="home-event-venue">${escapeHtml(event.venueName || 'Venue to be announced')}</p>
            <div class="home-event-foot"><span>${homeEventPrice(event) === 'Free' ? 'Entry' : 'Tickets from'}<strong>${escapeHtml(homeEventPrice(event))}</strong></span><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></i></div>
        </div></a>`;
}

function initHome() {
    initHomeSlideshow();
    const grid = document.getElementById('featured-events-grid');
    const scene = document.querySelector('.home-scene').getAttribute('src');
    let loaded = false;
    async function loadEvents() {
        if (loaded || !window.tsEvents) return;
        loaded = true;
        try {
            const featured = selectUpcomingEvents(await window.tsEvents.getPublishedEvents());
            grid.innerHTML = featured.length ? featured.map(event => eventCard(event, scene)).join('')
                : '<p class="home-events-message">The next great experience is on its way.<br><a href="public/events.php">Explore all events</a></p>';
            grid.querySelectorAll('.home-event-poster').forEach(image => {
                image.addEventListener('error', () => { image.hidden = true; });
                if (image.complete && !image.naturalWidth) image.hidden = true;
            });
        } catch (error) {
            loaded = false;
            grid.innerHTML = '<p class="home-events-message">We couldn’t load events just now.<br><a href="public/events.php">Browse events to try again</a></p>';
            console.error('Unable to load homepage events:', error);
        } finally { grid.setAttribute('aria-busy', 'false'); }
    }
    window.addEventListener('ts-auth-ready', event => { updateHomeAccountActions(event.detail); loadEvents(); });
    window.addEventListener('ts-profile-updated', event => updateHomeAccountActions(event.detail));
    if (window.tsCurrentUser !== undefined) { updateHomeAccountActions(window.tsCurrentUser); loadEvents(); }
}

if (typeof document !== 'undefined' && document.querySelector('.ts-home')) initHome();
