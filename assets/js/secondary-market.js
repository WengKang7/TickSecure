const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

let initialized = false;
async function loadSecondaryMarket() {
    if (initialized || !window.tsCurrentUser?.uid) return;
    initialized = true;

    const tbody = document.getElementById('resale-tbody');
    const filter = document.getElementById('resale-event-filter');
    const alertBox = document.getElementById('resale-violation-alert');
    try {
        const listings = await window.tsResale.getListings();
        const violating = listings.find(listing => listing.status === 'ACTIVE' && (
            listing.ruleCompliance === 'VIOLATION' ||
            (Number(listing.maxAllowedPrice) > 0 && Number(listing.resalePrice) > Number(listing.maxAllowedPrice))
        ));
        if (violating) {
            const allowedPrice = Number(violating.maxAllowedPrice);
            const excess = Math.max(0, Number(violating.resalePrice) - allowedPrice);
            document.getElementById('resale-violation-detail').textContent =
                allowedPrice > 0
                    ? `Listing ${violating.id} exceeds the allowed price by RM${excess.toFixed(2)}.`
                    : `Listing ${violating.id} has been flagged for policy review.`;
            document.getElementById('report-listing-btn').addEventListener('click', () => {
                window.location.href = `complaints.php?listingId=${encodeURIComponent(violating.id)}`;
            });
            alertBox.style.display = 'flex';
        }

        const events = new Map(listings.filter(listing => listing.eventId)
            .map(listing => [listing.eventId, listing.eventName || listing.eventId]));
        filter.innerHTML = '<option value="">All events</option>' +
            [...events].map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join('');

        const render = () => {
            const visible = listings.filter(listing => !filter.value || listing.eventId === filter.value);
            tbody.innerHTML = visible.slice(0, 50).map(listing => {
                const statusTone = listing.status === 'ACTIVE' ? 'success' :
                    (listing.status === 'SOLD' ? 'info' : 'neutral');
                const violated = listing.ruleCompliance === 'VIOLATION' ||
                    (Number(listing.maxAllowedPrice) > 0 && Number(listing.resalePrice) > Number(listing.maxAllowedPrice));
                const listedAt = new Date(listing.createdAt || '');
                return `<tr>
                    <td class="cell-title">${escapeHtml(listing.ticketId || listing.id)}</td>
                    <td class="ts-wallet-id">${escapeHtml(listing.sellerWallet || listing.sellerUid || '—')}</td>
                    <td>${escapeHtml(listing.categoryName || listing.ticketCategory || 'N/A')}</td>
                    <td>RM${Number(listing.originalPrice || 0).toFixed(2)}</td>
                    <td>RM${Number(listing.resalePrice || listing.askingPrice || 0).toFixed(2)}</td>
                    <td>${Number.isNaN(listedAt.getTime()) ? '—' : listedAt.toLocaleDateString()}</td>
                    <td><span class="ts-chip ts-chip-${statusTone}">${escapeHtml(listing.status)}</span></td>
                    <td><span class="ts-chip ts-chip-${violated ? 'error' : 'success'}">${violated ? 'Review' : 'Compliant'}</span></td>
                    <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="../public/resale-detail.php?id=${encodeURIComponent(listing.id)}">View</a></td>
                </tr>`;
            }).join('') || '<tr><td colspan="9" class="text-center">No listings found.</td></tr>';
        };
        filter.addEventListener('change', render);
        render();
    } catch (error) {
        console.error('Failed to load listings', error);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Unable to load resale listings.</td></tr>';
    }
}

window.addEventListener('ts-auth-ready', loadSecondaryMarket);
if (window.tsCurrentUser?.uid) loadSecondaryMarket();
