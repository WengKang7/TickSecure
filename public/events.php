<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-events-page">
  <div class="ts-container">
    <header class="ts-events-intro">
      <div>
        <div class="ts-section-eyebrow">TickSecure / Discover</div>
        <h1>Find your next<br><em>great experience.</em></h1>
      </div>
      <div class="ts-events-intro-copy">
        <p>Explore live events, find your favourite moments, and make plans worth looking forward to.</p>
        <span><?=ts_icon('ticket')?> Your next experience starts here</span>
      </div>
    </header>

    <div class="ts-events-toolbar" aria-label="Find events">
      <div class="ts-input-wrap ts-search"><?=ts_icon('search')?><input id="event-search" class="ts-input" type="search" placeholder="Search an event or venue" aria-label="Search event or venue"></div>
      <div class="ts-event-view-switch" role="group" aria-label="Events to display">
        <button class="ts-btn" id="all-events-btn" type="button" aria-pressed="true">All events</button>
        <button class="ts-btn" id="saved-events-btn" type="button" aria-pressed="false" data-ts-auth-only hidden><?=ts_icon('heart')?> Saved events</button>
      </div>
    </div>

    <section aria-labelledby="events-results-title">
      <div class="ts-events-results-head">
        <h2 id="events-results-title">Explore events</h2>
        <div id="events-count" aria-live="polite">Loading events...</div>
      </div>
      <div class="ts-event-grid" id="events-grid" aria-busy="true">
        <div class="ts-events-empty secondary">Loading published events...</div>
      </div>
    </section>
    <div class="ts-events-signoff"><span>TickSecure</span><span>Make time for live experiences.</span></div>
  </div>
</main>

<script type="module" src="<?=ts_asset_url('assets/js/events.js', '..')?>"></script>

<?php
$content=ob_get_clean();
render_public_page('Events','events',$content,'..',false);
?>
