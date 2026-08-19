<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Complaint Management', 'Investigate complaints using related booking, payment, NFT ownership, wallet, resale and blockchain records.', '')?>
<div class="ts-tabs mb-24"><button class="ts-tab active">Open</button><button class="ts-tab">Under
        Investigation</button><button class="ts-tab">Awaiting Information</button><button
        class="ts-tab">Resolved</button><button class="ts-tab">Rejected</button></div>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Reference, complainant or category"></div><select class="ts-select">
            <option>All priorities</option>
            <option>High</option>
            <option>Normal</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Reference</th>
                    <th>Complainant</th>
                    <th>Role</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="cell-title">CMP-2026-0042</td>
                    <td>Ong Weng Kang</td>
                    <td>Buyer</td>
                    <td>Resale dispute</td>
                    <td><?=ts_status('Normal', 'neutral')?>
                    </td>
                    <td><?=ts_status('Under Investigation', 'warning')?>
                    </td>
                    <td>14 Aug</td>
                    <td><a class="ts-btn ts-btn-primary ts-btn-sm" href="complaint-detail.php">Investigate</a></td>
                </tr>
                <tr>
                    <td class="cell-title">CMP-ORG-0014</td>
                    <td>Nova Stage</td>
                    <td>Organizer</td>
                    <td>Suspicious resale</td>
                    <td><?=ts_status('High', 'error')?>
                    </td>
                    <td><?=ts_status('Open', 'info')?>
                    </td>
                    <td>16 Aug</td>
                    <td><a class="ts-btn ts-btn-primary ts-btn-sm" href="complaint-detail.php">Investigate</a></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Complaint Management', 'complaints', $content, '..', '');
?>