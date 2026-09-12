<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight"><div class="ts-container">
  <div class="ts-section-title-row"><div><div class="ts-section-eyebrow">Discover</div><h1 class="ts-section-title">Events</h1><p class="ts-section-copy">Browse approved and published events available on TickSecure.</p></div></div>
  <div class="ts-card mb-24"><div class="ts-filter-bar"><div class="ts-input-wrap ts-search"><?=ts_icon('search')?><input id="event-search" class="ts-input" placeholder="Search event or venue"></div></div></div>
  <div class="ts-event-grid" id="events-grid">
    <?php if (false): ?>
    <?php $events=[['Aurora After Dark','18 Oct 2026 · 8:00 PM','Merdeka Hall · Kuala Lumpur','RM288','Available',''],['Velvet Hour Live','02 Nov 2026 · 7:30 PM','Axiata Arena · Bukit Jalil','RM198','Limited','light'],['Midnight Resonance','21 Nov 2026 · 8:30 PM','Zepp KL · Kuala Lumpur','RM238','Available','stone'],['The Ivory Sessions','06 Dec 2026 · 8:00 PM','Plenary Hall · KLCC','RM328','Available','light'],['Nocturne City','12 Dec 2026 · 9:00 PM','Merdeka Hall · Kuala Lumpur','RM268','Limited','wine'],['Silverline Orchestra','19 Dec 2026 · 7:00 PM','Axiata Arena · Bukit Jalil','RM188','Available','stone']]; foreach($events as $e): ?>
      <a class="ts-event-card" href="event-detail.php"><div class="ts-event-art <?=$e[5]?>"><strong><?=$e[0]?></strong></div><div class="ts-event-body"><div class="ts-event-date"><?=$e[1]?></div><div class="ts-event-name"><?=$e[0]?></div><div class="ts-event-meta"><?=$e[2]?></div><div class="ts-event-foot"><span class="ts-price">From <?=$e[3]?></span><?=ts_status($e[4],$e[4]==='Limited'?'warning':'success')?></div></div></a>
    <?php endforeach; ?>
    <?php endif; ?>
    <div class="text-center secondary" style="grid-column: 1/-1; padding:40px">Loading published events...</div>
  </div>
  <div class="ts-pagination mt-24"><span>Loading published events...</span></div>
</div></main>

<script type="module">
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
window.addEventListener('ts-auth-ready', async () => {
    const grid = document.getElementById('events-grid');
    const searchInput = document.getElementById('event-search');
    let allEvents = [];

    const renderEvents = (events) => {
        if (!grid) return;
        if (events.length === 0) {
            grid.innerHTML = '<div class="text-center secondary" style="grid-column: 1/-1; padding:40px">No events found.</div>';
            return;
        }
        grid.innerHTML = events.map(e => {
            const eventDate = e.date ? new Date(`${e.date}T${e.time || '00:00'}`) : null;
            const date = eventDate && !Number.isNaN(eventDate.valueOf())
                ? eventDate.toLocaleDateString()
                : (e.date || 'Date TBA');
            const hasConfiguredAllocation = Object.values(e.categories || {})
                .some(category => Number(category.quantity) > 0);
            const status = hasConfiguredAllocation ? 'Tickets configured' : 'Ticket setup pending';
            const tone = hasConfiguredAllocation ? 'success' : 'neutral';
            const priceStr = e.startingPrice ? `From ${e.startingPrice}` : 'TBA';
            return `
            <a class="ts-event-card" href="event-detail.php?id=${esc(e.id)}">
                <div class="ts-event-art"><strong>${esc(e.name)}</strong></div>
                <div class="ts-event-body">
                    <div class="ts-event-date">${esc(date)}</div>
                    <div class="ts-event-name">${esc(e.name)}</div>
                    <div class="ts-event-meta">${esc(e.venueName)}</div>
                    <div class="ts-event-foot">
                        <span class="ts-price">${esc(priceStr)}</span>
                        <span class="ts-chip ts-chip-${tone}">${status}</span>
                    </div>
                </div>
            </a>`;
        }).join('');
    };

    try {
        grid.innerHTML = '<div class="text-center secondary" style="grid-column: 1/-1; padding:40px">Loading events...</div>';
        allEvents = await window.tsEvents.getPublishedEvents();
        renderEvents(allEvents);
        const pagination = document.querySelector('.ts-pagination');
        if (pagination) {
            pagination.innerHTML = `<span>${allEvents.length} published event${allEvents.length === 1 ? '' : 's'}</span>`;
        }
    } catch (err) {
        console.error('Load error:', err);
        grid.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding:40px; color:var(--ts-danger);">Failed to load events.</div>';
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtered = allEvents.filter(ev => 
                (ev.name && ev.name.toLowerCase().includes(q)) || 
                (ev.venueName && ev.venueName.toLowerCase().includes(q))
            );
            renderEvents(filtered);
        });
    }
});
</script>

<?php
$content=ob_get_clean();
render_public_page('Events','events',$content,'..',false);
?>
