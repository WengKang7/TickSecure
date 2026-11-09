<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-resale-page"><div class="ts-container">
  <header class="resale-intro">
    <div class="resale-intro-copy">
      <p class="resale-eyebrow">Official secondary market</p>
      <h1>Your next night.<br><em>Still possible.</em></h1>
      <p class="resale-lead">Plans change. Great nights are still out there. Find a ticket from a verified current owner, with the event and seat details in one place.</p>
      <div class="resale-benefits"><span><?=ts_icon('shield')?> Verified ownership</span><span><?=ts_icon('ticket')?> Controlled resale</span></div>
    </div>
    <aside class="resale-intro-note"><span class="resale-note-icon"><?=ts_icon('ticket')?></span><span class="resale-eyebrow">Another way to be there</span><h2>A new owner.<br>The same moment.</h2><p>Organizer-defined price rules and recorded ticket handovers keep your next experience in reach.</p></aside>
  </header>
  <nav class="resale-account-links" aria-label="Your resale activity"><span>Your resale space</span><div><a href="../buyer/resale.php"><?=ts_icon('ticket')?> My listings <?=ts_icon('arrow-right')?></a><a href="../buyer/resale-purchases.php"><?=ts_icon('wallet')?> My resale purchases <?=ts_icon('arrow-right')?></a></div></nav>
  <section class="resale-market" aria-labelledby="resale-results-heading">
    <div class="resale-results-heading"><div><p class="resale-eyebrow">Find your way in</p><h2 id="resale-results-heading">Explore resale tickets.</h2></div><span class="resale-market-note" id="resale-results-count" role="status">Finding available tickets…</span></div>
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
let resaleViewVersion = 0;
const money = value => 'RM' + Number(value || 0).toLocaleString('en-MY', {minimumFractionDigits:2,maximumFractionDigits:2});
function eventDate(event) {
    const date = event.date ? new Date(`${event.date}T${event.time || '00:00'}+08:00`) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Date to be announced';
    return new Intl.DateTimeFormat('en-MY', {day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kuala_Lumpur',
        ...(event.time ? {hour:'numeric',minute:'2-digit',hour12:true} : {})}).format(date);
}
function posterUrl(value) {
    try { const url = new URL(value || '', window.location.href); return value && ['http:', 'https:'].includes(url.protocol) ? url.href : ''; }
    catch (_) { return ''; }
}
window.addEventListener('ts-auth-ready', async () => {
    const version = ++resaleViewVersion;
    const grid = document.getElementById('resale-grid');
    try {
        const listings = await window.tsResale.getActiveListings();
        const eventRequests = new Map();
        const records = await Promise.all(listings.map(async r => {
            if (r.eventId && !eventRequests.has(r.eventId)) eventRequests.set(r.eventId, window.tsEvents.getEvent(r.eventId).catch(() => null));
            const event = { ...(r.eventInfo || {}), ...(await eventRequests.get(r.eventId) || {}) };
            return { ...r, displayEvent: event, displayEventName: event.name || r.eventName || 'Untitled event' };
        }));
        if (version !== resaleViewVersion) return;
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
            if (version !== resaleViewVersion) return;
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
            const event = r.displayEvent, photo = posterUrl(event.posterUrl);
            const description = String(event.description || '').replace(/\s+/g, ' ').trim();
            const seller = String(r.sellerWallet || r.sellerUid || '');
            const sellerAbbr = seller ? (seller.substring(0, 6) + '...' + seller.substring(Math.max(6, seller.length - 4))) : 'Unknown';
            html += `
            <a class="ts-card resale-event-card" href="resale-detail.php?id=${encodeURIComponent(String(r.id || ''))}">
                <div class="resale-event-art"><div class="resale-event-cover" aria-hidden="true"><span>TICKSECURE / LIVE</span><strong>Good nights.<br>Another chance.</strong><span>${esc(event.eventCategory || 'Live event')}</span></div>
                    ${photo ? `<img class="resale-event-photo" src="${esc(photo)}" alt="" loading="lazy" decoding="async">` : ''}
                    <span class="resale-art-label">RESALE TICKET</span></div>
                <div class="resale-event-body"><div class="resale-card-top"><span>${esc(event.eventCategory || 'Live event')}</span><span class="ts-chip ts-chip-${r.ruleCompliance === 'VIOLATION' ? 'error' : 'success'}">${r.ruleCompliance === 'VIOLATION' ? 'Under review' : 'Rule compliant'}</span></div>
                <h3>${esc(eventName)}</h3><div class="resale-event-meta"><span>${esc(eventDate(event))}</span><span>${esc(event.venueName || 'Venue to be announced')}</span></div>
                ${description ? `<p class="resale-event-description">${esc(description.slice(0, 130))}${description.length > 130 ? '…' : ''}</p>` : ''}
                <dl class="resale-seat-facts"><div><dt>Ticket category</dt><dd>${esc(r.categoryName || 'Not specified')}</dd></div><div><dt>Seat</dt><dd>${esc(r.seatId || 'Not assigned')}</dd></div></dl>
                <div class="resale-card-price"><div><span>Resale price</span><strong>${esc(money(r.resalePrice))}</strong></div><div><span>Original price</span><span>${esc(money(r.originalPrice))}</span></div></div>
                <div class="resale-card-footer"><span>Seller ${esc(sellerAbbr)}</span><strong>View ticket <span aria-hidden="true">↗</span></strong></div></div>
            </a>`;
            }
            grid.innerHTML = html || '<div class="text-center secondary" style="grid-column:1/-1; padding:40px;">No resale listings match these filters.</div>';
            document.getElementById('resale-results-count').textContent = `${visible.length} ticket${visible.length === 1 ? '' : 's'} available · Service charge added at checkout`;
            grid.querySelectorAll('.resale-event-photo').forEach(image => image.addEventListener('error', () => { image.hidden = true; }));
        };
        [eventFilter, categoryFilter, priceSort].forEach(control => control.addEventListener('change', render));
        search.addEventListener('input', render);
        render();
    } catch (err) {
        if (version !== resaleViewVersion) return;
        console.error(err);
        grid.innerHTML = '<div class="text-center" style="grid-column:1/-1; padding:40px; color:var(--ts-danger);">Failed to load listings.</div>';
        document.getElementById('resale-results-count').textContent = 'Listings could not be loaded';
    }
});
</script>

<?php
$content=ob_get_clean();
render_public_page('Resale Marketplace','resale',$content,'..',false);
?>
