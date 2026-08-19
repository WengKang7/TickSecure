<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('User Management', 'Search registered Buyers and Event Organizers, review account status and apply access controls.', '<button class="ts-btn ts-btn-secondary">'.ts_icon('download').' Export</button>')?>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Search name or email"></div><select class="ts-select">
            <option>All roles</option>
            <option>Buyer</option>
            <option>Event Organizer</option>
        </select><select class="ts-select">
            <option>All statuses</option>
            <option>Active</option>
            <option>Suspended</option>
        </select><select class="ts-select">
            <option>All verification</option>
            <option>Verified</option>
            <option>Unverified</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Account Status</th>
                    <th>Email Verified</th>
                    <th>Created</th>
                    <th>Last Activity</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="cell-title">Ong Weng Kang</td>
                    <td>guan.hong@example.com</td>
                    <td>Buyer</td>
                    <td><?=ts_status('Active', 'success')?>
                    </td>
                    <td><?=ts_status('Verified', 'success')?>
                    </td>
                    <td>10 Jun 2026</td>
                    <td>Today</td>
                    <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="user-detail.php">View</a></td>
                </tr>
                <tr>
                    <td class="cell-title">Nicholas Tan</td>
                    <td>nicholas@novastage.my</td>
                    <td>Event Organizer</td>
                    <td><?=ts_status('Active', 'success')?>
                    </td>
                    <td><?=ts_status('Verified', 'success')?>
                    </td>
                    <td>02 Jun 2026</td>
                    <td>12 min ago</td>
                    <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="user-detail.php">View</a></td>
                </tr>
                <tr>
                    <td class="cell-title">Marcus Lee</td>
                    <td>marcus@example.com</td>
                    <td>Buyer</td>
                    <td><?=ts_status('Suspended', 'error')?>
                    </td>
                    <td><?=ts_status('Verified', 'success')?>
                    </td>
                    <td>18 Apr 2026</td>
                    <td>16 Aug</td>
                    <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="user-detail.php">View</a></td>
                </tr>
            </tbody>
        </table>
    </div>
    <div class="ts-pagination"><span>Showing 1–3 of 12,482 users</span>
        <div class="ts-page-numbers"><span class="ts-page-num active">1</span><span class="ts-page-num">2</span><span
                class="ts-page-num">3</span></div>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'User Management', 'users', $content, '..', '');
?>