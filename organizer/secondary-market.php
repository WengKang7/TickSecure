<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Secondary Market Control', 'Monitor resale activity for your own events and report suspicious listings to the Administrator.', '<select class="ts-select"><option>All events</option><option>Aurora After Dark</option></select>')?>
<div class="ts-alert ts-alert-warning mb-24">
    <?=ts_icon('alert')?>
    <div><strong>Resale rule violation detected</strong>
        <div class="small mt-8">Listing RL-2026-144 exceeds the maximum resale price by RM120. Organizer may report it
            for Administrator enforcement.</div>
    </div><button class="ts-btn ts-btn-secondary ts-btn-sm" data-modal-open="confirm-modal">Report Listing</button>
</div>
<div class="ts-card">
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Ticket</th>
                    <th>Seller</th>
                    <th>Category</th>
                    <th>Original</th>
                    <th>Resale</th>
                    <th>Listed</th>
                    <th>Status</th>
                    <th>Rule Compliance</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="resale-tbody">
                <tr><td colspan="9" class="text-center">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script type="module">
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
window.addEventListener('ts-auth-ready', async () => {
    try {
        const listings = await window.tsResale.getListings();
        
        const tbody = document.getElementById('resale-tbody');
        if(tbody) {
            tbody.innerHTML = listings.slice(0, 20).map(l => {
                const statusTone = l.status === 'ACTIVE' ? 'success' : (l.status === 'SOLD' ? 'info' : 'neutral');
                return `
                <tr>
                    <td class="cell-title">${esc(l.ticketId || l.id)}</td>
                    <td class="ts-wallet-id">${esc(l.sellerWallet || l.sellerUid || '—')}</td>
                    <td>${esc(l.categoryName || l.ticketCategory || 'N/A')}</td>
                    <td>RM${l.originalPrice || 0}</td>
                    <td>RM${l.resalePrice || l.askingPrice || 0}</td>
                    <td>${new Date(l.createdAt).toLocaleDateString()}</td>
                    <td><span class="ts-chip ts-chip-${statusTone}">${esc(l.status)}</span></td>
                    <td><span class="ts-chip ts-chip-success">Compliant</span></td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm">View</button></td>
                </tr>
                `;
            }).join('') || '<tr><td colspan="9" class="text-center">No active listings found.</td></tr>';
        }
    } catch(e) { console.error('Failed to load listings', e); }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Secondary Market', 'secondary', $content, '..', '');
?>
