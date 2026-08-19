<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Merdeka Hall', 'Kuala Lumpur · Capacity 2,400', '<a class="ts-btn ts-btn-primary" href="venue-layout.php">'.ts_icon('layout').' Open Seating Layout</a>')?>
<div class="ts-grid-3">
    <div class="ts-card ts-card-pad">
        <div class="ts-detail-label">Layout Status</div>
        <div class="mt-12">
            <?=ts_status('Active', 'success')?>
        </div>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-detail-label">Confirmed Sections</div>
        <div class="ts-kpi-value">3</div>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-detail-label">Generated Seats</div>
        <div class="ts-kpi-value">120</div>
    </div>
</div>
<div class="ts-card mt-24">
    <div class="ts-card-head">
        <div>
            <div class="ts-card-title">Physical Venue Sections</div>
            <div class="ts-card-sub">Reusable across events; Organizer maps event-specific ticket categories later.
            </div>
        </div>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Section</th>
                    <th>Total Seats</th>
                    <th>Assignment Order</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="cell-title">Section A</td>
                    <td>20</td>
                    <td>A01 → A20</td>
                    <td><?=ts_status('Active', 'success')?>
                    </td>
                </tr>
                <tr>
                    <td class="cell-title">Section B</td>
                    <td>40</td>
                    <td>B01 → B40</td>
                    <td><?=ts_status('Active', 'success')?>
                    </td>
                </tr>
                <tr>
                    <td class="cell-title">Section C</td>
                    <td>60</td>
                    <td>C01 → C60</td>
                    <td><?=ts_status('Active', 'success')?>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Merdeka Hall', 'venues', $content, '..', '');
?>