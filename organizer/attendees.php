<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>
<?php
// Check-in button hidden; retained for later use.
// $checkInButton = '<a class="ts-btn ts-btn-primary" href="../verification/face-machine.php">Check in attendees</a>';
?>
<?=ts_page_head('Attendee Management', 'Search and review your records.', '')?>
<div id="staff-list-page" data-kind="attendees"></div>
<p id="list-summary" role="status"></p>
<section class="ts-card"><div class="ts-filter-bar"><input id="list-search" class="ts-input" aria-label="Buyer, booking, ticket or wallet" placeholder="Buyer, booking, ticket or wallet"><select id="list-category" class="ts-select" aria-label="All categories"><option value="">All categories</option></select><select id="list-status" class="ts-select" aria-label="All entry status"><option value="">All entry status</option><option value="USED">Verified</option><option value="UNVERIFIED">Unverified</option></select></div>
<div class="ts-table-wrap"><table class="ts-table"><thead><tr><th>Current owner</th><th>Booking</th><th>Ticket</th><th>Category</th><th>Seat</th><th>Wallet</th><th>Entry status</th></tr></thead><tbody id="staff-list-body"><tr><td colspan="7">Loading...</td></tr></tbody></table></div></section>
<script src="<?=ts_asset_url('assets/js/ticket-display.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/staff-page-tools.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/staff-lists.js', '..')?>"></script>
<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Attendee Management', 'attendees', $content, '..', '');
?>
