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
            <tbody id="resale-table-body">
                <tr><td colspan="10" class="text-center secondary" style="padding:40px">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    const loadListings = async () => {
        try {
            const listings = await window.tsResale.getListings();
            const tbody = document.getElementById('resale-table-body');
            if (!tbody) return;
            
            if (listings.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="text-center secondary" style="padding:40px">No resale listings found.</td></tr>';
                return;
            }
            
            const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
            
            tbody.innerHTML = listings.map(l => {
                let statusTone = l.status === 'active' ? 'success' : (l.status === 'suspended' ? 'error' : 'neutral');
                let riskTone = l.price > l.originalPrice * 1.1 ? 'warning' : 'success'; // simplistic mock risk
                let riskLabel = riskTone === 'warning' ? 'Above limit' : 'Compliant';

                return `
                    <tr>
                        <td class="cell-title">${esc(l.ticketId)}</td>
                        <td>${esc(l.eventId)}</td>
                        <td class="ts-wallet-id">${esc(l.sellerId)}</td>
                        <td>${esc(l.buyerId || '—')}</td>
                        <td>RM${esc(l.originalPrice)}</td>
                        <td>RM${esc(l.price)}</td>
                        <td>RM${esc(l.originalPrice * 1.1)}</td>
                        <td><span class="ts-chip ts-chip-${statusTone}">${esc(l.status)}</span></td>
                        <td><span class="ts-chip ts-chip-${riskTone}">${riskLabel}</span></td>
                        <td>
                            ${l.status === 'active' ? `<button class="ts-btn ts-btn-danger ts-btn-sm action-suspend" data-id="${l.id}">Enforce</button>` : `<button class="ts-btn ts-btn-secondary ts-btn-sm">View</button>`}
                        </td>
                    </tr>
                `;
            }).join('');
            
            document.querySelectorAll('.action-suspend').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Suspend this listing?')) {
                        try {
                            btn.disabled = true;
                            await window.tsResale.suspendListing(btn.dataset.id);
                            await loadListings();
                        } catch(err) { alert(err.message); }
                    }
                });
            });
            
        } catch (err) {
            console.error('Load error:', err);
        }
    };
    
    await loadListings();
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Resale Monitoring', 'resale', $content, '..', '');
?>