<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Attendee Management', 'View booking, ticket and event-entry verification status for your events.', '<select class="ts-select"><option>Aurora After Dark</option></select>')?>
<div class="ts-grid-2 mb-24">
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Verified Attendees</span><span
                class="ts-kpi-icon"><?=ts_icon('check')?></span>
        </div>
        <div class="ts-kpi-value">842</div>
        <div class="ts-kpi-label">Entry verified</div>
    </div>
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Unverified Attendees</span><span
                class="ts-kpi-icon"><?=ts_icon('users')?></span>
        </div>
        <div class="ts-kpi-value">402</div>
        <div class="ts-kpi-label">Not yet scanned</div>
    </div>
</div>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Buyer, booking, ticket or wallet"></div><select class="ts-select">
            <option>All categories</option>
            <option>VIP1</option>
            <option>CAT1</option>
        </select><select class="ts-select">
            <option>All entry status</option>
            <option>Verified</option>
            <option>Unverified</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Buyer</th>
                    <th>Booking</th>
                    <th>Ticket</th>
                    <th>Category</th>
                    <th>Seat</th>
                    <th>Wallet</th>
                    <th>Entry Status</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="cell-title">Ong Weng Kang</td>
                    <td>TS20260001</td>
                    <td>TS-TK-100184</td>
                    <td>VIP1</td>
                    <td>A06</td>
                    <td class="ts-wallet-id">0x12A4…8F92</td>
                    <td><?=ts_status('Verified', 'success')?>
                    </td>
                </tr>
                <tr>
                    <td class="cell-title">Alicia Lim</td>
                    <td>TS20260002</td>
                    <td>TS-TK-100185</td>
                    <td>VIP1</td>
                    <td>A07</td>
                    <td class="ts-wallet-id">0x44BC…21D0</td>
                    <td><?=ts_status('Unverified', 'neutral')?>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Attendees', 'attendees', $content, '..', '');
?>