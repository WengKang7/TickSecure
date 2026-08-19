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
    <?=ts_kpi('Available', '356', 'ticket')?><?=ts_kpi('Reserved', '18', 'clock')?><?=ts_kpi('Sold', '1,244', 'check')?><?=ts_kpi('Total Revenue', 'RM714K', 'chart')?>
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
            <div class="ts-donut-center">RM714K</div>
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
        <div class="ts-summary-row"><span>Successful bookings</span><strong>1,211</strong></div>
        <div class="ts-summary-row"><span>Failed bookings</span><strong>72</strong></div>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Attendee verification</div>
        <div class="ts-summary-row"><span>Verified</span><strong>842</strong></div>
        <div class="ts-summary-row"><span>Unverified</span><strong>402</strong></div>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Sales & Revenue', 'sales', $content, '..', '');
?>