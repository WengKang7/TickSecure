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
            <tbody id="tx-table-body">
                <tr><td colspan="7" class="text-center secondary" style="padding:40px">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    try {
        const txs = await window.tsBlockchain.getTransactions();
        const tbody = document.getElementById('tx-table-body');
        if (!tbody) return;
        
        if (txs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center secondary" style="padding:40px">No transactions found.</td></tr>';
            return;
        }
        
        const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
        
        tbody.innerHTML = txs.map(tx => {
            let tone = 'neutral';
            if (tx.status === 'confirmed' || tx.status === 'success') tone = 'success';
            else if (tx.status === 'pending') tone = 'purple';
            else if (tx.status === 'failed') tone = 'error';
            
            const hashShort = tx.hash ? tx.hash.substring(0,6) + '…' + tx.hash.substring(tx.hash.length-4) : 'N/A';
            const walletShort = tx.walletAddress ? tx.walletAddress.substring(0,6) + '…' + tx.walletAddress.substring(tx.walletAddress.length-4) : 'N/A';

            return `
                <tr>
                    <td><span class="ts-copy-code">${esc(hashShort)}</span></td>
                    <td class="ts-wallet-id">${esc(walletShort)}</td>
                    <td>${esc(tx.type)}</td>
                    <td>${esc(tx.ticketId || tx.targetId)}</td>
                    <td><span class="ts-chip ts-chip-${tone}">${esc(tx.status)}</span></td>
                    <td>${new Date(tx.createdAt).toLocaleString()}</td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm" onclick="alert('Transaction ID: ${tx.id}')">Details</button></td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Load error:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Blockchain Transactions', 'blockchain', $content, '..', '');
?>