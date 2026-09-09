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
window.addEventListener('ts-auth-ready', async () => {
    let listings = [];
    const tbody = document.getElementById('resale-tbody');
    const tabs = document.querySelectorAll('#resale-tabs .ts-tab');
    
    const loadData = async () => {
        try {
            listings = await window.tsResale.getUserListings();
            render('active');
        } catch (err) {
            console.error('Load error:', err);
        }
    };
    
    const cancelListing = async (id) => {
        if (!confirm('Are you sure you want to cancel this listing?')) return;
        try {
            await window.tsResale.cancelListing(id);
            await loadData();
        } catch (err) {
            alert('Cancel Error: ' + err.message);
        }
    };
    
    const render = (filter) => {
        const filtered = listings.filter(l => l.status === filter);
        
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center secondary" style="padding:40px">No listings found.</td></tr>';
            return;
        }
        
        tbody.innerHTML = filtered.map(l => {
            const ticketName = l.ticketId;
            let tone = 'success';
            let status = 'Active';
            if (l.status === 'sold') { tone = 'info'; status = 'Sold'; }
            else if (l.status === 'cancelled') { tone = 'neutral'; status = 'Cancelled'; }
            else if (l.status === 'suspended') { tone = 'error'; status = 'Suspended'; }
            
            const actionHtml = l.status === 'active' ? \`
                <div class="ts-table-actions">
                    <button class="ts-btn ts-btn-danger ts-btn-sm btn-cancel" data-id="\${l.id}">Cancel</button>
                </div>
            \` : '';
            
            return \`
            <tr>
                <td class="cell-title">\${ticketName}<div class="cell-sub">\${l.category || '-'} · \${l.seat || '-'}</div></td>
                <td>\${l.eventName || '-'}</td>
                <td>RM\${l.originalPrice || 0}</td>
                <td>RM\${l.resalePrice || 0}</td>
                <td>\${l.createdAt ? (typeof l.createdAt.toDate === 'function' ? l.createdAt.toDate().toLocaleDateString() : l.createdAt) : '-'}</td>
                <td><span class="ts-chip ts-chip-\${tone}">\${status}</span></td>
                <td>\${actionHtml}</td>
            </tr>
            \`;
        }).join('');
        
        tbody.querySelectorAll('.btn-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => cancelListing(e.target.getAttribute('data-id')));
        });
    };
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            render(tab.getAttribute('data-filter'));
        });
    });
    
    loadData();
});
</script>

<?php
$content = ob_get_clean();
render_public_page('My Resale Listings', 'resale', $content, '..', true);
?>