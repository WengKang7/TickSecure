<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight"><div class="ts-container">
  <div class="ts-section-title-row"><div><div class="ts-section-eyebrow">Official secondary market</div><h1 class="ts-section-title">Verified resale tickets</h1><p class="ts-section-copy">Buy tickets from verified current owners within organizer-defined resale rules.</p></div></div>
  <div class="ts-card mb-24"><div class="ts-filter-bar"><div class="ts-input-wrap ts-search"><?=ts_icon('search')?><input class="ts-input" placeholder="Search event or ticket category"></div><select class="ts-select"><option>Event</option><option>Aurora After Dark</option></select><select class="ts-select"><option>Category</option><option>VIP1</option><option>CAT1</option></select><select class="ts-select"><option>Price</option><option>Lowest first</option></select></div></div>
  <div class="ts-grid-3" id="resale-grid">
    <div class="text-center secondary" style="grid-column:1/-1; padding:40px;">Loading listings...</div>
  </div>
</div></main>

<script type="module">
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
window.addEventListener('ts-auth-ready', async () => {
    const grid = document.getElementById('resale-grid');
    try {
        const listings = await window.tsResale.getActiveListings();
        if (listings.length === 0) {
            grid.innerHTML = '<div class="text-center secondary" style="grid-column:1/-1; padding:40px;">No resale listings available.</div>';
            return;
        }
        
        let html = '';
        for (const r of listings) {
            let eventName = r.eventId;
            // Fetch event name if possible, or assume it's attached
            if (r.eventInfo) {
                eventName = r.eventInfo.name;
            } else {
                try {
                    const ev = await window.tsEvents.getEvent(r.eventId);
                    if(ev) eventName = ev.name;
                } catch(e){}
            }
            
            const sellerAbbr = r.sellerId ? (r.sellerId.substring(0,6) + '...' + r.sellerId.substring(r.sellerId.length-4)) : 'Unknown';
            html += `
            <a class="ts-card ts-card-pad" href="resale-detail.php?id=${esc(r.id)}">
                <div class="flex justify-between items-center">
                    <div class="ts-card-title">${esc(eventName)}</div>
                    <span class="ts-chip ts-chip-success">Rule compliant</span>
                </div>
                <div class="ts-divider"></div>
                <div class="ts-detail-grid">
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Category</div>
                        <div class="ts-detail-value">${esc(r.ticketCategory || 'Any')}</div>
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
                        <div class="ts-detail-value">RM${esc(r.askingPrice || 0)}</div>
                    </div>
                </div>
                <div class="small secondary mt-16">Seller ${esc(sellerAbbr)}</div>
            </a>`;
        }
        grid.innerHTML = html;
    } catch (err) {
        console.error(err);
        grid.innerHTML = '<div class="text-center" style="grid-column:1/-1; padding:40px; color:var(--ts-danger);">Failed to load listings.</div>';
    }
});
</script>

<?php
$content=ob_get_clean();
render_public_page('Resale Marketplace','resale',$content,'..',true);
?>
