<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Secondary Market Control', 'Monitor resale activity for your own events and report suspicious listings to the Administrator.', '<select class="ts-select" id="resale-event-filter"><option value="">All events</option></select>')?>
<div class="ts-alert ts-alert-warning mb-24" id="resale-violation-alert" style="display:none">
    <?=ts_icon('alert')?>
    <div><strong>Resale rule violation detected</strong>
        <div class="small mt-8" id="resale-violation-detail"></div>
    </div><button class="ts-btn ts-btn-secondary ts-btn-sm" id="report-listing-btn">Report Listing</button>
</div>
<div class="ts-card">
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Ticket</th>
                    <th>Seller</th>
                    <th>Category</th>
                    <th>Original</th>
                    <th>Resale</th>
                    <th>Listed</th>
                    <th>Status</th>
                    <th>Rule Compliance</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="resale-tbody">
                <tr><td colspan="9" class="text-center">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script type="module" src="../assets/js/secondary-market.js"></script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Secondary Market', 'secondary', $content, '..', '');
?>
