<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Blockchain Transaction Monitoring', 'Search, filter and inspect platform blockchain activity across minting, transfers and resale.', '<button class="ts-btn ts-btn-secondary">'.ts_icon('download').' Export</button>')?>
<div class="ts-kpi-grid mb-24">
    <?=ts_kpi('Simulated records', '<span id="tx-total-kpi">...</span>', 'check')?><?=ts_kpi('Pending', '<span id="tx-pending-kpi">...</span>', 'clock')?><?=ts_kpi('Failed', '<span id="tx-failed-kpi">...</span>', 'alert')?><?=ts_kpi('Tracked Wallets', '<span id="tx-wallets-kpi">...</span>', 'wallet')?>
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
        document.getElementById('tx-total-kpi').textContent = txs.length.toLocaleString();
        document.getElementById('tx-pending-kpi').textContent = txs.filter(tx => String(tx.status || '').toUpperCase() === 'PENDING').length.toLocaleString();
        document.getElementById('tx-failed-kpi').textContent = txs.filter(tx => String(tx.status || '').toUpperCase() === 'FAILED').length.toLocaleString();
        document.getElementById('tx-wallets-kpi').textContent = new Set(txs.map(tx => tx.walletAddress).filter(Boolean)).size.toLocaleString();
        
        if (txs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center secondary" style="padding:40px">No transactions found.</td></tr>';
            return;
        }
        
        const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
        
        tbody.innerHTML = txs.map(tx => {
            let tone = 'neutral';
            const status = String(tx.status || '').toUpperCase();
            if (status === 'CONFIRMED' || status === 'SUCCESS') tone = 'success';
            else if (status === 'PENDING') tone = 'purple';
            else if (status === 'FAILED') tone = 'error';
            
            const hash = tx.transactionHash || tx.hash || '';
            const hashShort = hash ? hash.substring(0,6) + '…' + hash.substring(hash.length-4) : 'N/A';
            const walletShort = tx.walletAddress ? tx.walletAddress.substring(0,6) + '…' + tx.walletAddress.substring(tx.walletAddress.length-4) : 'N/A';

            return `
                <tr>
                    <td><span class="ts-copy-code">${esc(hashShort)}</span></td>
                    <td class="ts-wallet-id">${esc(walletShort)}</td>
                    <td>${esc(tx.transactionType)}</td>
                    <td>${esc(tx.ticketId || tx.relatedEntityId)}</td>
                    <td><span class="ts-chip ts-chip-${tone}">${esc(status || 'UNKNOWN')}</span></td>
                    <td>${tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '—'}</td>
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
