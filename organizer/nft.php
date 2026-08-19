<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('NFT Ticket Control', 'Monitor ticket minting, blockchain ownership and transfer history for your own events.', '<select class="ts-select"><option>Aurora After Dark</option></select>')?>
<div class="ts-kpi-grid">
    <?=ts_kpi('Total Tickets', '1,244', 'ticket')?><?=ts_kpi('Minted', '1,221', 'check')?><?=ts_kpi('Pending', '18', 'clock')?><?=ts_kpi('Failed', '5', 'alert')?>
</div>
<div class="ts-card mt-24">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Ticket ID, token ID or wallet"></div><select class="ts-select">
            <option>All minting status</option>
            <option>Confirmed</option>
            <option>Pending</option>
            <option>Failed</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Ticket ID</th>
                    <th>Category / Seat</th>
                    <th>Token ID</th>
                    <th>Current Wallet</th>
                    <th>Minting</th>
                    <th>Transaction</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="cell-title">TS-TK-100184</td>
                    <td>VIP1 · A06</td>
                    <td>#100184</td>
                    <td class="ts-wallet-id">0x12A4…8F92</td>
                    <td><?=ts_status('Confirmed', 'success')?>
                    </td>
                    <td><span class="ts-copy-code">0x98bd…31f7</span></td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm"
                            data-toast="NFT detail drawer opened">Details</button></td>
                </tr>
                <tr>
                    <td class="cell-title">TS-TK-100185</td>
                    <td>VIP1 · A07</td>
                    <td>#100185</td>
                    <td class="ts-wallet-id">0x44BC…21D0</td>
                    <td><?=ts_status('Pending', 'purple')?>
                    </td>
                    <td><span class="ts-copy-code">0x1aa2…990b</span></td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm">Details</button></td>
                </tr>
                <tr>
                    <td class="cell-title">TS-TK-100186</td>
                    <td>CAT1 · B04</td>
                    <td>—</td>
                    <td class="ts-wallet-id">0xA8F1…731D</td>
                    <td><?=ts_status('Failed', 'error')?>
                    </td>
                    <td><span class="ts-copy-code">0x777e…a14c</span></td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm">Details</button></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'NFT Tickets', 'nft', $content, '..', '');
?>