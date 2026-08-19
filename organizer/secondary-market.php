<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Secondary Market Control', 'Monitor resale activity for your own events and report suspicious listings to the Administrator.', '<select class="ts-select"><option>All events</option><option>Aurora After Dark</option></select>')?>
<div class="ts-alert ts-alert-warning mb-24">
    <?=ts_icon('alert')?>
    <div><strong>Resale rule violation detected</strong>
        <div class="small mt-8">Listing RL-2026-144 exceeds the maximum resale price by RM120. Organizer may report it
            for Administrator enforcement.</div>
    </div><button class="ts-btn ts-btn-secondary ts-btn-sm" data-modal-open="confirm-modal">Report Listing</button>
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
            <tbody>
                <tr>
                    <td class="cell-title">TS-TK-0048</td>
                    <td class="ts-wallet-id">0x12A4…8F92</td>
                    <td>VIP2</td>
                    <td>RM518</td>
                    <td>RM540</td>
                    <td>17 Aug</td>
                    <td><?=ts_status('Active', 'success')?>
                    </td>
                    <td><?=ts_status('Compliant', 'success')?>
                    </td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm">View</button></td>
                </tr>
                <tr>
                    <td class="cell-title">TS-TK-0884</td>
                    <td class="ts-wallet-id">0x0F91…A77B</td>
                    <td>VIP1</td>
                    <td>RM688</td>
                    <td>RM876</td>
                    <td>16 Aug</td>
                    <td><?=ts_status('Active', 'success')?>
                    </td>
                    <td><span
                            class="ts-risk"><?=ts_icon('flag')?>
                            Above limit</span></td>
                    <td><button class="ts-btn ts-btn-danger ts-btn-sm" data-modal-open="confirm-modal">Report</button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Secondary Market', 'secondary', $content, '..', '');
?>