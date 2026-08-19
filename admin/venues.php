<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Venue Management', 'Create physical venues, upload seating blueprints and activate processed layouts for Organizer event configuration.', '<a class="ts-btn ts-btn-primary" href="venue-new.php">'.ts_icon('plus').' Add Venue</a>')?>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Search venue or address"></div><select class="ts-select">
            <option>All layout status</option>
            <option>Active</option>
            <option>Processing</option>
            <option>Draft</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Venue</th>
                    <th>Address</th>
                    <th>Capacity</th>
                    <th>Layout Status</th>
                    <th>Detected Sections</th>
                    <th>Last Updated</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="cell-title">Merdeka Hall</td>
                    <td>Kuala Lumpur</td>
                    <td>2,400</td>
                    <td><?=ts_status('Active', 'success')?>
                    </td>
                    <td>3</td>
                    <td>12 Aug 2026</td>
                    <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="venue-detail.php">Manage</a></td>
                </tr>
                <tr>
                    <td class="cell-title">Axiata Arena</td>
                    <td>Bukit Jalil</td>
                    <td>16,000</td>
                    <td><?=ts_status('Active', 'success')?>
                    </td>
                    <td>6</td>
                    <td>09 Aug 2026</td>
                    <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="venue-detail.php">Manage</a></td>
                </tr>
                <tr>
                    <td class="cell-title">Studio K</td>
                    <td>Petaling Jaya</td>
                    <td>850</td>
                    <td><?=ts_status('Processing', 'purple')?>
                    </td>
                    <td>—</td>
                    <td>Today</td>
                    <td><a class="ts-btn ts-btn-primary ts-btn-sm" href="venue-layout.php">Continue</a></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Venues & Layouts', 'venues', $content, '..', '');
?>