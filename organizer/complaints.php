<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Complaints & Disputes', 'Submit and track complaints raised by your organization. Administrator investigation details remain role-restricted.', '<button class="ts-btn ts-btn-primary" data-modal-open="confirm-modal">New Complaint</button>')?>
<div class="ts-card">
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Reference</th>
                    <th>Category</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="cell-title">CMP-ORG-0014</td>
                    <td>Suspicious resale</td>
                    <td>16 Aug 2026</td>
                    <td><?=ts_status('Under Investigation', 'warning')?>
                    </td>
                    <td>Today</td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm">View</button></td>
                </tr>
                <tr>
                    <td class="cell-title">CMP-ORG-0008</td>
                    <td>Blockchain transaction</td>
                    <td>03 Aug 2026</td>
                    <td><?=ts_status('Resolved', 'success')?>
                    </td>
                    <td>06 Aug</td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm">View</button></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Complaints', 'complaints', $content, '..', '');
?>