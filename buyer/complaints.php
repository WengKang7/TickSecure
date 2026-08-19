<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Support</div>
                <h1 class="ts-section-title">Complaints & Disputes</h1>
                <p class="ts-section-copy">Track ticket, payment, ownership, resale and account-related complaints.</p>
            </div><a class="ts-btn ts-btn-primary" href="complaint-new.php">New Complaint</a>
        </div>
        <div class="ts-card">
            <div class="ts-table-wrap">
                <table class="ts-table">
                    <thead>
                        <tr>
                            <th>Reference</th>
                            <th>Category</th>
                            <th>Submitted</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Last Updated</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="cell-title">CMP-2026-0042</td>
                            <td>Resale dispute</td>
                            <td>14 Aug 2026</td>
                            <td><?=ts_status('Normal', 'neutral')?>
                            </td>
                            <td><?=ts_status('Under Investigation', 'warning')?>
                            </td>
                            <td>17 Aug 2026</td>
                            <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="complaint-detail.php">View</a></td>
                        </tr>
                        <tr>
                            <td class="cell-title">CMP-2026-0021</td>
                            <td>Payment issue</td>
                            <td>22 Jul 2026</td>
                            <td><?=ts_status('High', 'error')?>
                            </td>
                            <td><?=ts_status('Resolved', 'success')?>
                            </td>
                            <td>26 Jul 2026</td>
                            <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="complaint-detail.php">View</a></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Complaints', 'tickets', $content, '..', true);
?>