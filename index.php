<?php
require_once __DIR__ . '/shared/ui.php';
ob_start();
?>

<main>
  <section class="ts-hero"><div class="ts-container ts-hero-grid">
    <div>
      <div class="ts-hero-eyebrow"><?=ts_icon('shield')?> Verified ticket ownership</div>
      <h1 class="ts-hero-title">A fairer way to experience live events.</h1>
      <p class="ts-hero-copy">Discover premium events, receive automatically assigned seats, and manage secure digital tickets with controlled resale and traceable ownership.</p>
      <div class="ts-hero-actions"><a class="ts-btn ts-btn-primary ts-btn-lg" href="public/events.php">Browse events <?=ts_icon('arrow-right')?></a><a class="ts-btn ts-btn-secondary ts-btn-lg" href="auth/register.php">Create account</a></div>
      <div class="ts-hero-meta"><span class="ts-hero-meta-item"><?=ts_icon('shield')?> Verified ownership</span><span class="ts-hero-meta-item"><?=ts_icon('ticket')?> Controlled resale</span><span class="ts-hero-meta-item"><?=ts_icon('scanner')?> Single-use entry</span></div>
    </div>
    <div class="ts-hero-art"><div class="ts-hero-art-label"><div class="ts-hero-art-kicker">Secure ticketing</div><div class="ts-hero-art-name">Verified<br>live experiences</div><div class="ts-hero-art-date">Discover published events below</div></div></div>
  </div></section>
  <section class="ts-section-tight"><div class="ts-container">
    <div class="ts-section-title-row"><div><div class="ts-section-eyebrow">Featured</div><h2 class="ts-section-title">Upcoming experiences</h2><p class="ts-section-copy">Curated events with verified ownership and transparent ticket rules.</p></div><a href="public/events.php" class="ts-btn ts-btn-secondary">View all events</a></div>
    <div class="ts-event-grid" id="featured-events-grid"><div class="text-center secondary" style="grid-column:1/-1; padding:32px">Loading featured events...</div></div>
  </div></section>
  <section class="ts-section"><div class="ts-container"><div class="ts-trust-strip">
    <div class="ts-trust-item"><div class="ts-trust-icon"><?=ts_icon('shield')?></div><div><div class="ts-trust-title">Verified ownership</div><div class="ts-trust-copy">Every issued ticket has traceable ownership.</div></div></div>
    <div class="ts-trust-item"><div class="ts-trust-icon"><?=ts_icon('ticket')?></div><div><div class="ts-trust-title">Controlled resale</div><div class="ts-trust-copy">Organizer rules keep resale within fair limits.</div></div></div>
    <div class="ts-trust-item"><div class="ts-trust-icon"><?=ts_icon('lock')?></div><div><div class="ts-trust-title">Secure transactions</div><div class="ts-trust-copy">Wallet approval protects ownership changes.</div></div></div>
    <div class="ts-trust-item"><div class="ts-trust-icon"><?=ts_icon('scanner')?></div><div><div class="ts-trust-title">Single-use entry</div><div class="ts-trust-copy">QR validation blocks repeated ticket use.</div></div></div>
  </div></div></section>
</main>

<script type="module">
const featuredGrid = document.getElementById('featured-events-grid');
const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

let featuredLoaded = false;
async function loadFeaturedEvents() {
    if (featuredLoaded || !featuredGrid || !window.tsEvents) return;
    featuredLoaded = true;
    featuredGrid.innerHTML = '<div class="text-center secondary" style="grid-column:1/-1; padding:32px">Loading featured events...</div>';
    try {
        const events = await window.tsEvents.getPublishedEvents();
        const featured = events.slice(0, 3);
        if (!featured.length) {
            featuredGrid.innerHTML = '<div class="text-center secondary" style="grid-column:1/-1; padding:32px">No published events yet.</div>';
            return;
        }
        featuredGrid.innerHTML = featured.map(event => {
            const date = event.date
                ? new Date(`${event.date}T${event.time || '00:00'}`).toLocaleDateString()
                : 'Date TBA';
            const price = event.startingPrice ? `From ${event.startingPrice}` : 'Price TBA';
            return `<a class="ts-event-card" href="public/event-detail.php?id=${encodeURIComponent(event.id)}">
                <div class="ts-event-art"><strong>${esc(event.name)}</strong></div>
                <div class="ts-event-body">
                    <div class="ts-event-date">${esc(date)}</div>
                    <div class="ts-event-name">${esc(event.name)}</div>
                    <div class="ts-event-meta">${esc(event.venueName || 'Venue TBA')}</div>
                    <div class="ts-event-foot"><span class="ts-price">${esc(price)}</span><span class="ts-chip ts-chip-info">View tickets</span></div>
                </div>
            </a>`;
        }).join('');
    } catch (error) {
        console.error('Unable to load featured events:', error);
        featuredGrid.innerHTML = '<div class="text-center secondary" style="grid-column:1/-1; padding:32px">Featured events could not be loaded. Browse all events to try again.</div>';
    }
}

window.addEventListener('ts-auth-ready', loadFeaturedEvents);
if (window.tsCurrentUser !== undefined) loadFeaturedEvents();
</script>

<?php
$content=ob_get_clean();
render_public_page('Home','events',$content,'.',false);
?>
