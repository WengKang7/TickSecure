<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Blockchain Transaction Monitoring', 'Search, filter and inspect platform blockchain activity across minting, transfers and resale.', '<button class="ts-btn ts-btn-secondary">'.ts_icon('download').' Export</button>')?>
<div class="ts-kpi-grid mb-24">
    <?=ts_kpi('Confirmed Today', '1,482', 'check')?><?=ts_kpi('Pending', '37', 'clock')?><?=ts_kpi('Failed', '12', 'alert')?><?=ts_kpi('Tracked Wallets', '8,902', 'wallet')?>
</div>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Hash, ticket, wallet, booking or event ID"></div><select
            class="ts-select">
            <option>All statuses</option>
            <option>Pending</option>
            <option>Confirmed</option>
            <option>Failed</option>
        </select><select class="ts-select">
            <option>All transaction types</option>
            <option>Mint</option>
            <option>Transfer</option>
            <option>Resale Transfer</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Transaction Hash</th>
                    <th>Wallet</th>
                    <th>Type</th>
                    <th>Ticket</th>
                    <th>Status</th>
                    <th>Date / Time</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><span class="ts-copy-code">0x98bd…31f7</span></td>
                    <td class="ts-wallet-id">0x12A4…8F92</td>
                    <td>NFT Mint</td>
                    <td>TS-TK-100184</td>
                    <td><?=ts_status('Confirmed', 'success')?>
                    </td>
                    <td>18 Aug · 14:10</td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm"
                            data-toast="Transaction detail drawer opened">Details</button></td>
                </tr>
                <tr>
                    <td><span class="ts-copy-code">0x1aa2…990b</span></td>
                    <td class="ts-wallet-id">0x44BC…21D0</td>
                    <td>Transfer</td>
                    <td>TS-TK-100185</td>
                    <td><?=ts_status('Pending', 'purple')?>
                    </td>
                    <td>18 Aug · 14:06</td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm">Details</button></td>
                </tr>
                <tr>
                    <td><span class="ts-copy-code">0x777e…a14c</span></td>
                    <td class="ts-wallet-id">0xA8F1…731D</td>
                    <td>NFT Mint</td>
                    <td>TS-TK-100186</td>
                    <td><?=ts_status('Failed', 'error')?>
                    </td>
                    <td>18 Aug · 13:41</td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm">Details</button></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Blockchain Transactions', 'blockchain', $content, '..', '');
?>