<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<div class="ts-organizer-dashboard">
    <header class="ts-organizer-hero">
        <div>
            <span class="ts-organizer-kicker">EVENT ORGANIZER</span>
            <h1>Dashboard.</h1>
            <p id="organizer-welcome">Your events, ticket sales and next steps in one place.</p>
        </div>
        <div class="ts-organizer-hero-side">
            <div class="ts-organizer-hero-actions">
                <a class="ts-btn ts-btn-secondary" href="events.php"><?=ts_icon('calendar')?> My events</a>
                <a class="ts-btn ts-btn-primary" href="event-new.php"><?=ts_icon('plus')?> Create event</a>
            </div>
            <p id="organizer-dashboard-status" role="status" aria-live="polite">Loading your event data…</p>
        </div>
    </header>

    <div class="ts-kpi-grid ts-organizer-metrics">
        <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>Published events</span><span class="ts-kpi-icon"><?=ts_icon('calendar')?></span></div><div class="ts-kpi-value" id="active-events-kpi">…</div><div class="ts-kpi-label">Your published event listings</div></div>
        <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>Tickets sold</span><span class="ts-kpi-icon"><?=ts_icon('ticket')?></span></div><div class="ts-kpi-value" id="tickets-sold-kpi">…</div><div class="ts-kpi-label">From confirmed bookings</div></div>
        <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>Recorded sales</span><span class="ts-kpi-icon"><?=ts_icon('chart')?></span></div><div class="ts-kpi-value" id="revenue-kpi">…</div><div class="ts-kpi-label">Simulated checkout totals</div></div>
        <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>Pending NFT mints</span><span class="ts-kpi-icon"><?=ts_icon('activity')?></span></div><div class="ts-kpi-value" id="pending-nft-kpi">…</div><div class="ts-kpi-label">Awaiting mint confirmation</div></div>
    </div>

    <div class="ts-organizer-dashboard-grid">
        <section class="ts-card ts-card-pad">
            <div class="ts-organizer-section-head"><div><h2>Event overview</h2><p>See where your events stand.</p></div><span class="ts-chip ts-chip-neutral" id="organizer-event-total">Loading…</span></div>
            <div id="organizer-event-statuses" class="ts-organizer-status-list" aria-live="polite"><p class="secondary">Loading event statuses…</p></div>
            <p class="ts-organizer-overview-note">Events awaiting review need administrator approval before publication.</p>
        </section>
        <section class="ts-card ts-card-pad">
            <div class="ts-organizer-section-head"><div><h2>Your workspace</h2><p>Quick access to your event tools.</p></div><?=ts_icon('layout')?></div>
            <div class="ts-organizer-shortcuts">
                <a href="blockchain.php" class="ts-organizer-shortcut"><span class="ts-organizer-shortcut-icon"><?=ts_icon('activity')?></span><div><strong>Blockchain</strong><span>Contract setup & activity</span></div><?=ts_icon('arrow-right')?></a>
                <a href="nft.php" class="ts-organizer-shortcut"><span class="ts-organizer-shortcut-icon"><?=ts_icon('ticket')?></span><div><strong>NFT tickets</strong><span>View your issued tickets</span></div><?=ts_icon('arrow-right')?></a>
                <a href="attendees.php" class="ts-organizer-shortcut"><span class="ts-organizer-shortcut-icon"><?=ts_icon('users')?></span><div><strong>Attendees</strong><span>Guest lists & entry</span></div><?=ts_icon('arrow-right')?></a>
                <a href="secondary-market.php" class="ts-organizer-shortcut"><span class="ts-organizer-shortcut-icon"><?=ts_icon('chart')?></span><div><strong>Resale monitoring</strong><span>Follow secondary sales</span></div><?=ts_icon('arrow-right')?></a>
            </div>
            <a class="ts-organizer-profile-link" href="profile.php"><?=ts_icon('building')?> Manage organization profile <?=ts_icon('arrow-right')?></a>
        </section>
    </div>

    <section class="ts-card ts-organizer-event-card">
        <div class="ts-card-head">
            <div class="ts-organizer-section-head"><div><h2>Your latest events</h2><p>Status and sales for your five most recently created events.</p></div></div>
            <a href="events.php" class="ts-btn ts-btn-secondary ts-btn-sm">View all events <?=ts_icon('arrow-right')?></a>
        </div>
        <div class="ts-table-wrap">
            <table class="ts-table">
                <thead><tr><th>Event</th><th>Date</th><th>Venue</th><th>Status</th><th>Tickets sold</th><th>Recorded sales</th><th></th></tr></thead>
                <tbody id="events-table-body"><tr><td colspan="7" class="text-center secondary" style="padding:32px">Loading your events…</td></tr></tbody>
            </table>
        </div>
        <p class="ts-organizer-sales-note">Sales amounts include service charges and represent simulated payments for this FYP.</p>
    </section>
</div>

<script type="module">
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const money = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const statusOf = event => String(event.status || 'DRAFT').toUpperCase();
const formatDate = value => {
    if (!value) return 'Not configured';
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(date.valueOf()) ? 'Not configured' : date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' });
};
let dashboardLoad = 0;
window.addEventListener('ts-auth-ready', async () => {
    const version = ++dashboardLoad, user = window.tsCurrentUser;
    if (!user || user.role !== 'organizer' || user.status !== 'active') return;
    const current = () => version === dashboardLoad && window.tsCurrentUser?.uid === user.uid
        && window.tsCurrentUser?.role === 'organizer' && window.tsCurrentUser.status === 'active';
    const name = user.organizationName || user.fullName;
    document.getElementById('organizer-welcome').textContent = name
        ? `Welcome back, ${name}. Here is an overview of your events.`
        : 'Your events, ticket sales and next steps in one place.';
    try {
        const [events, orgBookings, organizerTickets] = await Promise.all([
            window.tsEvents.getOrganizerEvents(), window.tsBookings.getBookings(), window.tsTickets.getTickets()
        ]);
        if (!current()) return;
        document.getElementById('active-events-kpi').textContent = events.filter(event => statusOf(event) === 'PUBLISHED').length.toLocaleString();
        const bookingStats = new Map();
        orgBookings.forEach(booking => {
            if (String(booking.status || '').toUpperCase() !== 'CONFIRMED') return;
            const stats = bookingStats.get(booking.eventId) || { sold: 0, revenue: 0 };
            stats.sold += Number(booking.quantity) || booking.seats?.length || 0;
            stats.revenue += Number(booking.totalAmount) || 0;
            bookingStats.set(booking.eventId, stats);
        });
        document.getElementById('tickets-sold-kpi').textContent = [...bookingStats.values()].reduce((sum, stats) => sum + stats.sold, 0).toLocaleString();
        document.getElementById('revenue-kpi').textContent = money.format([...bookingStats.values()].reduce((sum, stats) => sum + stats.revenue, 0));
        document.getElementById('pending-nft-kpi').textContent = organizerTickets.filter(ticket => String(ticket.mintingStatus || '').toUpperCase() === 'PENDING').length.toLocaleString();
        document.getElementById('organizer-event-total').textContent = `${events.length} total`;
        const groups = [
            { label: 'Published', statuses: ['PUBLISHED'], tone: 'published' },
            { label: 'Drafts', statuses: ['DRAFT'], tone: 'draft' },
            { label: 'Awaiting review', statuses: ['PENDING_REVIEW'], tone: 'pending' },
            { label: 'Rejected', statuses: ['REJECTED'], tone: 'rejected' },
            { label: 'Unavailable', statuses: ['SUSPENDED', 'CANCELLED'], tone: 'draft' }
        ];
        const known = new Set(groups.flatMap(group => group.statuses));
        const otherCount = events.filter(event => !known.has(statusOf(event))).length;
        const overview = groups.map(group => ({ ...group, count: events.filter(event => group.statuses.includes(statusOf(event))).length }));
        if (otherCount) overview.push({ label: 'Other statuses', tone: 'draft', count: otherCount });
        document.getElementById('organizer-event-statuses').innerHTML = events.length ? overview.filter(row => row.label !== 'Unavailable' || row.count).map(row => `
            <div class="ts-organizer-status-row"><div><span>${esc(row.label)}</span><strong>${row.count}</strong></div>
            <div class="ts-organizer-status-track" aria-hidden="true"><span class="${row.tone}" style="width:${Math.round(row.count / events.length * 100)}%"></span></div></div>
        `).join('') : '<div class="ts-organizer-empty"><strong>Your next event starts here.</strong><p>Create your first event to begin managing tickets and sales.</p><a href="event-new.php" class="ts-btn ts-btn-secondary ts-btn-sm">Create an event</a></div>';
        document.getElementById('organizer-dashboard-status').textContent = 'Updated ' + new Date().toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' }) + ' · Malaysia time';
        const tbody = document.getElementById('events-table-body');
        if (!events.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center secondary" style="padding:32px">No events yet. Create your first event to get started.</td></tr>';
            return;
        }
        const tones = { PUBLISHED: 'success', APPROVED: 'success', PENDING_REVIEW: 'warning', REJECTED: 'error', SUSPENDED: 'warning', CANCELLED: 'error', DRAFT: 'neutral' };
        tbody.innerHTML = events.slice(0, 5).map(event => {
            const status = statusOf(event), stats = bookingStats.get(event.id) || { sold: 0, revenue: 0 };
            return `<tr>
                <td class="cell-title">${esc(event.name || 'Untitled event')}</td>
                <td>${esc(formatDate(event.date))}<div class="cell-sub">${esc(event.time || '')}</div></td>
                <td>${esc(event.venueName || 'Unassigned')}</td>
                <td><span class="ts-chip ts-chip-${tones[status] || 'neutral'}">${esc(status.replace(/_/g, ' '))}</span></td>
                <td>${stats.sold.toLocaleString()}</td><td class="ts-organizer-money">${esc(money.format(stats.revenue))}</td>
                <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="event-detail.php?id=${encodeURIComponent(event.id)}">Manage</a></td>
            </tr>`;
        }).join('');
    } catch (error) {
        if (!current()) return;
        console.error('Dashboard error:', error);
        document.getElementById('organizer-dashboard-status').textContent = 'Could not load your event data. Refresh to try again.';
        ['active-events-kpi', 'tickets-sold-kpi', 'revenue-kpi', 'pending-nft-kpi', 'organizer-event-total'].forEach(id => { document.getElementById(id).textContent = '—'; });
        document.getElementById('organizer-event-statuses').innerHTML = '<p class="secondary">Event statuses could not be loaded.</p>';
        document.getElementById('events-table-body').innerHTML = '<tr><td colspan="7" class="text-center secondary" style="padding:32px">Your events could not be loaded. Please refresh.</td></tr>';
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer','Dashboard','dashboard',$content,'..','');
?>
