<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight"><div class="ts-container">
  <div class="ts-section-title-row"><div><div class="ts-section-eyebrow">Official secondary market</div><h1 class="ts-section-title">Verified resale tickets</h1><p class="ts-section-copy">Buy tickets from verified current owners within organizer-defined resale rules.</p></div></div>
  <div class="ts-card mb-24"><div class="ts-filter-bar"><div class="ts-input-wrap ts-search"><?=ts_icon('search')?><input class="ts-input" id="resale-search" placeholder="Search event or ticket category"></div><select class="ts-select" id="resale-event-filter"><option value="">All events</option></select><select class="ts-select" id="resale-category-filter"><option value="">All categories</option></select><select class="ts-select" id="resale-price-sort"><option value="">Newest first</option><option value="asc">Lowest price</option><option value="desc">Highest price</option></select></div></div>
  <div class="ts-grid-3" id="resale-grid">
    <div class="text-center secondary" style="grid-column:1/-1; padding:40px;">Loading listings...</div>
  </div>
  <div class="flex gap-12 mt-24"><a class="ts-btn ts-btn-secondary" href="../buyer/resale.php">My listings</a><a class="ts-btn ts-btn-secondary" href="../buyer/resale-purchases.php">My resale purchases</a></div>
</div></main>

<script type="module">
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
window.addEventListener('ts-auth-ready', async () => {
    const grid = document.getElementById('resale-grid');
    try {
        const listings = await window.tsResale.getActiveListings();
        const records = await Promise.all(listings.map(async r => {
            let eventName = r.eventInfo?.name || r.eventName || r.eventId || 'Untitled event';
            if (!r.eventInfo?.name && r.eventId) {
                try {
                    const event = await window.tsEvents.getEvent(r.eventId);
                    if (event?.name) eventName = event.name;
                } catch (_) { /* Listing snapshot remains available. */ }
            }
            return { ...r, displayEventName: eventName };
        }));
        const search = document.getElementById('resale-search');
        const eventFilter = document.getElementById('resale-event-filter');
        const categoryFilter = document.getElementById('resale-category-filter');
        const priceSort = document.getElementById('resale-price-sort');
        const events = new Map(records.filter(r => r.eventId).map(r => [r.eventId, r.displayEventName]));
        eventFilter.innerHTML = '<option value="">All events</option>' +
            [...events].map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('');
        const categories = [...new Set(records.map(r => r.categoryName).filter(Boolean))].sort();
        categoryFilter.innerHTML = '<option value="">All categories</option>' +
            categories.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
        const render = () => {
            const term = search.value.trim().toLowerCase();
            const visible = records.filter(r =>
                (!eventFilter.value || r.eventId === eventFilter.value) &&
                (!categoryFilter.value || r.categoryName === categoryFilter.value) &&
                (!term || `${r.displayEventName} ${r.categoryName || ''}`.toLowerCase().includes(term))
            );
            if (priceSort.value) visible.sort((a, b) =>
                priceSort.value === 'asc'
                    ? Number(a.resalePrice) - Number(b.resalePrice)
                    : Number(b.resalePrice) - Number(a.resalePrice)
            );
            let html = '';
            for (const r of visible) {
            const eventName = r.displayEventName;
            const seller = String(r.sellerWallet || r.sellerUid || '');
            const sellerAbbr = seller ? (seller.substring(0, 6) + '...' + seller.substring(Math.max(6, seller.length - 4))) : 'Unknown';
            html += `
            <a class="ts-card ts-card-pad" href="resale-detail.php?id=${encodeURIComponent(String(r.id || ''))}">
                <div class="flex justify-between items-center">
                    <div class="ts-card-title">${esc(eventName)}</div>
                    <span class="ts-chip ts-chip-${r.ruleCompliance === 'VIOLATION' ? 'error' : 'success'}">${r.ruleCompliance === 'VIOLATION' ? 'Under review' : 'Rule compliant'}</span>
                </div>
                <div class="ts-divider"></div>
                <div class="ts-detail-grid">
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Category</div>
                        <div class="ts-detail-value">${esc(r.categoryName || 'Any')}</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Seat</div>
                        <div class="ts-detail-value">${esc(r.seatId || 'Any')}</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Original</div>
                        <div class="ts-detail-value">RM${esc(r.originalPrice || 0)}</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Resale</div>
                        <div class="ts-detail-value">RM${esc(r.resalePrice || 0)}</div>
                    </div>
                </div>
                <div class="small secondary mt-16">Seller ${esc(sellerAbbr)}</div>
            </a>`;
            }
            grid.innerHTML = html || '<div class="text-center secondary" style="grid-column:1/-1; padding:40px;">No resale listings match these filters.</div>';
        };
        [eventFilter, categoryFilter, priceSort].forEach(control => control.addEventListener('change', render));
        search.addEventListener('input', render);
        render();
    } catch (err) {
        console.error(err);
        grid.innerHTML = '<div class="text-center" style="grid-column:1/-1; padding:40px; color:var(--ts-danger);">Failed to load listings.</div>';
    }
});
</script>

<?php
$content=ob_get_clean();
render_public_page('Resale Marketplace','resale',$content,'..',false);
?>
