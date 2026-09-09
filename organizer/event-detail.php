<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Loading...', ' ', '<a class="ts-btn ts-btn-secondary" href="../public/event-detail.php" id="preview-link">'.ts_icon('eye').' Preview Public Page</a> <button class="ts-btn ts-btn-primary" data-toast="Edit event UI opened">Edit Event</button>')?>
<div class="flex gap-8 wrap mb-24" id="status-chips">
    <?=ts_status('Loading', 'neutral')?>
</div>
<div data-tabs>
    <div class="ts-tabs"><button class="ts-tab active" data-tab="overview">Overview</button><button class="ts-tab"
            data-tab="tickets">Ticket Configuration</button><button class="ts-tab" data-tab="rules">Sales
            Rules</button><button class="ts-tab" data-tab="history">Status History</button><button class="ts-tab"
            data-tab="sales">Sales</button></div>
    <div class="ts-tab-panel active" data-panel="overview">
        <div class="ts-grid-3">
            <div class="ts-card ts-card-pad">
                <div class="ts-detail-label">Venue</div>
                <div class="ts-card-title mt-8" id="overview-venue">Loading...</div>
                <p class="small muted" id="overview-venue-sub">Location</p>
            </div>
            <div class="ts-card ts-card-pad">
                <div class="ts-detail-label">Tickets Sold</div>
                <div class="ts-kpi-value" id="overview-sold">0</div>
                <p class="small muted" id="overview-sold-sub">of 0 allocated</p>
            </div>
            <div class="ts-card ts-card-pad">
                <div class="ts-detail-label">Revenue</div>
                <div class="ts-kpi-value" id="overview-rev">RM0</div>
                <p class="small muted">Initial sales</p>
            </div>
        </div>
    </div>
    <div class="ts-tab-panel" data-panel="tickets">
        <div class="ts-card">
            <div class="ts-table-wrap">
                <table class="ts-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Section</th>
                            <th>Price</th>
                            <th>Quantity</th>
                            <th>Available</th>
                        </tr>
                    </thead>
                    <tbody id="tickets-tbody">
                        <tr><td colspan="5" class="text-center">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <div class="ts-tab-panel" data-panel="rules">
        <div class="ts-card ts-card-pad">
            <div class="ts-detail-grid">
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Sales Start</div>
                    <div class="ts-detail-value" id="rule-sales-start">-</div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Sales Close</div>
                    <div class="ts-detail-value" id="rule-sales-close">-</div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Max / Buyer</div>
                    <div class="ts-detail-value" id="rule-max-buyer">-</div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Resale Maximum</div>
                    <div class="ts-detail-value" id="rule-resale-max">-</div>
                </div>
            </div>
        </div>
    </div>
    <div class="ts-tab-panel" data-panel="history">
        <div class="ts-card ts-card-pad">
            <div class="ts-timeline" id="history-timeline">
                <div class="ts-timeline-item current">
                    <div class="ts-timeline-title">Event Created</div>
                    <div class="ts-timeline-meta">Pending data...</div>
                </div>
            </div>
        </div>
    </div>
    <div class="ts-tab-panel" data-panel="sales"><a class="ts-btn ts-btn-primary" href="sales.php">Open Sales Dashboard</a></div>
</div>

<script type="module">
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
window.addEventListener('ts-auth-ready', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if(!eventId) return;

    try {
        const event = await window.tsEvents.getEvent(eventId);
        if(!event) return;

        document.querySelector('.ts-page-title').textContent = event.name;
        document.querySelector('.ts-page-subtitle').textContent = `${event.date ? new Date(event.date).toLocaleDateString() : 'No date'} · ${event.venueName || 'No venue'} · Last updated ${event.updatedAt ? new Date(event.updatedAt).toLocaleDateString() : ''}`;
        document.getElementById('preview-link').href = `../public/event-detail.php?id=${eventId}`;

        const toneMap = { 'PUBLISHED': 'success', 'APPROVED': 'info', 'REJECTED': 'error', 'DRAFT': 'neutral', 'PENDING': 'warning' };
        const tone = toneMap[event.status?.toUpperCase()] || 'neutral';
        document.getElementById('status-chips').innerHTML = `<span class="ts-chip ts-chip-${tone}">${esc(event.status)}</span>`;

        document.getElementById('overview-venue').textContent = event.venueName || 'Unassigned';
        
        let totalAllocated = 0;
        const cats = event.categories || [];
        cats.forEach(c => totalAllocated += (c.quantity || 0));

        // Mock totals for now, since we aren't loading actual bookings in detail view right now
        document.getElementById('overview-sold').textContent = '0';
        document.getElementById('overview-sold-sub').textContent = `of ${totalAllocated} allocated`;

        const tbody = document.getElementById('tickets-tbody');
        if(tbody) {
            tbody.innerHTML = cats.map(c => `
                <tr>
                    <td>${esc(c.name)}</td>
                    <td>${esc(c.section)}</td>
                    <td>RM${c.price}</td>
                    <td>${c.quantity}</td>
                    <td>${c.quantity}</td>
                </tr>
            `).join('') || '<tr><td colspan="5" class="text-center">No categories configured.</td></tr>';
        }

        // Populate Rules
        document.getElementById('rule-sales-start').textContent = event.salesStartDate ? new Date(event.salesStartDate).toLocaleString() : 'Not configured';
        document.getElementById('rule-sales-close').textContent = event.salesEndDate ? new Date(event.salesEndDate).toLocaleString() : 'Not configured';
        document.getElementById('rule-max-buyer').textContent = event.maxTicketsPerBuyer ? event.maxTicketsPerBuyer : 'Not configured';
        document.getElementById('rule-resale-max').textContent = event.maxResaleMarkup !== undefined ? event.maxResaleMarkup + '%' : 'Not configured';

        // Populate History
        const historyTbody = document.getElementById('history-timeline');
        if (historyTbody && event.statusHistory && event.statusHistory.length > 0) {
            historyTbody.innerHTML = event.statusHistory.map((h, i) => `
                <div class="ts-timeline-item ${i === event.statusHistory.length - 1 ? 'current' : ''}">
                    <div class="ts-timeline-title">Status changed to ${esc(h.to)}</div>
                    <div class="ts-timeline-meta">${new Date(h.timestamp).toLocaleString()} by ${esc(h.changedBy || 'System')}</div>
                </div>
            `).join('');
        } else if (historyTbody) {
            historyTbody.innerHTML = `
                <div class="ts-timeline-item current">
                    <div class="ts-timeline-title">Event Created</div>
                    <div class="ts-timeline-meta">${event.createdAt ? new Date(event.createdAt).toLocaleString() : 'Unknown date'}</div>
                </div>
            `;
        }

    } catch(err) {
        console.error('Error loading event detail:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
// We dynamically modify the title in JS, but need a string for the layout call
render_dashboard_page('organizer', 'Event Detail', 'events', $content, '..', '');
?>