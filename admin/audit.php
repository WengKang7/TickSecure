<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>
<?=ts_page_head('Audit Log', 'Search and review your records.', '<button type="button" id="list-export" class="ts-btn ts-btn-secondary" disabled>Export Audit CSV</button>')?>
<div id="staff-list-page" data-kind="audit"></div>

<section class="ts-card"><div class="ts-filter-bar"><input id="list-search" class="ts-input" aria-label="User, activity or related entity" placeholder="User, activity or related entity"><select id="list-role" class="ts-select" aria-label="All roles"><option value="">All roles</option><option value="ADMIN">Administrator</option><option value="ORGANIZER">Organizer</option><option value="BUYER">Buyer</option><option value="SYSTEM">System</option></select><select id="list-activity" class="ts-select" aria-label="All activities"><option value="">All activities</option></select><input type="date" id="list-date" class="ts-input" aria-label="Audit date (Malaysia time)"></div>
<div class="ts-table-wrap"><table class="ts-table"><thead><tr><th>Date / Time</th><th>Actor</th><th>Role</th><th>Activity</th><th>Related entity</th><th>Result</th><th>Details</th></tr></thead><tbody id="staff-list-body"><tr><td colspan="7">Loading...</td></tr></tbody></table></div></section>
<script src="<?=ts_asset_url('assets/js/staff-page-tools.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/staff-lists.js', '..')?>"></script>
<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Audit Log', 'audit', $content, '..', '');
?>
