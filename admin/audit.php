<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Audit Log', 'Administrator-only, read-only history of sensitive and security-relevant actions across TickSecure.', '<button class="ts-btn ts-btn-secondary">'.ts_icon('download').' Export Audit</button>')?>
<div class="ts-alert ts-alert-info mb-24">
    <?=ts_icon('shield')?>
    <div><strong>Read-only governance record</strong>
        <div class="small mt-8">Audit entries cannot be edited by ordinary users. Filters only change the visible view.
        </div>
    </div>
</div>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="User, activity or related entity"></div><select class="ts-select">
            <option>All roles</option>
            <option>Administrator</option>
            <option>Organizer</option>
            <option>Buyer</option>
            <option>System</option>
        </select><select class="ts-select">
            <option>All activities</option>
            <option>Login</option>
            <option>Event</option>
            <option>NFT</option>
            <option>Resale</option>
            <option>Complaint</option>
        </select><input class="ts-input" type="date">
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Date / Time</th>
                    <th>User / System Actor</th>
                    <th>Role</th>
                    <th>Activity Type</th>
                    <th>Related Entity</th>
                    <th>Result</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>18 Aug · 14:12</td>
                    <td>Admin Account</td>
                    <td>Administrator</td>
                    <td>Organizer Approved</td>
                    <td>ORG-0086</td>
                    <td><?=ts_status('Success', 'success')?>
                    </td>
                    <td><button class="ts-btn ts-btn-tertiary ts-btn-sm">View</button></td>
                </tr>
                <tr>
                    <td>18 Aug · 13:58</td>
                    <td>Nova Stage</td>
                    <td>Organizer</td>
                    <td>Event Submitted</td>
                    <td>EVT-0144</td>
                    <td><?=ts_status('Success', 'success')?>
                    </td>
                    <td><button class="ts-btn ts-btn-tertiary ts-btn-sm">View</button></td>
                </tr>
                <tr>
                    <td>18 Aug · 13:41</td>
                    <td>System</td>
                    <td>System</td>
                    <td>NFT Mint</td>
                    <td>TS-TK-100186</td>
                    <td><?=ts_status('Failed', 'error')?>
                    </td>
                    <td><button class="ts-btn ts-btn-tertiary ts-btn-sm">View</button></td>
                </tr>
                <tr>
                    <td>18 Aug · 13:22</td>
                    <td>Ong Weng Kang</td>
                    <td>Buyer</td>
                    <td>Login</td>
                    <td>Account</td>
                    <td><?=ts_status('Success', 'success')?>
                    </td>
                    <td><button class="ts-btn ts-btn-tertiary ts-btn-sm">View</button></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Audit Logs', 'audit', $content, '..', '');
?>