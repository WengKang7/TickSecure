<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Good afternoon, Nova Stage', 'Here is the current performance and action queue across your TickSecure events.', '<a class="ts-btn ts-btn-primary" href="event-new.php">'.ts_icon('plus').' Create Event</a>')?>
<div class="ts-kpi-grid">
    <?=ts_kpi('Active Events', '<span id="active-events-kpi">...</span>', 'calendar', '')?>
    <?=ts_kpi('Tickets Sold', '<span id="tickets-sold-kpi">...</span>', 'ticket', '')?>
    <?=ts_kpi('Revenue', '<span id="revenue-kpi">...</span>', 'chart', '')?>
    <?=ts_kpi('Pending NFT Tx', '<span id="pending-nft-kpi">...</span>', 'activity', '')?>
</div>
<div class="ts-grid-2 mt-24">
    <div class="ts-card">
        <div class="ts-card-head">
            <div>
                <div class="ts-card-title">Ticket sales trend</div>
                <div class="ts-card-sub">Last 8 reporting periods</div>
            </div><select class="ts-select" style="width:150px;height:38px">
                <option>All events</option>
            </select>
        </div>
        <div class="ts-line-chart"><svg viewBox="0 0 600 180" preserveAspectRatio="none">
                <path d="M0 140 C70 120,100 128,150 95 S240 80,280 88 S360 45,410 60 S510 35,600 25" fill="none"
                    stroke="#344054" stroke-width="4" />
                <path d="M0 150 H600 M0 105 H600 M0 60 H600" stroke="#EEF0F2" stroke-width="1" />
            </svg></div>
    </div>
    <div class="ts-card">
        <div class="ts-card-head">
            <div>
                <div class="ts-card-title">Action required</div>
                <div class="ts-card-sub">Items that need organizer attention</div>
            </div>
        </div>
        <div class="ts-card-pad">
            <div class="ts-list">
                <div class="ts-list-item">
                    <div>
                        <div class="ts-list-title">Event correction requested</div>
                        <div class="ts-list-sub">Nocturne City · venue details</div>
                    </div>
                    <?=ts_status('Action', 'warning')?>
                </div>
            </div>
        </div>
    </div>
</div>
<div class="ts-card mt-24">
    <div class="ts-card-head">
        <div>
            <div class="ts-card-title">Upcoming events</div>
            <div class="ts-card-sub">Status and sales snapshot</div>
        </div><a href="events.php" class="small">View all</a>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Venue</th>
                    <th>Status</th>
                    <th>Sold</th>
                    <th>Revenue</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="events-table-body">
                <tr><td colspan="7" class="text-center">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script type="module">
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
window.addEventListener('ts-auth-ready', async () => {
    try {
        const events = await window.tsEvents.getOrganizerEvents();
        const activeEvents = events.filter(e => String(e.status || '').toUpperCase() === 'PUBLISHED').length;
        document.getElementById('active-events-kpi').textContent = activeEvents;

        const orgBookings = await window.tsBookings.getBookings();
        const bookingStats = new Map();
        orgBookings.forEach(booking => {
            if (booking.status !== 'CONFIRMED') return;
            const current = bookingStats.get(booking.eventId) || { sold: 0, revenue: 0 };
            current.sold += Number(booking.quantity) || booking.seats?.length || 0;
            current.revenue += Number(booking.totalAmount) || 0;
            bookingStats.set(booking.eventId, current);
        });

        const ticketsSold = [...bookingStats.values()].reduce((sum, stats) => sum + stats.sold, 0);
        document.getElementById('tickets-sold-kpi').textContent = ticketsSold.toLocaleString();

        const revenue = [...bookingStats.values()].reduce((sum, stats) => sum + stats.revenue, 0);
        document.getElementById('revenue-kpi').textContent = 'RM ' + revenue.toLocaleString(undefined, {minimumFractionDigits: 2});

        const organizerTickets = await window.tsTickets.getTickets();
        const pendingMints = organizerTickets.filter(ticket =>
            String(ticket.mintingStatus || '').toUpperCase() === 'PENDING'
        ).length;
        document.getElementById('pending-nft-kpi').textContent = pendingMints.toLocaleString();

        const tbody = document.getElementById('events-table-body');
        if(!tbody) return;
        if(events.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center secondary">No events found.</td></tr>';
            return;
        }

        tbody.innerHTML = events.slice(0,5).map(e => {
            const normalizedStatus = String(e.status || 'DRAFT').toUpperCase();
            const toneMap = {
                PUBLISHED: 'success',
                PENDING_REVIEW: 'warning',
                REJECTED: 'error',
                SUSPENDED: 'warning',
                CANCELLED: 'error',
                DRAFT: 'neutral'
            };
            const tone = toneMap[normalizedStatus] || 'neutral';
            return `
                <tr>
                    <td class="cell-title">${esc(e.name)}</td>
                    <td>${e.date ? new Date(e.date).toLocaleDateString() : 'N/A'}</td>
                    <td>${esc(e.venueName || 'Unassigned')}</td>
                    <td><span class="ts-chip ts-chip-${tone}">${esc(normalizedStatus.replace(/_/g, ' '))}</span></td>
                    <td>${(bookingStats.get(e.id)?.sold || 0).toLocaleString()}</td>
                    <td>RM ${(bookingStats.get(e.id)?.revenue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="event-detail.php?id=${e.id}">Manage</a></td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('Dashboard error:', e);
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer','Dashboard','dashboard',$content,'..','');
?>
