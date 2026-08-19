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
    <div class="ts-hero-art"><div class="ts-hero-art-label"><div class="ts-hero-art-kicker">Featured Event</div><div class="ts-hero-art-name">Aurora<br>After Dark</div><div class="ts-hero-art-date">18 October 2026 · Merdeka Hall</div></div></div>
  </div></section>
  <section class="ts-section-tight"><div class="ts-container">
    <div class="ts-section-title-row"><div><div class="ts-section-eyebrow">Featured</div><h2 class="ts-section-title">Upcoming experiences</h2><p class="ts-section-copy">Curated events with verified ownership and transparent ticket rules.</p></div><a href="public/events.php" class="ts-btn ts-btn-secondary">View all events</a></div>
    <div class="ts-event-grid">
      <a class="ts-event-card" href="public/event-detail.php"><div class="ts-event-art"><strong>Aurora After Dark</strong></div><div class="ts-event-body"><div class="ts-event-date">18 Oct 2026 · 8:00 PM</div><div class="ts-event-name">Aurora After Dark</div><div class="ts-event-meta">Merdeka Hall · Kuala Lumpur</div><div class="ts-event-foot"><span class="ts-price">From RM288</span><?=ts_status('Available','success')?></div></div></a>
      <a class="ts-event-card" href="public/event-detail.php"><div class="ts-event-art light"><strong>Velvet Hour</strong></div><div class="ts-event-body"><div class="ts-event-date">02 Nov 2026 · 7:30 PM</div><div class="ts-event-name">Velvet Hour Live</div><div class="ts-event-meta">Axiata Arena · Bukit Jalil</div><div class="ts-event-foot"><span class="ts-price">From RM198</span><?=ts_status('Limited','warning')?></div></div></a>
      <a class="ts-event-card" href="public/event-detail.php"><div class="ts-event-art stone"><strong>Midnight Resonance</strong></div><div class="ts-event-body"><div class="ts-event-date">21 Nov 2026 · 8:30 PM</div><div class="ts-event-name">Midnight Resonance</div><div class="ts-event-meta">Zepp KL · Kuala Lumpur</div><div class="ts-event-foot"><span class="ts-price">From RM238</span><?=ts_status('Available','success')?></div></div></a>
    </div>
  </div></section>
  <section class="ts-section"><div class="ts-container"><div class="ts-trust-strip">
    <div class="ts-trust-item"><div class="ts-trust-icon"><?=ts_icon('shield')?></div><div><div class="ts-trust-title">Verified ownership</div><div class="ts-trust-copy">Every issued ticket has traceable ownership.</div></div></div>
    <div class="ts-trust-item"><div class="ts-trust-icon"><?=ts_icon('ticket')?></div><div><div class="ts-trust-title">Controlled resale</div><div class="ts-trust-copy">Organizer rules keep resale within fair limits.</div></div></div>
    <div class="ts-trust-item"><div class="ts-trust-icon"><?=ts_icon('lock')?></div><div><div class="ts-trust-title">Secure transactions</div><div class="ts-trust-copy">Wallet approval protects ownership changes.</div></div></div>
    <div class="ts-trust-item"><div class="ts-trust-icon"><?=ts_icon('scanner')?></div><div><div class="ts-trust-title">Single-use entry</div><div class="ts-trust-copy">QR validation blocks repeated ticket use.</div></div></div>
  </div></div></section>
</main>

<?php
$content=ob_get_clean();
render_public_page('Home','events',$content,'.',false);
?>
