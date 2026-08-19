<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Organizer Applications', 'Review pending Event Organizer registrations and record approval or rejection decisions.', '')?>
<div class="ts-kpi-grid mb-24">
    <?=ts_kpi('Pending', '7', 'clock')?><?=ts_kpi('Approved This Month', '14', 'check')?><?=ts_kpi('Rejected This Month', '2', 'x')?><?=ts_kpi('Average Review', '6.2h', 'activity')?>
</div>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Applicant or organization"></div><select class="ts-select">
            <option>Pending first</option>
            <option>Newest first</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Applicant</th>
                    <th>Organization</th>
                    <th>Email</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="cell-title">Amelia Wong</td>
                    <td>Northlight Events</td>
                    <td>amelia@northlight.my</td>
                    <td>18 Aug · 09:20</td>
                    <td><?=ts_status('Pending', 'warning')?>
                    </td>
                    <td><a class="ts-btn ts-btn-primary ts-btn-sm" href="organizer-detail.php">Review</a></td>
                </tr>
                <tr>
                    <td class="cell-title">Daniel Ng</td>
                    <td>Pulse Culture</td>
                    <td>daniel@pulseculture.my</td>
                    <td>17 Aug · 15:44</td>
                    <td><?=ts_status('Pending', 'warning')?>
                    </td>
                    <td><a class="ts-btn ts-btn-primary ts-btn-sm" href="organizer-detail.php">Review</a></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Organizer Applications', 'organizers', $content, '..', '');
?>