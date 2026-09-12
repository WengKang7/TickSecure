<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('NFT Ticket Control', 'Monitor ticket minting, blockchain ownership and transfer history for your own events.', '<select class="ts-select"><option>Aurora After Dark</option></select>')?>
<div class="ts-kpi-grid">
    <?=ts_kpi('Total Tickets', '<span id="nft-total">-</span>', 'ticket')?>
    <?=ts_kpi('Minted', '<span id="nft-minted">-</span>', 'check')?>
    <?=ts_kpi('Pending', '<span id="nft-pending">-</span>', 'clock')?>
    <?=ts_kpi('Failed', '<span id="nft-failed">-</span>', 'alert')?>
</div>
<div class="ts-card mt-24">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Ticket ID, token ID or wallet"></div><select class="ts-select">
            <option>All minting status</option>
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
            <tbody id="nft-tbody">
                <tr><td colspan="7" class="text-center">Loading NFTs...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script type="module">
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
window.addEventListener('ts-auth-ready', async () => {
    try {
        const tickets = await window.tsTickets.getTickets();

        let total = tickets.length;
        let minted = 0;
        let pending = 0;
        let failed = 0;

        tickets.forEach(t => {
            const status = (t.mintingStatus || 'MINTED').toUpperCase();
            if (status === 'MINTED') minted++;
            else if (status === 'PENDING') pending++;
            else failed++;
        });

        document.getElementById('nft-total').textContent = total.toLocaleString();
        document.getElementById('nft-minted').textContent = minted.toLocaleString();
        document.getElementById('nft-pending').textContent = pending.toLocaleString();
        document.getElementById('nft-failed').textContent = failed.toLocaleString();

        const tbody = document.getElementById('nft-tbody');
        if (tbody) {
            tbody.innerHTML = tickets.slice(0, 20).map(t => {
                const status = (t.mintingStatus || 'MINTED').toUpperCase();
                const tone = status === 'MINTED' ? 'success' : (status === 'PENDING' ? 'purple' : 'error');
                return `
                    <tr>
                        <td class="cell-title">${esc(t.id)}</td>
                        <td>${esc(t.category || 'N/A')} · ${esc(t.seatId || 'N/A')}</td>
                        <td>${esc(t.tokenId || '-')}</td>
                        <td class="ts-wallet-id">${esc(t.walletAddress || t.ownerWallet || 'Unassigned')}</td>
                        <td><span class="ts-chip ts-chip-${tone}">${status}</span></td>
                        <td><span class="ts-copy-code">${esc(t.transactionHash || '-')}</span></td>
                        <td><button class="ts-btn ts-btn-secondary ts-btn-sm">Details</button></td>
                    </tr>
                `;
            }).join('') || '<tr><td colspan="7" class="text-center">No NFTs found.</td></tr>';
        }

    } catch (e) {
        console.error('Failed to load NFTs', e);
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'NFT Tickets', 'nft', $content, '..', '');
?>
