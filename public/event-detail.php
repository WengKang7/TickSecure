<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main>
  <section class="ts-section-tight">
    <div class="ts-container ts-event-hero-detail">
      <div class="ts-poster">
        <div class="ts-poster-copy">
          <div class="ts-poster-kicker" id="ev-kicker">TickSecure Presents</div>
          <div class="ts-poster-title" id="ev-poster-title">Loading...</div>
        </div>
      </div>
      <div class="ts-event-info">
        <div class="ts-section-eyebrow">Live Concert</div>
        <h1 id="ev-title">Loading...</h1>
         <p class="secondary" id="ev-desc">Loading event details...</p>
        <div class="ts-info-list">
          <div class="ts-info-pill">
            <?=ts_icon('calendar')?>
            <div id="ev-date"><strong>Loading</strong><span>...</span></div>
          </div>
          <div class="ts-info-pill">
            <?=ts_icon('map-pin')?>
            <div id="ev-venue"><strong>Loading</strong><span>...</span></div>
          </div>
          <div class="ts-info-pill">
            <?=ts_icon('building')?>
            <div id="ev-org"><strong>Loading</strong><span>Approved organizer</span></div>
          </div>
          <div class="ts-info-pill">
            <?=ts_icon('ticket')?>
             <div id="ev-price"><strong>Loading</strong><span>Availability checked at booking</span></div>
          </div>
        </div>
        <div class="flex gap-12 wrap">
            <a class="ts-btn ts-btn-primary ts-btn-lg" id="book-btn" href="#">Book Tickets</a>
            <button class="ts-btn ts-btn-secondary ts-btn-lg" data-toast="Event saved to your favourites">Save Event</button>
        </div>
      </div>
    </div>
  </section>
  <section class="ts-section-tight">
    <div class="ts-container" data-tabs>
      <div class="ts-tabs"><button class="ts-tab active" data-tab="overview">Overview</button><button class="ts-tab"
          data-tab="venue">Venue</button><button class="ts-tab" data-tab="tickets">Ticket Categories</button><button
          class="ts-tab" data-tab="policies">Policies</button></div>
      <div class="ts-tab-panel active" data-panel="overview">
        <div class="ts-grid-2">
          <div>
            <h3>About the event</h3>
            <p class="secondary" id="ev-about">A premium evening production...</p>
          </div>
          <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Ticketing at a glance</div>
            <div class="ts-list">
              <div class="ts-list-item"><span>Automatic seat assignment</span><?=ts_status('Enabled', 'success')?></div>
              <div class="ts-list-item"><span>Ticket transfer</span><span id="ev-transfer"><?=ts_status('Allowed', 'info')?></span></div>
              <div class="ts-list-item"><span>Official resale</span><span id="ev-resale"><?=ts_status('Allowed', 'info')?></span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="ts-tab-panel" data-panel="venue">
        <div class="ts-card ts-card-pad">
            <div class="flex justify-between items-center">
                <div>
                     <h3 class="mt-0 mb-4" id="ven-name">Venue TBA</h3>
                     <p class="secondary" id="ven-address">Venue details will appear when available.</p>
                </div>
                 <span class="ts-chip ts-chip-neutral" id="ven-status">Event venue</span>
            </div>
            <div class="ts-venue-layout-shell mt-24">
                <div class="ts-venue-layout-board" id="ven-board">
                    <div class="ts-venue-layout-stage">STAGE</div>
                </div>
                <div class="ts-venue-layout-panel">
                    <h3>Category Layout</h3>
                    <p class="small muted">Select a category based on its position. TickSecure will automatically assign the next available seat.</p>
                    <div id="ven-panel"></div>
                </div>
            </div>
            <div class="ts-note mt-20">
                <?= ts_icon('info') ?>
                <div>
                    <strong>Automatic seat assignment</strong>
                    <div class="small mt-6">Buyers select only the ticket category and quantity. TickSecure assigns the next available seat within the selected section.</div>
                </div>
            </div>
        </div>
      </div>
      <div class="ts-tab-panel" data-panel="tickets">
        <div class="ts-category-list" id="cat-list">
          <div class="ts-category-card">Loading categories...</div>
        </div>
      </div>
      <div class="ts-tab-panel" data-panel="policies">
        <div class="ts-grid-2">
          <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Transfer policy</div>
             <p class="secondary" id="transfer-policy">Loading transfer policy...</p>
          </div>
          <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Resale policy</div>
             <p class="secondary" id="resale-policy">Loading resale policy...</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</main>

<script type="module">
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
window.addEventListener('ts-auth-ready', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    
    if (!eventId) {
        document.getElementById('ev-title').textContent = 'Event not found';
        return;
    }

    try {
        const ev = await window.tsEvents.getEvent(eventId);
        if (!ev) throw new Error('Event not found');
        
        document.getElementById('ev-poster-title').innerHTML = esc(ev.name);
        document.getElementById('ev-title').textContent = ev.name;
        document.getElementById('ev-desc').textContent = ev.description || 'Event details are being provided by the organizer.';
        document.getElementById('ev-about').textContent = ev.description || 'Event details are being provided by the organizer.';
        document.getElementById('ev-kicker').textContent = ev.organizerName || 'TickSecure Presents';
        
        const d = ev.date ? new Date(`${ev.date}T${ev.time || '00:00'}`) : null;
        if(d) {
            document.getElementById('ev-date').innerHTML = `<strong>${esc(d.toLocaleDateString())}</strong><span>${esc(d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}))}</span>`;
        }
        
        document.getElementById('ev-venue').innerHTML = `<strong>${esc(ev.venueName || 'TBA')}</strong><span>${esc(ev.venueLocation || '')}</span>`;
        document.getElementById('ev-org').innerHTML = `<strong>${esc(ev.organizerName || 'TBA')}</strong><span>Approved organizer</span>`;
        
        const priceStr = ev.startingPrice ? `From ${ev.startingPrice}` : 'TBA';
        document.getElementById('ev-price').innerHTML = `<strong>${esc(priceStr)}</strong><span>Availability confirmed during booking</span>`;
        
        document.getElementById('book-btn').href = `../buyer/booking-category.php?eventId=${encodeURIComponent(eventId)}`;
        
        const transferEnabled = ev.transferEnabled !== false;
        const resaleEnabled = ev.resaleEnabled !== false;
        document.getElementById('ev-transfer').innerHTML = transferEnabled
            ? '<span class="ts-chip ts-chip-info">Allowed</span>'
            : '<span class="ts-chip ts-chip-neutral">Not allowed</span>';
        document.getElementById('ev-resale').innerHTML = resaleEnabled
            ? '<span class="ts-chip ts-chip-info">Allowed</span>'
            : '<span class="ts-chip ts-chip-neutral">Not allowed</span>';
        document.getElementById('transfer-policy').textContent = transferEnabled
            ? 'Eligible tickets may be transferred through TickSecure. A valid wallet address is required.'
            : 'Ticket transfer is not enabled for this event.';
        document.getElementById('resale-policy').textContent = resaleEnabled
            ? 'Official resale is subject to the organizer\'s configured timing and price limits.'
            : 'Official resale is not enabled for this event.';

        // Render tickets categories
        const catList = document.getElementById('cat-list');
        if (ev.categories && Object.keys(ev.categories).length > 0) {
            catList.innerHTML = Object.entries(ev.categories).map(([k, c]) => {
                const allocation = Number(c.quantity) || 0;
                const stat = allocation > 0 ? 'Configured' : 'Not configured';
                const tone = allocation > 0 ? 'info' : 'neutral';
                return `
                <div class="ts-category-card">
                    <div>
                        <div class="ts-category-name">${esc(c.name)}</div>
                        <div class="ts-category-meta">Section ${esc(k)} · ${allocation} allocated · availability confirmed during booking</div>
                    </div>
                    <div class="ts-category-price">
                        RM${esc(c.price)}<br><span class="ts-chip ts-chip-${tone}">${stat}</span>
                    </div>
                </div>`;
            }).join('');
        } else {
            catList.innerHTML = '<div class="ts-category-card">No categories found.</div>';
        }

        const venueTabName = ev.venueName || 'Venue TBA';
        const venueTabLocation = ev.venueLocation || '';
        document.getElementById('ven-name').textContent = venueTabName;
        document.getElementById('ven-address').textContent = venueTabLocation || 'Detailed venue layout is unavailable for this event.';

        if (ev.venueId) {
            // Event snapshots remain available even when a public visitor
            // cannot read the detailed venue layout.
            try {
            const ven = await window.tsVenues.getVenue(ev.venueId);
            if (ven) {
                document.getElementById('ven-name').textContent = ven.name;
                document.getElementById('ven-address').textContent = `${ven.address || ''} · Capacity ${ven.capacity || 0}`;
                document.getElementById('ven-status').className = 'ts-chip ts-chip-success';
                document.getElementById('ven-status').textContent = 'Approved venue layout';
                // Render venue layout roughly (optional, using category info)
                if (Array.isArray(ven.sections)) {
                    const board = document.getElementById('ven-board');
                    const panel = document.getElementById('ven-panel');
                    let boardHtml = '<div class="ts-venue-layout-stage">STAGE</div>';
                    let panelHtml = '';
                    ven.sections.forEach((s, i) => {
                        const secId = s.sectionId;
                        const evCat = (ev.categories || {})[secId] || { price: '?' };
                        boardHtml += `
                        <div class="ts-venue-zone" style="left:${10 + (i*20)}%; top:150px; width:18%; height:145px;">
                            <div class="ts-venue-zone-content">
                                <div class="ts-venue-zone-title">${esc(s.name)}</div>
                                <div class="ts-venue-zone-sub">Section ${esc(secId)}</div>
                                <div class="ts-venue-zone-sub">RM${esc(evCat.price)}</div>
                            </div>
                        </div>`;
                        panelHtml += `
                        <div class="ts-section-card">
                            <div class="ts-section-card-title">${esc(s.name)}</div>
                            <div class="small muted">Section ${esc(secId)} · RM${esc(evCat.price)}</div>
                        </div>`;
                    });
                    board.innerHTML = boardHtml;
                    panel.innerHTML = panelHtml;
                }
            }
            } catch (venueError) {
                console.info('Venue layout is unavailable to this visitor.', venueError);
            }
        }

    } catch (err) {
        console.error(err);
        document.getElementById('ev-title').textContent = 'Error loading event';
    }
});
</script>

<?php
$content = ob_get_clean();
render_public_page('Event Details', 'events', $content, '..', false);
?>
