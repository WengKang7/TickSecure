<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>
<?=ts_page_head('Complaint Management', 'Search and review your records.', '')?>
<div id="staff-list-page" data-kind="complaints"></div>
<div class="ts-tabs mb-24" role="group" aria-label="Complaint status"><button type="button" class="ts-tab active" data-complaint-status="OPEN" aria-pressed="true">Open</button><button type="button" class="ts-tab" data-complaint-status="UNDER_INVESTIGATION" aria-pressed="false">Under Investigation</button><button type="button" class="ts-tab" data-complaint-status="AWAITING_INFORMATION" aria-pressed="false">Awaiting Information</button><button type="button" class="ts-tab" data-complaint-status="RESOLVED" aria-pressed="false">Resolved</button><button type="button" class="ts-tab" data-complaint-status="REJECTED" aria-pressed="false">Rejected</button></div>
<section class="ts-card"><div class="ts-filter-bar"><input id="list-search" class="ts-input" aria-label="Reference, complainant or category" placeholder="Reference, complainant or category"><select id="list-priority" class="ts-select" aria-label="All priorities"><option value="">All priorities</option><option value="HIGH">High</option><option value="NORMAL">Normal</option><option value="LOW">Low</option></select></div>
<div class="ts-table-wrap"><table class="ts-table"><thead><tr><th>Reference</th><th>Complainant</th><th>Role</th><th>Category</th><th>Priority</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead><tbody id="staff-list-body"><tr><td colspan="8">Loading...</td></tr></tbody></table></div></section>
<script src="<?=ts_asset_url('assets/js/staff-page-tools.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/staff-lists.js', '..')?>"></script>
<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Complaint Management', 'complaints', $content, '..', '');
?>
