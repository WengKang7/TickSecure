<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Seller centre</div>
                <h1 class="ts-section-title">My Resale Listings</h1>
                <p class="ts-section-copy">Manage eligible NFT tickets listed on TickSecure's controlled secondary
                    market.</p>
            </div><a class="ts-btn ts-btn-primary" href="resale-new.php">Create Listing</a>
        </div>
        <div class="ts-tabs mb-24" id="resale-tabs">
            <button class="ts-tab active" data-filter="active">Active</button>
            <button class="ts-tab" data-filter="sold">Sold</button>
            <button class="ts-tab" data-filter="cancelled">Cancelled</button>
            <button class="ts-tab" data-filter="suspended">Suspended</button>
        </div>
        <div class="ts-card">
            <div class="ts-table-wrap">
                <table class="ts-table">
                    <thead>
                        <tr>
                            <th>Ticket</th>
                            <th>Event</th>
                            <th>Original</th>
                            <th>Listing Price</th>
                            <th>Listed</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="resale-tbody">
                        <tr><td colspan="7" class="text-center secondary" style="padding:40px">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</main>

<script type="module">
const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const amount = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const currency = value => `RM${amount(value).toFixed(2)}`;

const formatDate = value => {
    if (!value) return '—';
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

window.addEventListener('ts-auth-ready', async () => {
    let listings = [];
    let activeFilter = 'active';
    const tbody = document.getElementById('resale-tbody');
    const tabs = document.querySelectorAll('#resale-tabs .ts-tab');
    
    const loadData = async () => {
        try {
            listings = await window.tsResale.getUserListings();
            render(activeFilter);
        } catch (err) {
            console.error('Load error:', err);
            tbody.innerHTML = `<tr><td colspan="7" class="text-center secondary" style="padding:40px">${esc(err?.message || 'Unable to load your resale listings.')}</td></tr>`;
        }
    };
    
    const cancelListing = async (id) => {
        if (!window.confirm('Are you sure you want to cancel this listing?')) return;
        try {
            await window.tsResale.cancelListing(id);
            await loadData();
        } catch (err) {
            console.error('Cancel error:', err);
            window.alert(err?.message || 'The listing could not be cancelled.');
        }
    };

    const repriceListing = async id => {
        const listing = listings.find(item => item.id === id);
        if (!listing || String(listing.status || '').toUpperCase() !== 'ACTIVE') return;

        const currentPrice = amount(listing.resalePrice);
        const maximumPrice = amount(listing.maxAllowedPrice);
        const maximumLabel = maximumPrice > 0 ? ` (maximum RM${maximumPrice.toFixed(2)})` : '';
        const entered = window.prompt(`Enter a new resale price${maximumLabel}:`, currentPrice.toFixed(2));
        if (entered === null) return;

        const newPrice = Number(entered);
        if (!Number.isFinite(newPrice) || newPrice <= 0) {
            window.alert('Enter a valid resale price greater than RM0.00.');
            return;
        }
        if (maximumPrice > 0 && newPrice > maximumPrice) {
            window.alert(`The maximum permitted resale price is RM${maximumPrice.toFixed(2)}.`);
            return;
        }

        try {
            await window.tsResale.updatePrice(id, newPrice);
            await loadData();
        } catch (err) {
            console.error('Reprice error:', err);
            window.alert(err?.message || 'The resale price could not be updated.');
        }
    };
    
    const render = (filter) => {
        const statusByFilter = {
            active: 'ACTIVE',
            sold: 'SOLD',
            cancelled: 'CANCELLED',
            suspended: 'SUSPENDED'
        };
        const filtered = listings.filter(l => (l.status || '').toUpperCase() === statusByFilter[filter]);
        
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center secondary" style="padding:40px">No listings found.</td></tr>';
            return;
        }
        
        tbody.innerHTML = filtered.map(l => {
            const ticketName = l.ticketId || l.id;
            const listingStatus = String(l.status || '').toUpperCase();
            const status = {
                ACTIVE: ['success', 'Active'],
                SOLD: ['info', 'Sold'],
                CANCELLED: ['neutral', 'Cancelled'],
                SUSPENDED: ['error', 'Suspended']
            }[listingStatus] || ['neutral', listingStatus || 'Unknown'];
            const listingId = encodeURIComponent(l.id);
            
            const actionHtml = listingStatus === 'ACTIVE' ? `
                <div class="ts-table-actions">
                    <button class="ts-btn ts-btn-secondary ts-btn-sm btn-reprice" type="button" data-id="${listingId}">Edit price</button>
                    <button class="ts-btn ts-btn-danger ts-btn-sm btn-cancel" type="button" data-id="${listingId}">Cancel</button>
                </div>
            ` : '';
            
            return `
            <tr>
                <td class="cell-title">${esc(ticketName)}<div class="cell-sub">${esc(l.categoryName || 'Unassigned')} · Section ${esc(l.sectionId || '—')} · Seat ${esc(l.seatId || '—')}</div></td>
                <td>${esc(l.eventName || 'Untitled event')}</td>
                <td>${currency(l.originalPrice)}</td>
                <td>${currency(l.resalePrice)}${amount(l.maxAllowedPrice) > 0 ? `<div class="cell-sub">Max ${currency(l.maxAllowedPrice)}</div>` : ''}</td>
                <td>${esc(formatDate(l.createdAt))}</td>
                <td><span class="ts-chip ts-chip-${status[0]}">${esc(status[1])}</span></td>
                <td>${actionHtml}</td>
            </tr>
            `;
        }).join('');
        
        tbody.querySelectorAll('.btn-cancel').forEach(btn => {
            btn.addEventListener('click', event => cancelListing(decodeURIComponent(event.currentTarget.dataset.id || '')));
        });
        tbody.querySelectorAll('.btn-reprice').forEach(btn => {
            btn.addEventListener('click', event => repriceListing(decodeURIComponent(event.currentTarget.dataset.id || '')));
        });
    };
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeFilter = tab.getAttribute('data-filter') || 'active';
            render(activeFilter);
        });
    });
    
    loadData();
});
</script>

<?php
$content = ob_get_clean();
render_public_page('My Resale Listings', 'resale', $content, '..', true);
?>
