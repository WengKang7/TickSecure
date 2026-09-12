<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('My Events', 'Create, submit and manage your organization’s concert events.', '<a class="ts-btn ts-btn-primary" href="event-new.php">'.ts_icon('plus').' Create Event</a>')?>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input id="search-input"
                class="ts-input" placeholder="Search event"></div><select class="ts-select" id="status-filter">
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_REVIEW">Pending Approval</option>
            <option value="PUBLISHED">Published</option>
            <option value="REJECTED">Rejected</option>
        </select><select class="ts-select" id="venue-filter">
            <option value="">All venues</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Event</th>
                    <th>Venue</th>
                    <th>Event Date</th>
                    <th>Sales Period</th>
                    <th>Status</th>
                    <th>Tickets Sold</th>
                    <th>Updated</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="events-table-body">
                <tr><td colspan="8" class="text-center">Loading events...</td></tr>
            </tbody>
        </table>
    </div>
    <div class="ts-pagination"><span id="event-count-text">0 events</span>
        <div class="ts-page-numbers"><span class="ts-page-num active">1</span></div>
    </div>
</div>

<script type="module">
const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const asDate = value => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = value => {
    if (!value) return 'Not configured';
    // Date-only values are intentional event dates, not UTC instants.
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Intl.DateTimeFormat(undefined, { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
    }
    const date = asDate(value);
    return date ? date.toLocaleDateString() : String(value);
};

const formatSalesPeriod = event => {
    if (!event.salesStartDate && !event.salesEndDate) return 'Not configured';
    return `${formatDate(event.salesStartDate)} – ${formatDate(event.salesEndDate)}`;
};

window.addEventListener('ts-auth-ready', async () => {
    try {
        let events = [];
        let bookingStats = new Map();
        const tbody = document.getElementById('events-table-body');
        if (!tbody) return;

        const loadData = async () => {
            const [loadedEvents, bookings] = await Promise.all([
                window.tsEvents.getOrganizerEvents(),
                window.tsBookings.getBookings()
            ]);
            events = loadedEvents;
            bookingStats = new Map();
            bookings.forEach(booking => {
                if (String(booking.status || '').toUpperCase() !== 'CONFIRMED') return;
                const current = bookingStats.get(booking.eventId) || { sold: 0 };
                current.sold += Number(booking.quantity) || booking.seats?.length || 0;
                bookingStats.set(booking.eventId, current);
            });

            // Populate the filter from canonical event venue snapshots.
            const venueSelect = document.getElementById('venue-filter');
            const selectedVenue = venueSelect.value;
            const uniqueVenues = [...new Set(events.map(e => e.venueName).filter(Boolean))];
            venueSelect.innerHTML = '<option value="">All venues</option>'
                + uniqueVenues.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
            if (uniqueVenues.includes(selectedVenue)) venueSelect.value = selectedVenue;
        };
        
        function renderTable() {
            const search = document.getElementById('search-input').value.toLowerCase();
            const statusF = document.getElementById('status-filter').value;
            const venueF = document.getElementById('venue-filter').value;
            
            const filtered = events.filter(e => {
                if (search && !(e.name || '').toLowerCase().includes(search)) return false;
                if (statusF && String(e.status || '').toUpperCase() !== statusF) return false;
                if (venueF && e.venueName !== venueF) return false;
                return true;
            });
            
            document.getElementById('event-count-text').textContent = `${filtered.length} events`;
            
            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center secondary" style="padding:40px">No events found matching filters.</td></tr>';
                return;
            }
            
            tbody.innerHTML = filtered.map(e => {
                const toneMap = { 'PUBLISHED': 'success', 'REJECTED': 'error', 'DRAFT': 'neutral', 'PENDING_REVIEW': 'warning', 'CANCELLED': 'error', 'SUSPENDED': 'error' };
                const statusStr = (e.status || 'DRAFT').toUpperCase();
                const tone = toneMap[statusStr] || 'neutral';
                const statusHtml = `<span class="ts-chip ts-chip-${tone}">${esc(statusStr.replaceAll('_', ' '))}</span>`;
                
                const eventDate = e.date ? [formatDate(e.date), e.time].filter(Boolean).join(' · ') : 'Not configured';
                const updated = e.updatedAt ? formatDate(e.updatedAt) : 'Not available';
                const salesPeriod = formatSalesPeriod(e);
                
                const categories = Array.isArray(e.categories) ? e.categories : Object.values(e.categories || {});
                const totalAllocated = categories
                    .reduce((total, category) => total + (Number(category.quantity) || 0), 0);
                const sold = bookingStats.get(e.id)?.sold || 0;
                const eventId = encodeURIComponent(e.id);
                const actions = statusStr === 'DRAFT'
                    ? `<div class="ts-table-actions"><a class="ts-btn ts-btn-secondary ts-btn-sm" href="configuration.php?id=${eventId}">Configure</a><button class="ts-btn ts-btn-danger ts-btn-sm" type="button" data-delete-event="${eventId}">Delete</button></div>`
                    : `<a class="ts-btn ts-btn-secondary ts-btn-sm" href="event-detail.php?id=${eventId}">Open</a>`;

                return `
                    <tr>
                        <td class="cell-title">${esc(e.name)}</td>
                        <td>${esc(e.venueName || 'Unassigned')}</td>
                        <td>${eventDate}</td>
                        <td class="small">${esc(salesPeriod)}</td>
                        <td>${statusHtml}</td>
                        <td>${sold.toLocaleString()} / ${totalAllocated.toLocaleString()}</td>
                        <td>${updated}</td>
                        <td>${actions}</td>
                    </tr>
                `;
            }).join('');

            tbody.querySelectorAll('[data-delete-event]').forEach(button => {
                button.addEventListener('click', async () => {
                    const eventId = decodeURIComponent(button.dataset.deleteEvent || '');
                    const event = events.find(item => item.id === eventId);
                    if (!event || String(event.status || '').toUpperCase() !== 'DRAFT') return;
                    if (!window.confirm(`Delete the draft event “${event.name || 'Untitled event'}”? This cannot be undone.`)) return;

                    button.disabled = true;
                    try {
                        await window.tsEvents.deleteEvent(eventId);
                        await loadData();
                        renderTable();
                    } catch (error) {
                        console.error('Unable to delete draft event:', error);
                        window.alert(error?.message || 'The draft event could not be deleted.');
                        button.disabled = false;
                    }
                });
            });
        }

        document.getElementById('search-input').addEventListener('input', renderTable);
        document.getElementById('status-filter').addEventListener('change', renderTable);
        document.getElementById('venue-filter').addEventListener('change', renderTable);

        await loadData();
        renderTable();

    } catch (err) {
        console.error('Events load error:', err);
        const tbody = document.getElementById('events-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center secondary" style="padding:40px">${esc(err?.message || 'Unable to load events.')}</td></tr>`;
        }
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'My Events', 'events', $content, '..', '');
?>
