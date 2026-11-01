<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<link rel="stylesheet" href="<?=ts_asset_url('assets/css/resale-page.css', '..')?>">
<main class="ts-resale-page"><div class="ts-container">
  <header class="resale-intro">
    <div class="resale-intro-copy">
      <p class="resale-eyebrow">Official secondary market</p>
      <h1>Great moments.<br><em>Second chances.</em></h1>
      <p class="resale-lead">Buy tickets from verified current owners within organizer-defined resale rules.</p>
      <div class="resale-benefits"><span><?=ts_icon('shield')?> Verified ownership</span><span><?=ts_icon('ticket')?> Controlled resale</span></div>
    </div>
    <div class="resale-illustration" aria-hidden="true">
      <div class="resale-orbit resale-orbit-one"></div><div class="resale-orbit resale-orbit-two"></div>
      <div class="resale-paper-ticket">
        <div class="resale-ticket-top"><span>TICKSECURE</span><?=ts_icon('ticket')?></div>
        <div class="resale-ticket-title">A new plan.<br><em>Your moment.</em></div>
        <div class="resale-ticket-bottom"><span><?=ts_icon('shield')?> Verified ownership</span><div class="resale-ticket-bars"></div></div>
      </div>
      <div class="resale-verified-seal"><?=ts_icon('shield')?><span>Another way<br><strong>to be there.</strong></span></div>
    </div>
  </header>
  <nav class="resale-account-links" aria-label="Your resale activity"><span>Your resale space</span><div><a href="../buyer/resale.php"><?=ts_icon('ticket')?> My listings <?=ts_icon('arrow-right')?></a><a href="../buyer/resale-purchases.php"><?=ts_icon('wallet')?> My resale purchases <?=ts_icon('arrow-right')?></a></div></nav>
  <section class="resale-market" aria-labelledby="resale-results-heading">
    <div class="resale-results-heading"><div><p class="resale-eyebrow">Find your way in</p><h2 id="resale-results-heading">Verified resale tickets<span>.</span></h2></div><span class="resale-market-note"><?=ts_icon('shield')?> Organizer rules apply</span></div>
    <div class="resale-filters" role="search" aria-label="Find resale tickets">
      <div class="resale-filter resale-filter-search"><label for="resale-search">Search tickets</label><div class="ts-input-wrap"><?=ts_icon('search')?><input class="ts-input" id="resale-search" type="search" placeholder="Event or ticket category"></div></div>
      <div class="resale-filter"><label for="resale-event-filter">Event</label><select class="ts-select" id="resale-event-filter"><option value="">All events</option></select></div>
      <div class="resale-filter"><label for="resale-category-filter">Category</label><select class="ts-select" id="resale-category-filter"><option value="">All categories</option></select></div>
      <div class="resale-filter"><label for="resale-price-sort">Sort by</label><select class="ts-select" id="resale-price-sort"><option value="">Newest first</option><option value="asc">Lowest price</option><option value="desc">Highest price</option></select></div>
    </div>
    <div class="ts-grid-3" id="resale-grid">
      <div class="text-center secondary" style="grid-column:1/-1; padding:40px;">Loading listings...</div>
    </div>
  </section>
  <footer class="resale-signoff"><span>TickSecure</span><p>Good experiences deserve another chance.</p></footer>
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
