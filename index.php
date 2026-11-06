<?php
require_once __DIR__ . '/shared/ui.php';
ob_start();
?>
<main class="ts-home">
  <section class="hero wrap d2-wrap" aria-labelledby="home-title">
    <div class="eyebrow">Independent sounds. Unforgettable nights.</div>
    <div class="hero-heading">
      <h1 id="home-title">Less ordinary.<br><span>More live.</span></h1>
      <div class="hero-aside"><p>Find your people.<br>Feel every beat.<br>Your next great moment starts here.</p><a class="text-btn" href="public/events.php">Find your next event <?=ts_icon('arrow-right')?></a></div>
    </div>
    <div class="hero-visual home-showcase" role="region" aria-roledescription="carousel" aria-label="Discover live experiences">
      <div class="home-slides" id="home-slides" aria-live="off">
        <?php
        $slides = [
          ['Live music', 'Feel every note.', 'Some moments deserve more than a playlist.', 'photo-1492684223066-81342ee5ff30'],
          ['Live performances', 'Closer to the magic.', 'Take your seat. Let the world become a stage.', 'photo-1506157786151-b8491531f063'],
          ['Shared experiences', 'Make it a memory.', 'The best part? Being there together.', 'photo-1470229722913-7c0e2dbbafd3']
        ];
        foreach ($slides as $index => [$label, $headline, $copy, $photo]): ?>
        <div class="home-slide <?=$index === 0 ? 'is-active' : ''?>" role="group" aria-roledescription="slide" aria-label="<?=$index + 1?> of 3" aria-hidden="<?=$index === 0 ? 'false' : 'true'?>">
          <img class="home-scene" src="https://images.unsplash.com/<?=$photo?>?auto=format&amp;fit=crop&amp;w=2200&amp;q=85" alt="" width="2200" height="1100" decoding="async" fetchpriority="<?=$index === 0 ? 'high' : 'low'?>">
          <div class="hero-photo-top"><span>The live edit / 0<?=$index + 1?></span><span>Built for the live experience</span></div>
          <div class="hero-caption"><div><div class="eyebrow"><?=$label?></div><h2><?=$headline?></h2><p><?=$copy?></p></div><a class="btn" href="public/events.php">Discover the festival <?=ts_icon('arrow-right')?></a></div>
        </div>
        <?php endforeach; ?>
      </div>
      <div class="home-carousel-controls">
        <div class="hero-slide-controls" aria-label="Choose a slide">
          <?php foreach ($slides as $index => $slide): ?><button type="button" data-home-slide="<?=$index?>" aria-label="Show slide <?=$index + 1?>: <?=$slide[0]?>" aria-pressed="<?=$index === 0 ? 'true' : 'false'?>"></button><?php endforeach; ?>
        </div>
        <div class="home-playback"><button type="button" id="home-slide-pause" aria-label="Pause slideshow" aria-pressed="false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg></button><button type="button" id="home-slide-next" aria-label="Next slide"><?=ts_icon('arrow-right')?></button></div>
      </div>
    </div>
    <div class="hero-rail" aria-label="Ticket benefits"><span class="trust-item"><?=ts_icon('shield')?> Verified ticket ownership</span><span class="trust-item"><?=ts_icon('ticket')?> Fair &amp; secure resale</span><span class="trust-item"><?=ts_icon('ticket')?> One ticket. Your moment.</span><span class="muted">Built for the live experience ↗</span></div>
  </section>
  <section class="section wrap d2-wrap" aria-labelledby="home-events-title">
    <div class="section-head"><div><div class="eyebrow">Worth being there</div><h2 id="home-events-title">The next ones to remember.</h2></div><a class="text-btn" href="public/events.php">Explore all events <?=ts_icon('arrow-right')?></a></div>
    <div class="home-event-grid events-grid" id="featured-events-grid" aria-busy="true"><p class="home-events-message empty">Finding your next experience…</p></div>
  </section>
  <section class="editorial"><div class="editorial-inner wrap d2-wrap"><div class="editorial-image"><img src="https://images.unsplash.com/photo-1642456987864-9728e517ffb2?auto=format&amp;fit=crop&amp;w=1600&amp;q=85" alt="Festival crowd watching a dramatic live stage" loading="lazy"></div><div class="editorial-copy"><div class="eyebrow">A ticket to something real</div><h2>Some things<br>you have to<br>be there for.</h2><p>The bass you feel before you hear it. A chorus sung by a thousand strangers. Discover experiences that stay with you long after the last track.</p><a class="btn" href="public/events.php">Find your moment <?=ts_icon('arrow-right')?></a></div></div></section>
  <section class="section wrap d2-wrap" aria-labelledby="home-how-title"><div class="section-head"><div><div class="eyebrow">All feeling. Less friction.</div><h2 id="home-how-title">Your night, made simple.</h2></div><p>From the first search to the first song.<br>We keep the details in tune.</p></div><div class="how-grid"><article class="how-item"><span class="how-number">01 / DISCOVER</span><h3>Follow your sound.</h3><p>Find festivals and live shows that feel like you. Discover your next great experience.</p></article><article class="how-item"><span class="how-number">02 / MAKE IT YOURS</span><h3>A ticket. Truly yours.</h3><p>Choose your ticket and seats. Keep your booking, entry pass and NFT ownership together.</p></article><article class="how-item"><span class="how-number">03 / BE THERE</span><h3>Plans change. Music stays.</h3><p>Use your QR for entry, or transfer and resell eligible tickets through the verified marketplace.</p></article></div></section>
  <section class="wrap d2-wrap closing"><div><h2>You bring the vision.<br>We bring the crowd.</h2><p>A simpler way to create, manage and grow your next live event.</p></div><div class="home-closing-actions"><a class="btn" href="organizer/dashboard.php">Meet your organizer studio <?=ts_icon('arrow-right')?></a></div></section>
</main>
<script type="module" src="<?=ts_asset_url('assets/js/home-page.js')?>"></script>
<?php
$content = ob_get_clean();
render_public_page('Home', 'home', $content, '.', false);
?>
