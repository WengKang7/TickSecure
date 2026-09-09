<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Event Oversight', 'Review event submissions, monitor approved events and manage suspension/cancellation when required.', '')?>
<div class="ts-tabs mb-24"><button class="ts-tab active">Pending Review</button><button class="ts-tab">All
        Events</button><button class="ts-tab">Suspended</button><button class="ts-tab">Cancelled</button><button
        class="ts-tab">Review History</button></div>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Event, organizer or venue"></div><select class="ts-select">
            <option>Pending first</option>
            <option>Newest submission</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Event</th>
                    <th>Organizer</th>
                    <th>Venue</th>
                    <th>Event Date</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="events-table-body">
                <tr><td colspan="7" class="text-center secondary" style="padding:40px">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    try {
        const events = await window.tsEvents.getEvents();
        const tbody = document.getElementById('events-table-body');
        if (!tbody) return;
        
        if (events.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center secondary" style="padding:40px">No events found.</td></tr>';
            return;
        }
        
        const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
        
        tbody.innerHTML = events.map(e => {
            let tone = 'neutral';
            if (e.status === 'pending') tone = 'warning';
            else if (e.status === 'published') tone = 'success';
            else if (e.status === 'suspended') tone = 'error';

            return `
                <tr>
                    <td class="cell-title">${esc(e.title)}</td>
                    <td>${esc(e.organizerName || e.organizerId)}</td>
                    <td>${esc(e.venueName || e.venueId)}</td>
                    <td>${e.date ? new Date(e.date).toLocaleDateString() : 'N/A'}</td>
                    <td>${e.createdAt ? new Date(e.createdAt).toLocaleDateString() : 'N/A'}</td>
                    <td><span class="ts-chip ts-chip-${tone}">${esc(e.status)}</span></td>
                    <td><a class="ts-btn ts-btn-primary ts-btn-sm" href="event-review.php?id=${e.id}">Review</a></td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Load error:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Event Oversight', 'events', $content, '..', '');
?>