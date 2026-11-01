<?php
require_once __DIR__ . '/shared/ui.php';
ob_start();
?>
<link rel="stylesheet" href="<?=ts_asset_url('assets/css/home.css')?>">
<main class="ts-home">
  <section class="home-hero" aria-labelledby="home-title">
    <div class="ts-container home-hero-grid">
      <div class="home-intro">
        <p class="home-eyebrow"><span></span> Live more. Worry less.</p>
        <h1 id="home-title">Great moments.<br><em>Yours to keep.</em></h1>
        <p class="home-lead">Be there for the music, the energy, the unforgettable. Discover live events with secure tickets that are truly yours.</p>
        <div class="home-actions">
          <a class="ts-btn ts-btn-primary" href="public/events.php">Explore events <?=ts_icon('arrow-right')?></a>
          <a class="home-account-link" href="auth/register.php" data-home-guest hidden>Create account <span aria-hidden="true">↗</span></a>
        </div>
        <div class="home-intro-note"><?=ts_icon('shield')?><span>Verified ownership. A little more peace of mind.</span></div>
      </div>
      <div class="home-showcase" role="region" aria-roledescription="carousel" aria-label="Discover live experiences">
        <div class="home-slides" id="home-slides" aria-live="off">
          <?php
          $slides = [
            ['gold', 'Live music', 'Feel every note.', 'Some moments deserve more than a playlist.'],
            ['rose', 'Live performances', 'Closer to the magic.', 'Take your seat. Let the world become a stage.'],
            ['blue', 'Shared experiences', 'Make it a memory.', 'The best part? Being there together.']
          ];
          foreach ($slides as $index => [$tone, $label, $headline, $copy]): ?>
          <div class="home-slide home-slide-<?=$tone?> <?=$index === 0 ? 'is-active' : ''?>" role="group" aria-roledescription="slide" aria-label="<?=$index + 1?> of 3" aria-hidden="<?=$index === 0 ? 'false' : 'true'?>">
            <img class="home-scene" src="<?=ts_asset_url('assets/images/live-stage.svg')?>" alt="" width="1200" height="1100" decoding="async" fetchpriority="<?=$index === 0 ? 'high' : 'low'?>">
            <div class="home-slide-top"><span>THE LIVE EXPERIENCE</span><span class="home-live-mark"><i></i> Be part of it</span></div>
            <div class="home-slide-copy"><p><?=$label?></p><h2><?=$headline?></h2><span><?=$copy?></span></div>
          </div>
          <?php endforeach; ?>
        </div>
        <div class="home-showcase-bottom">
          <div class="home-slide-dots" aria-label="Choose a slide">
            <?php foreach ($slides as $index => $slide): ?>
            <button type="button" data-home-slide="<?=$index?>" aria-label="Show slide <?=$index + 1?>: <?=$slide[1]?>" aria-pressed="<?=$index === 0 ? 'true' : 'false'?>"><span></span></button>
            <?php endforeach; ?>
          </div>
          <div class="home-slide-controls">
            <button type="button" id="home-slide-pause" aria-label="Pause slideshow" aria-pressed="false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg></button>
            <button type="button" id="home-slide-next" aria-label="Next slide"><?=ts_icon('arrow-right')?></button>
          </div>
        </div>
        <div class="home-ticket-seal" aria-hidden="true"><div class="home-seal-icon"><?=ts_icon('ticket')?></div><div><span>A better way in</span><strong>Your ticket. Your moment.</strong></div><?=ts_icon('shield')?></div>
      </div>
    </div>
  </section>
  <div class="ts-container home-promises" aria-label="Ticket benefits">
    <span><?=ts_icon('shield')?> Verified ticket ownership</span><i aria-hidden="true"></i>
    <span><?=ts_icon('ticket')?> Fair, controlled resale</span><i aria-hidden="true"></i>
    <span><?=ts_icon('scanner')?> Secure, single-use entry</span>
  </div>
  <section class="home-events ts-container" aria-labelledby="home-events-title">
    <div class="home-section-heading"><div><p class="home-eyebrow">Find your next moment</p><h2 id="home-events-title">Upcoming experiences<span>.</span></h2></div><a class="home-text-link" href="public/events.php">View all events <?=ts_icon('arrow-right')?></a></div>
    <div class="home-event-grid" id="featured-events-grid" aria-busy="true" aria-live="polite"><p class="home-events-message" role="status">Finding your next experience…</p></div>
  </section>
  <section class="home-how ts-container" aria-labelledby="home-how-title">
    <div class="home-section-heading"><div><p class="home-eyebrow">Less effort. More experience.</p><h2 id="home-how-title">From discovery to the door.</h2></div><p class="home-section-note">Everything you need for a great day out,<br>all in one place.</p></div>
    <div class="home-steps">
      <article><span class="home-step-number">01</span><div><?=ts_icon('search')?><h3>Find your experience</h3><p>Explore events and choose the ticket that feels right for you.</p></div></article>
      <article><span class="home-step-number">02</span><div><?=ts_icon('wallet')?><h3>Make it yours</h3><p>Book your place and keep your ticket and ownership details together.</p></div></article>
      <article><span class="home-step-number">03</span><div><?=ts_icon('scanner')?><h3>Be in the moment</h3><p>Open your ticket, present your entry QR, and enjoy being there.</p></div></article>
    </div>
  </section>
  <footer class="home-footer ts-container"><a href="index.php" aria-label="TickSecure home">TickSecure<span>◇</span></a><p>Good experiences. Confidently yours.</p><a href="public/events.php" class="home-text-link">Find an experience <?=ts_icon('arrow-right')?></a></footer>
</main>
<script type="module" src="<?=ts_asset_url('assets/js/home-page.js')?>"></script>
<?php
$content = ob_get_clean();
render_public_page('Home', 'events', $content, '.', false);
?>
