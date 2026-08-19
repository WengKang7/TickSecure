<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Resale Monitoring', 'Detect and enforce organizer-defined resale limits, periods and suspicious account/wallet behaviour.', '<button class="ts-btn ts-btn-secondary">Generate Resale Report</button>')?>
<div class="ts-grid-3 mb-24">
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Active Listings</span><span
                class="ts-kpi-icon"><?=ts_icon('ticket')?></span>
        </div>
        <div class="ts-kpi-value">842</div>
        <div class="ts-kpi-label">Official marketplace</div>
    </div>
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Risk Flags</span><span
                class="ts-kpi-icon"><?=ts_icon('flag')?></span>
        </div>
        <div class="ts-kpi-value">14</div>
        <div class="ts-kpi-label">Require review</div>
    </div>
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Blacklisted Wallets</span><span
                class="ts-kpi-icon"><?=ts_icon('shield')?></span>
        </div>
        <div class="ts-kpi-value">9</div>
        <div class="ts-kpi-label">Resale restricted</div>
    </div>
</div>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Event, ticket, user or wallet"></div><select class="ts-select">
            <option>All risk states</option>
            <option>Flagged</option>
            <option>Compliant</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Ticket</th>
                    <th>Event</th>
                    <th>Seller</th>
                    <th>Buyer</th>
                    <th>Original</th>
                    <th>Resale</th>
                    <th>Maximum</th>
                    <th>Status</th>
                    <th>Risk</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="cell-title">TS-TK-0884</td>
                    <td>Velvet Hour</td>
                    <td class="ts-wallet-id">0x0F91…A77B</td>
                    <td>—</td>
                    <td>RM688</td>
                    <td>RM876</td>
                    <td>RM756</td>
                    <td><?=ts_status('Active', 'success')?>
                    </td>
                    <td><span
                            class="ts-risk"><?=ts_icon('flag')?>
                            Above limit</span></td>
                    <td><button class="ts-btn ts-btn-danger ts-btn-sm" data-modal-open="confirm-modal">Enforce</button>
                    </td>
                </tr>
                <tr>
                    <td class="cell-title">TS-TK-0048</td>
                    <td>Midnight Resonance</td>
                    <td class="ts-wallet-id">0x12A4…8F92</td>
                    <td>—</td>
                    <td>RM518</td>
                    <td>RM540</td>
                    <td>RM570</td>
                    <td><?=ts_status('Active', 'success')?>
                    </td>
                    <td><?=ts_status('Compliant', 'success')?>
                    </td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm">View</button></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Resale Monitoring', 'resale', $content, '..', '');
?>