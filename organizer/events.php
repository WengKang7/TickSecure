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
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
window.addEventListener('ts-auth-ready', async () => {
    try {
        let events = await window.tsEvents.getOrganizerEvents();
        const tbody = document.getElementById('events-table-body');
        if (!tbody) return;

        // Populate Venue Filter dynamically
        const venueSelect = document.getElementById('venue-filter');
        const uniqueVenues = [...new Set(events.map(e => e.venueName).filter(Boolean))];
        venueSelect.innerHTML = '<option value="">All venues</option>' + uniqueVenues.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
        
        function renderTable() {
            const search = document.getElementById('search-input').value.toLowerCase();
            const statusF = document.getElementById('status-filter').value;
            const venueF = document.getElementById('venue-filter').value;
            
            const filtered = events.filter(e => {
                if (search && !(e.name || '').toLowerCase().includes(search)) return false;
                if (statusF && e.status !== statusF) return false;
                if (venueF && e.venueName !== venueF) return false;
                return true;
            });
            
            document.getElementById('event-count-text').textContent = `${filtered.length} events`;
            
            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center secondary" style="padding:40px">No events found matching filters.</td></tr>';
                return;
            }
            
            tbody.innerHTML = filtered.map(e => {
                const toneMap = { 'PUBLISHED': 'success', 'APPROVED': 'info', 'REJECTED': 'error', 'DRAFT': 'neutral', 'PENDING_REVIEW': 'warning', 'CANCELLED': 'error', 'SUSPENDED': 'error' };
                const statusStr = (e.status || 'DRAFT').toUpperCase();
                const tone = toneMap[statusStr] || 'neutral';
                const statusHtml = `<span class="ts-chip ts-chip-${tone}">${esc(e.status)}</span>`;
                
                const eventDate = e.date ? new Date(e.date).toLocaleDateString() : 'N/A';
                const updated = e.updatedAt ? new Date(e.updatedAt).toLocaleDateString() : 'N/A';
                const salesPeriod = e.salesStartDate ? `${new Date(e.salesStartDate).toLocaleDateString()} - ${new Date(e.salesEndDate).toLocaleDateString()}` : 'Not configured';
                
                let totalAllocated = 0;
                if(e.categories) e.categories.forEach(c => totalAllocated += (c.quantity || 0));

                return `
                    <tr>
                        <td class="cell-title">${esc(e.name)}</td>
                        <td>${esc(e.venueName || 'Unassigned')}</td>
                        <td>${eventDate}</td>
                        <td class="small">${esc(salesPeriod)}</td>
                        <td>${statusHtml}</td>
                        <td>0 / ${totalAllocated}</td>
                        <td>${updated}</td>
                        <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="event-detail.php?id=${e.id}">Open</a></td>
                    </tr>
                `;
            }).join('');
        }

        document.getElementById('search-input').addEventListener('input', renderTable);
        document.getElementById('status-filter').addEventListener('change', renderTable);
        document.getElementById('venue-filter').addEventListener('change', renderTable);

        renderTable();

    } catch (err) {
        console.error('Events load error:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'My Events', 'events', $content, '..', '');
?>