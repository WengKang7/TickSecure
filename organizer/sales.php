<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>
<?=ts_page_head('Sales & Revenue', 'Recorded simulated payments for your events. No real ticket payment settlement.', '<button type="button" id="sales-export" class="ts-btn ts-btn-secondary" disabled>Export CSV</button> <button type="button" id="sales-generate" class="ts-btn ts-btn-primary">Generate Report</button>')?>
<div class="ts-card ts-card-pad mb-24"><div class="ts-filter-bar"><select id="sales-event" class="ts-select" aria-label="Event"><option value="">All events</option></select><label>From <input id="sales-from" class="ts-input" type="date"></label><label>To <input id="sales-to" class="ts-input" type="date"></label><button id="sales-reset" type="button" class="ts-btn ts-btn-secondary">Reset</button></div><p id="sales-message" role="status">Loading report...</p></div>
<div class="ts-kpi-grid">
<?=ts_kpi('Available (published events)', '<span id="kpi-available">-</span>', 'ticket')?>
<?=ts_kpi('Active reservations (published events)', '<span id="kpi-reserved">-</span>', 'clock')?>
<?=ts_kpi('Tickets sold in period', '<span id="kpi-sold">-</span>', 'check')?>
<?=ts_kpi('Checkout total (simulated)', '<span id="kpi-revenue">-</span>', 'chart')?>
</div>
<p class="small secondary mt-12">Availability is the latest snapshot for published events, independent of the sales date range. Dates use Malaysia time (UTC+8). Checkout totals include service charges.</p>
<div class="ts-grid-2 mt-24">
<section class="ts-card ts-card-pad"><h2>Sales over time</h2><div id="sales-chart" class="ts-bars" aria-label="Daily checkout totals"></div><div class="ts-table-wrap"><table class="ts-table"><thead><tr><th>Day</th><th>Bookings</th><th>Checkout total</th></tr></thead><tbody id="sales-days"></tbody></table></div></section>
<section class="ts-card ts-card-pad"><h2>Ticket revenue by category</h2><p class="small secondary">Ticket value excludes service charges.</p><div id="sales-categories"></div></section>
</div>
<div class="ts-grid-2 mt-24"><section class="ts-card ts-card-pad"><h2>Booking performance</h2><div class="ts-summary-row"><span>Confirmed bookings</span><strong id="perf-success">-</strong></div><div class="ts-summary-row"><span>Failed / cancelled bookings</span><strong id="perf-failed">-</strong></div></section><section class="ts-card ts-card-pad"><h2>Attendee verification</h2><p class="small secondary">Tickets issued during the selected period; current entry status.</p><div class="ts-summary-row"><span>Verified</span><strong id="perf-verified">-</strong></div><div class="ts-summary-row"><span>Unverified</span><strong id="perf-unverified">-</strong></div></section></div>
<section class="ts-card mt-24"><div class="ts-card-head"><h2>Recorded bookings</h2></div><div class="ts-table-wrap"><table class="ts-table"><thead><tr><th>Booking</th><th>Event</th><th>Recorded (Malaysia time)</th><th>Tickets</th><th>Total (simulated)</th><th>Status</th></tr></thead><tbody id="sales-records"></tbody></table></div></section>
<script src="<?=ts_asset_url('assets/js/staff-page-tools.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/organizer-sales.js', '..')?>"></script>
<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Sales & Revenue', 'sales', $content, '..', '');
?>
