<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<div class="ts-organizer-event-detail">
    <a href="events.php" class="ts-organizer-event-back">← Back to my events</a>
    <header class="ts-organizer-event-hero">
        <div class="ts-organizer-event-heading">
            <div class="ts-organizer-event-art">
                <span id="event-art-fallback"><?=ts_icon('ticket', 'ts-icon-lg')?></span>
                <img id="event-detail-poster" alt="Event poster" hidden>
            </div>
            <div class="ts-organizer-event-title">
                <div class="ts-organizer-event-heading-line"><span class="ts-organizer-event-kicker">EVENT DETAILS</span><div id="status-chips"><?=ts_status('Loading', 'neutral')?></div></div>
                <h1 class="ts-page-title">Loading event…</h1>
                <p class="ts-page-subtitle">Your event information and ticket performance.</p>
                <p id="event-last-updated" class="ts-organizer-event-updated"></p>
            </div>
        </div>
        <div class="ts-organizer-event-actions">
            <a class="ts-btn ts-btn-secondary" href="../public/event-detail.php?preview=1" id="preview-link" hidden><?=ts_icon('eye')?> Preview public page</a>
            <button class="ts-btn ts-btn-primary" id="edit-event-btn" hidden><?=ts_icon('edit')?> Edit event</button>
        </div>
    </header>
    <div id="event-detail-error" class="ts-alert ts-alert-error mt-24" role="alert" hidden></div>
    <div data-tabs id="event-detail-tabs" hidden>
        <nav class="ts-tabs ts-organizer-event-tabs" aria-label="Event detail sections">
            <button class="ts-tab active" data-tab="overview">Overview</button>
            <button class="ts-tab" data-tab="tickets">Ticket Configuration</button>
            <button class="ts-tab" data-tab="rules">Sales Rules</button>
            <button class="ts-tab" data-tab="history">Status History</button>
            <button class="ts-tab" data-tab="sales">Sales</button>
        </nav>
        <div class="ts-tab-panel active" data-panel="overview">
            <div class="ts-grid-3 ts-organizer-event-metrics">
                <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>Tickets sold</span><span class="ts-kpi-icon"><?=ts_icon('ticket')?></span></div><div class="ts-kpi-value" id="overview-sold">—</div><p class="ts-kpi-label" id="overview-sold-sub">Confirmed bookings</p></div>
                <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>Remaining tickets</span><span class="ts-kpi-icon"><?=ts_icon('layers')?></span></div><div class="ts-kpi-value" id="overview-remaining">—</div><p class="ts-kpi-label">Allocation minus confirmed sales</p></div>
                <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>Recorded sales</span><span class="ts-kpi-icon"><?=ts_icon('chart')?></span></div><div class="ts-kpi-value" id="overview-rev">—</div><p class="ts-kpi-label">Simulated initial checkout totals</p></div>
            </div>
            <div class="ts-organizer-event-overview-grid">
                <section class="ts-card ts-card-pad">
                    <div class="ts-organizer-event-section-head"><?=ts_icon('calendar')?><h2>About this event</h2></div>
                    <p id="overview-description" class="ts-organizer-event-description"></p>
                    <dl class="ts-organizer-event-facts">
                        <div><dt>Date & time</dt><dd id="overview-date"></dd></div>
                        <div><dt>Event category</dt><dd id="overview-category"></dd></div>
                        <div><dt>Venue</dt><dd id="overview-venue"></dd></div>
                        <div><dt>Address</dt><dd id="overview-venue-sub"></dd></div>
                    </dl>
                </section>
                <section class="ts-card ts-card-pad">
                    <div class="ts-organizer-event-section-head"><?=ts_icon('ticket')?><h2>Ticket availability</h2></div>
                    <div class="ts-organizer-event-progress-heading"><span>Confirmed ticket sales</span><strong id="overview-sales-ratio">—</strong></div>
                    <progress id="event-sales-progress" value="0" max="1" aria-label="Allocated tickets sold"></progress>
                    <p class="small secondary" id="overview-sales-progress-note"></p>
                    <dl class="ts-organizer-event-availability">
                        <div><dt>Tickets allocated</dt><dd id="overview-allocated">—</dd></div>
                        <div><dt>Ticket categories</dt><dd id="overview-categories">—</dd></div>
                        <div><dt>Category prices</dt><dd id="overview-prices">—</dd></div>
                    </dl>
                    <p class="ts-organizer-event-note">Remaining tickets are based on confirmed bookings. Temporary buyer reservations are not included in this snapshot.</p>
                </section>
            </div>
        </div>
        <div class="ts-tab-panel" data-panel="tickets">
            <section class="ts-card">
                <div class="ts-card-head"><div><h2 class="ts-card-title">Ticket categories</h2><p class="ts-card-sub">Prices, allocations and remaining quantities based on confirmed bookings.</p></div></div>
                <div class="ts-table-wrap"><table class="ts-table">
                    <thead><tr><th>Category</th><th>Section</th><th>Price</th><th>Quantity</th><th>Remaining (confirmed)</th></tr></thead>
                    <tbody id="tickets-tbody"><tr><td colspan="5" class="text-center secondary">Loading ticket categories…</td></tr></tbody>
                </table></div>
            </section>
        </div>
        <div class="ts-tab-panel" data-panel="rules">
            <section class="ts-card ts-card-pad"><h2 class="ts-card-title">Sales & ticket rules</h2><p class="ts-card-sub">Purchase limits, sales dates, transfers and resale settings.</p><div id="organizer-rules-summary" class="mt-20"></div></section>
        </div>
        <div class="ts-tab-panel" data-panel="history">
            <section class="ts-card ts-card-pad"><h2 class="ts-card-title">Event status history</h2><p class="ts-card-sub">Creation, review and availability updates. Times use Malaysia time (UTC+8).</p><div class="ts-timeline mt-24" id="history-timeline"></div></section>
        </div>
        <div class="ts-tab-panel" data-panel="sales">
            <section class="ts-card ts-card-pad"><h2 class="ts-card-title">Sales overview</h2><p class="ts-card-sub">Confirmed initial bookings for this event.</p>
                <dl class="ts-organizer-event-sales-summary">
                    <div><dt>Confirmed bookings</dt><dd id="event-sales-bookings">—</dd></div>
                    <div><dt>Tickets sold</dt><dd id="event-sales-tickets">—</dd></div>
                    <div><dt>Recorded sales</dt><dd id="event-sales-total">—</dd></div>
                </dl>
                <p class="ts-organizer-event-note">Amounts include service charges and represent simulated payments for this FYP.</p>
                <a class="ts-btn ts-btn-primary mt-20" href="sales.php"><?=ts_icon('chart')?> Open sales dashboard</a>
            </section>
        </div>
    </div>
</div>

<script src="<?=ts_asset_url('assets/js/event-policy.js', '..')?>"></script>
<script type="module">
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const money = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const asDate = value => !value ? null : typeof value.toDate === 'function' ? value.toDate() : new Date(value);
const formatDate = (value, withTime = false) => {
    const date = asDate(value);
    if (!date || Number.isNaN(date.valueOf())) return 'Not recorded';
    return date.toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) });
};
let detailLoad = 0;
window.addEventListener('ts-auth-ready', async () => {
    const version = ++detailLoad, user = window.tsCurrentUser;
    if (!user || user.role !== 'organizer' || user.status !== 'active') return;
    const current = () => version === detailLoad && window.tsCurrentUser?.uid === user.uid && window.tsCurrentUser?.role === 'organizer' && window.tsCurrentUser.status === 'active';
    const showError = message => {
        document.getElementById('event-detail-error').textContent = message;
        document.getElementById('event-detail-error').hidden = false;
        document.getElementById('event-detail-tabs').hidden = true;
        document.getElementById('preview-link').hidden = document.getElementById('edit-event-btn').hidden = true;
    };
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if (!eventId) { document.querySelector('.ts-page-title').textContent = 'Event not found'; showError('Choose an event from My Events to view its details.'); return; }

    try {
        const event = await window.tsEvents.getEvent(eventId);
        if (!current()) return;
        if (!event) { document.querySelector('.ts-page-title').textContent = 'Event not found'; showError('This event is unavailable. Return to My Events and choose another event.'); return; }

        document.querySelector('.ts-page-title').textContent = event.name || 'Untitled event';
        document.querySelector('.ts-page-subtitle').textContent = `${event.date ? formatDate(event.date) : 'Date not configured'}${event.time ? ' · ' + event.time : ''} · ${event.venueName || 'Venue not assigned'}`;
        document.getElementById('event-last-updated').textContent = `Last updated ${formatDate(event.updatedAt)} · Malaysia time (UTC+8)`;
        document.getElementById('preview-link').href = `../public/event-detail.php?id=${encodeURIComponent(eventId)}&preview=1`;
        document.getElementById('overview-description').textContent = event.description || 'No event description added yet.';
        document.getElementById('overview-date').textContent = event.date ? `${formatDate(event.date)}${event.time ? ' · ' + event.time : ''}` : 'Not configured';
        document.getElementById('overview-category').textContent = event.eventCategory || 'Not configured';
        document.getElementById('overview-venue-sub').textContent = event.venueLocation || event.venueAddress || 'Address not provided';
        const poster = document.getElementById('event-detail-poster'), fallback = document.getElementById('event-art-fallback');
        poster.hidden = true; fallback.hidden = false;
        poster.removeAttribute('src');
        try {
            if (event.posterUrl) {
                const url = new URL(event.posterUrl, window.location.href);
                if (['http:', 'https:'].includes(url.protocol)) {
                    poster.alt = `Poster for ${event.name || 'this event'}`;
                    poster.onerror = () => { poster.hidden = true; fallback.hidden = false; };
                    poster.src = url.href; poster.hidden = false; fallback.hidden = true;
                }
            }
        } catch { /* Keep the ticket icon when no valid poster is available. */ }

        const normalizedStatus = String(event.status || 'DRAFT').toUpperCase();
        const editButton = document.getElementById('edit-event-btn');
        editButton.hidden = normalizedStatus !== 'DRAFT';
        editButton.onclick = () => { if (current() && normalizedStatus === 'DRAFT') window.location.href = `event-new.php?id=${encodeURIComponent(eventId)}`; };
        const toneMap = {
            PUBLISHED: 'success',
            PENDING_REVIEW: 'warning',
            REJECTED: 'error',
            SUSPENDED: 'warning',
            CANCELLED: 'error',
            DRAFT: 'neutral'
        };
        const tone = toneMap[normalizedStatus] || 'neutral';
        document.getElementById('status-chips').innerHTML = `<span class="ts-chip ts-chip-${tone}">${esc(normalizedStatus.replace(/_/g, ' '))}</span>`;

        document.getElementById('overview-venue').textContent = event.venueName || 'Unassigned';
        
        const cats = Array.isArray(event.categories)
            ? event.categories.map(c => ({ ...c, sectionId: c.sectionId || c.section || c.id || '' }))
            : Object.entries(event.categories || {}).map(([sectionId, c]) => ({ ...c, sectionId }));
        const totalAllocated = cats.reduce((total, category) => total + (Number(category.quantity) || 0), 0);

        const confirmedBookings = await window.tsBookings.getBookings({ eventId, status: 'CONFIRMED' });
        if (!current()) return;
        const soldBySection = new Map();
        let soldTotal = 0;
        let revenueTotal = 0;
        confirmedBookings.forEach(booking => {
            const quantity = Number(booking.quantity) || booking.seats?.length || 0;
            soldTotal += quantity;
            revenueTotal += Number(booking.totalAmount) || 0;
            const section = String(booking.sectionId || '').trim();
            if (section) soldBySection.set(section, (soldBySection.get(section) || 0) + quantity);
        });
        document.getElementById('overview-sold').textContent = soldTotal.toLocaleString();
        document.getElementById('overview-sold-sub').textContent = `of ${totalAllocated.toLocaleString()} allocated`;
        document.getElementById('overview-rev').textContent = money.format(revenueTotal);
        document.getElementById('overview-remaining').textContent = Math.max(0, totalAllocated - soldTotal).toLocaleString();
        document.getElementById('overview-allocated').textContent = totalAllocated.toLocaleString();
        document.getElementById('overview-categories').textContent = cats.length.toLocaleString();
        const prices = cats.filter(category => category.price !== '' && category.price != null).map(category => Number(category.price)).filter(price => Number.isFinite(price) && price >= 0);
        document.getElementById('overview-prices').textContent = prices.length ? (Math.min(...prices) === Math.max(...prices) ? money.format(prices[0]) : `${money.format(Math.min(...prices))} – ${money.format(Math.max(...prices))}`) : 'Not configured';
        document.getElementById('overview-sales-ratio').textContent = `${soldTotal.toLocaleString()} / ${totalAllocated.toLocaleString()}`;
        const progress = document.getElementById('event-sales-progress');
        progress.max = totalAllocated || 1; progress.value = Math.min(soldTotal, totalAllocated);
        document.getElementById('overview-sales-progress-note').textContent = totalAllocated ? `${(soldTotal / totalAllocated * 100).toFixed(1)}% of allocated tickets sold` : 'Configure ticket quantities to see availability.';
        document.getElementById('event-sales-bookings').textContent = confirmedBookings.length.toLocaleString();
        document.getElementById('event-sales-tickets').textContent = soldTotal.toLocaleString();
        document.getElementById('event-sales-total').textContent = money.format(revenueTotal);

        const tbody = document.getElementById('tickets-tbody');
        if(tbody) {
            tbody.innerHTML = cats.map(c => `
                <tr>
                    <td>${esc(c.name)}</td>
                    <td>${Array.isArray(c.seatLabels) ? `${c.seatLabels.length} selected seats` : esc(c.sectionId)}</td>
                    <td>${c.price !== '' && c.price != null && Number.isFinite(Number(c.price)) ? esc(money.format(Number(c.price))) : 'Not configured'}</td>
                    <td>${Number(c.quantity) || 0}</td>
                    <td>${Math.max(0, (Number(c.quantity) || 0) - (soldBySection.get(c.sectionId) || 0))}</td>
                </tr>
            `).join('') || '<tr><td colspan="5" class="text-center">No categories configured.</td></tr>';
        }

        // Populate Rules
        window.tsEventPolicy.render(document.getElementById('organizer-rules-summary'), event.configurationDraft?.rules
            ? { ...event, ...event.configurationDraft.rules } : event);

        // Populate History
        const historyTbody = document.getElementById('history-timeline');
        if (historyTbody && event.statusHistory && event.statusHistory.length > 0) {
            historyTbody.innerHTML = event.statusHistory.map((h, i) => `
                <div class="ts-timeline-item ${i === event.statusHistory.length - 1 ? 'current' : ''}">
                    <div class="ts-timeline-title">Status changed to ${esc(h.to)}</div>
                    <div class="ts-timeline-meta">${esc(formatDate(h.timestamp, true))} by ${esc(h.changedBy || 'System')}</div>
                </div>
            `).join('');
        } else if (historyTbody) {
            historyTbody.innerHTML = `
                <div class="ts-timeline-item current">
                    <div class="ts-timeline-title">Event Created</div>
                    <div class="ts-timeline-meta">${esc(formatDate(event.createdAt, true))}</div>
                </div>
            `;
        }

        document.getElementById('event-detail-error').hidden = true;
        document.getElementById('event-detail-tabs').hidden = false;
        document.getElementById('preview-link').hidden = false;
    } catch(err) {
        if (!current()) return;
        console.error('Error loading event detail:', err);
        showError('Could not load the complete event details. Refresh to try again, or return to My Events.');
    }
});
</script>

<?php
$content = ob_get_clean();
// We dynamically modify the title in JS, but need a string for the layout call
render_dashboard_page('organizer', 'Event Detail', 'events', $content, '..', '');
?>
