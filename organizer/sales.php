<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Sales & Revenue', 'Monitor availability, bookings, revenue and attendee verification for your events.', '<button class="ts-btn ts-btn-secondary">'.ts_icon('download').' Export</button> <button class="ts-btn ts-btn-primary">Generate Report</button>')?>
<div class="ts-filter-bar ts-card mb-24"><select class="ts-select">
        <option>Aurora After Dark</option>
        <option>Velvet Hour Live</option>
    </select><input class="ts-input" type="date" value="2026-08-01"><input class="ts-input" type="date"
        value="2026-08-18"></div>
<div class="ts-kpi-grid">
    <?=ts_kpi('Available', '<span id="kpi-available">-</span>', 'ticket')?>
    <?=ts_kpi('Reserved', '<span id="kpi-reserved">-</span>', 'clock')?>
    <?=ts_kpi('Sold', '<span id="kpi-sold">-</span>', 'check')?>
    <?=ts_kpi('Total Revenue', '<span id="kpi-revenue">RM0</span>', 'chart')?>
</div>
<div class="ts-grid-2 mt-24">
    <div class="ts-card">
        <div class="ts-card-head">
            <div>
                <div class="ts-card-title">Sales over time</div>
                <div class="ts-card-sub">Confirmed ticket sales</div>
            </div>
        </div>
        <div class="ts-bars">
            <?php foreach ([45,68,92,56,120,145,132,175,160,188,170,195] as $h): ?><span
                class="ts-bar"
                style="height:<?=$h?>px"></span><?php endforeach;?>
        </div>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Revenue by category</div>
        <div class="ts-donut">
            <div class="ts-donut-center" id="donut-revenue">RM0</div>
        </div>
        <div class="ts-legend">
            <div class="ts-legend-row"><span><i class="ts-legend-dot"></i>VIP1</span><strong>58%</strong></div>
            <div class="ts-legend-row"><span><i class="ts-legend-dot gold"></i>CAT1</span><strong>20%</strong></div>
            <div class="ts-legend-row"><span><i class="ts-legend-dot gray"></i>CAT2</span><strong>22%</strong></div>
        </div>
    </div>
</div>
<div class="ts-grid-2 mt-24">
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Booking performance</div>
        <div class="ts-summary-row"><span>Successful bookings</span><strong id="perf-success">0</strong></div>
        <div class="ts-summary-row"><span>Failed bookings</span><strong id="perf-failed">0</strong></div>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Attendee verification</div>
        <div class="ts-summary-row"><span>Verified</span><strong>0</strong></div>
        <div class="ts-summary-row"><span>Unverified</span><strong>0</strong></div>
    </div>
</div>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    try {
        const events = await window.tsEvents.getOrganizerEvents();
        const eventIds = new Set(events.map(e => e.id));
        const allBookings = await window.tsBookings.getBookings();
        const bookings = allBookings.filter(b => eventIds.has(b.eventId));
        
        let sold = 0;
        let revenue = 0;
        let successful = 0;
        let failed = 0;

        bookings.forEach(b => {
            if(b.status === 'CONFIRMED' || b.status === 'COMPLETED') {
                sold += (b.tickets?.length || 0);
                revenue += (b.totalAmount || 0);
                successful++;
            } else if(b.status === 'FAILED' || b.status === 'CANCELLED') {
                failed++;
            }
        });

        document.getElementById('kpi-sold').textContent = sold.toLocaleString();
        document.getElementById('kpi-revenue').textContent = 'RM ' + revenue.toLocaleString();
        document.getElementById('donut-revenue').textContent = 'RM ' + revenue.toLocaleString();
        document.getElementById('perf-success').textContent = successful.toLocaleString();
        document.getElementById('perf-failed').textContent = failed.toLocaleString();
    } catch(e) {
        console.error('Error loading sales data:', e);
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Sales & Revenue', 'sales', $content, '..', '');
?>