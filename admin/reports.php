<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Reports', 'Generate filtered governance, security, blockchain and resale monitoring reports.', '')?>
<div class="ts-grid-2">
    <div class="ts-card ts-card-pad">
        <div class="ts-kpi-icon">
            <?=ts_icon('activity')?></div>
        <div class="ts-card-title mt-16">System Activity Report</div>
        <p class="secondary">User, event, ticket and platform activity by date range and result.</p><button
            class="ts-btn ts-btn-secondary" data-toast="Report builder opened">Configure Report</button>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-kpi-icon">
            <?=ts_icon('shield')?></div>
        <div class="ts-card-title mt-16">Security & Audit Report</div>
        <p class="secondary">Login activity, sensitive actions, account status changes and audit events.</p><button
            class="ts-btn ts-btn-secondary">Configure Report</button>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-kpi-icon">
            <?=ts_icon('activity')?></div>
        <div class="ts-card-title mt-16">Blockchain Transaction Report</div>
        <p class="secondary">Confirmed, pending and failed mint/transfer/resale transactions.</p><button
            class="ts-btn ts-btn-secondary">Configure Report</button>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-kpi-icon">
            <?=ts_icon('flag')?></div>
        <div class="ts-card-title mt-16">Resale Monitoring Report</div>
        <p class="secondary">Listings, transactions, rule violations and enforcement activity.</p><button
            class="ts-btn ts-btn-secondary">Configure Report</button>
    </div>
</div>
<div class="ts-card ts-card-pad mt-24">
    <div class="ts-card-title">Report Builder Preview</div>
    <div class="ts-form-grid mt-20">
        <div class="ts-field"><label class="ts-label">Date From</label><input class="ts-input" type="date"></div>
        <div class="ts-field"><label class="ts-label">Date To</label><input class="ts-input" type="date"></div>
        <div class="ts-field"><label class="ts-label">Event</label><select class="ts-select">
                <option>All Events</option>
            </select></div>
        <div class="ts-field"><label class="ts-label">Status / Type</label><select class="ts-select">
                <option>All</option>
            </select></div>
    </div>
    <div class="flex justify-end gap-12 mt-24"><button class="ts-btn ts-btn-secondary">Preview</button><button
            class="ts-btn ts-btn-primary">Generate</button></div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Reports', 'reports', $content, '..', '');
?>