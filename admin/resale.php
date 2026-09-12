<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Resale Monitoring', 'Review official marketplace listings, policy compliance, and administrator enforcement actions.', '<button class="ts-btn ts-btn-secondary" type="button" id="resale-refresh">Refresh</button>')?>
<div class="ts-grid-3 mb-24">
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Active Listings</span><span class="ts-kpi-icon"><?=ts_icon('ticket')?></span></div>
        <div class="ts-kpi-value" id="resale-kpi-active">—</div>
        <div class="ts-kpi-label">Official marketplace</div>
    </div>
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Review Flags</span><span class="ts-kpi-icon"><?=ts_icon('flag')?></span></div>
        <div class="ts-kpi-value" id="resale-kpi-flags">—</div>
        <div class="ts-kpi-label">Require administrator review</div>
    </div>
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Suspended Listings</span><span class="ts-kpi-icon"><?=ts_icon('shield')?></span></div>
        <div class="ts-kpi-value" id="resale-kpi-suspended">—</div>
        <div class="ts-kpi-label">Removed from the marketplace</div>
    </div>
</div>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input class="ts-input" id="resale-search" placeholder="Event, ticket, seller, buyer, or wallet">
        </div>
        <select class="ts-select" id="resale-risk-filter">
            <option value="ALL">All risk states</option>
            <option value="FLAGGED">Flagged</option>
            <option value="COMPLIANT">Compliant</option>
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
                <tr><td colspan="10" class="text-center secondary" style="padding:40px">Loading…</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script type="module">
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[character]));

const amount = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const currency = value => `RM${amount(value).toFixed(2)}`;

const abbreviated = value => {
    const text = String(value || '');
    if (!text) return '—';
    return text.length > 14 ? `${text.slice(0, 6)}…${text.slice(-4)}` : text;
};

window.addEventListener('ts-auth-ready', async authEvent => {
    const profile = authEvent.detail;
    if (!profile?.role || profile.role !== 'admin') return;

    const tableBody = document.getElementById('resale-table-body');
    const searchInput = document.getElementById('resale-search');
    const riskFilter = document.getElementById('resale-risk-filter');
    const refreshButton = document.getElementById('resale-refresh');
    let listings = [];

    const isFlagged = listing => {
        const compliance = String(listing.ruleCompliance || '').toUpperCase();
        return compliance === 'VIOLATION' || Boolean(String(listing.riskFlag || '').trim());
    };

    const updateMetrics = () => {
        document.getElementById('resale-kpi-active').textContent = listings.filter(listing => String(listing.status || '').toUpperCase() === 'ACTIVE').length;
        document.getElementById('resale-kpi-flags').textContent = listings.filter(isFlagged).length;
        document.getElementById('resale-kpi-suspended').textContent = listings.filter(listing => String(listing.status || '').toUpperCase() === 'SUSPENDED').length;
    };

    const visibleListings = () => {
        const query = searchInput.value.trim().toLowerCase();
        const selectedRisk = riskFilter.value;
        return listings.filter(listing => {
            const searchable = [
                listing.ticketId,
                listing.eventName,
                listing.eventId,
                listing.sellerUid,
                listing.sellerWallet,
                listing.buyerUid,
                listing.buyerWallet,
                listing.categoryName,
                listing.seatId
            ].join(' ').toLowerCase();
            const matchesQuery = !query || searchable.includes(query);
            const flagged = isFlagged(listing);
            const matchesRisk = selectedRisk === 'ALL'
                || (selectedRisk === 'FLAGGED' && flagged)
                || (selectedRisk === 'COMPLIANT' && !flagged);
            return matchesQuery && matchesRisk;
        });
    };

    const renderListings = () => {
        const filtered = visibleListings();
        if (!filtered.length) {
            tableBody.innerHTML = '<tr><td colspan="10" class="text-center secondary" style="padding:40px">No resale listings match the selected filters.</td></tr>';
            return;
        }

        tableBody.innerHTML = filtered.map(listing => {
            const status = String(listing.status || 'UNKNOWN').toUpperCase();
            const statusTone = {
                ACTIVE: 'success',
                SOLD: 'info',
                SUSPENDED: 'error',
                CANCELLED: 'neutral'
            }[status] || 'neutral';
            const flagged = isFlagged(listing);
            const riskLabel = listing.riskFlag || (flagged ? 'Policy violation' : 'Compliant');
            const riskTone = flagged ? 'warning' : 'success';
            const seller = abbreviated(listing.sellerWallet || listing.sellerUid);
            const buyer = abbreviated(listing.buyerWallet || listing.buyerUid);

            return `
                <tr>
                    <td class="cell-title">${escapeHtml(listing.ticketId || '—')}</td>
                    <td>${escapeHtml(listing.eventName || listing.eventId || '—')}</td>
                    <td class="ts-wallet-id">${escapeHtml(seller)}</td>
                    <td class="ts-wallet-id">${escapeHtml(buyer)}</td>
                    <td>${currency(listing.originalPrice)}</td>
                    <td>${currency(listing.resalePrice)}</td>
                    <td>${listing.maxAllowedPrice ? currency(listing.maxAllowedPrice) : 'Not configured'}</td>
                    <td><span class="ts-chip ts-chip-${statusTone}">${escapeHtml(status)}</span></td>
                    <td><span class="ts-chip ts-chip-${riskTone}">${escapeHtml(riskLabel)}</span></td>
                    <td>${status === 'ACTIVE'
                        ? `<button class="ts-btn ts-btn-danger ts-btn-sm action-suspend" type="button" data-id="${escapeHtml(listing.id)}">Suspend</button>`
                        : '<span class="small secondary">—</span>'}</td>
                </tr>`;
        }).join('');

        tableBody.querySelectorAll('.action-suspend').forEach(button => {
            button.addEventListener('click', async () => {
                const reason = window.prompt('Reason for suspending this listing:');
                if (reason === null) return;
                if (!reason.trim()) {
                    window.alert('A suspension reason is required.');
                    return;
                }

                button.disabled = true;
                button.textContent = 'Suspending…';
                try {
                    await window.tsResale.suspendListing(button.dataset.id, reason.trim());
                    await loadListings();
                } catch (error) {
                    console.error('Unable to suspend resale listing:', error);
                    window.alert(error?.message || 'The listing could not be suspended.');
                    button.disabled = false;
                    button.textContent = 'Suspend';
                }
            });
        });
    };

    const loadListings = async () => {
        tableBody.innerHTML = '<tr><td colspan="10" class="text-center secondary" style="padding:40px">Loading…</td></tr>';
        refreshButton.disabled = true;
        try {
            if (!window.tsResale) throw new Error('Resale services are still loading.');
            listings = await window.tsResale.getListings();
            updateMetrics();
            renderListings();
        } catch (error) {
            console.error('Unable to load resale listings:', error);
            tableBody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding:40px;color:var(--ts-danger)">${escapeHtml(error?.message || 'Failed to load resale listings.')}</td></tr>`;
        } finally {
            refreshButton.disabled = false;
        }
    };

    searchInput.addEventListener('input', renderListings);
    riskFilter.addEventListener('change', renderListings);
    refreshButton.addEventListener('click', loadListings);
    await loadListings();
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Resale Monitoring', 'resale', $content, '..', '');
?>
