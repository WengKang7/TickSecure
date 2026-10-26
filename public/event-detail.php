<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-event-detail-page">
  <div class="ts-container">
    <a class="ts-event-back small secondary" href="events.php">&larr; Back to events</a>
    <div class="ts-event-heading">
      <img id="event-poster" class="ts-event-poster-thumb" alt="Event poster" hidden>
      <div class="ts-event-heading-copy">
        <div class="ts-section-eyebrow" id="ev-category">Event details</div>
        <h1 id="ev-title">Loading event...</h1>
        <p class="secondary" id="ev-desc">Event information will appear here.</p>
      </div>
      <div class="ts-event-heading-actions">
        <a class="small secondary" href="events.php?view=saved" data-ts-auth-only hidden>Saved events</a>
        <button class="ts-icon-btn ts-event-save" id="save-event-btn" type="button" aria-label="Save event" title="Save event" aria-pressed="false" data-ts-auth-only hidden><?=ts_icon('heart')?></button>
      </div>
    </div>
    <div class="ts-alert ts-alert-error mb-20" id="event-error" role="alert" hidden></div>

    <div class="ts-event-facts" aria-label="Event information">
      <div class="ts-info-pill"><?=ts_icon('calendar')?><div><span class="ts-event-fact-label">Date &amp; time</span><div id="ev-date"><strong>Loading...</strong></div></div></div>
      <div class="ts-info-pill"><?=ts_icon('map-pin')?><div><span class="ts-event-fact-label">Venue</span><div id="ev-venue"><strong>Loading...</strong></div></div></div>
      <div class="ts-info-pill"><?=ts_icon('building')?><div><span class="ts-event-fact-label">Organizer</span><div id="ev-org"><strong>Loading...</strong></div></div></div>
      <div class="ts-info-pill"><?=ts_icon('ticket')?><div><span class="ts-event-fact-label">Ticket price</span><div id="ev-price"><strong>Loading...</strong></div></div></div>
    </div>

    <div class="ts-seat-generation-layout ts-event-workspace">
      <section class="ts-card ts-event-layout-card" aria-labelledby="venue-heading">
        <div class="ts-card-head">
          <div><h2 class="ts-card-title" id="venue-heading">Venue layout</h2><div class="ts-card-sub" id="ven-name">Loading venue...</div></div>
          <span class="ts-chip ts-chip-neutral" id="ven-status">Seating plan</span>
        </div>
        <div class="ts-event-layout-body">
          <div class="ts-generated-board" id="ven-board" aria-label="Venue seating layout"><div class="ts-event-layout-empty">Loading the seating layout...</div></div>
          <div class="ts-event-layout-caption"><span id="ven-address">Venue information will appear here.</span><span id="venue-section-count"></span></div>
        </div>
      </section>

      <aside class="ts-card ts-event-booking" aria-labelledby="ticket-heading">
        <div class="ts-card-head"><div><h2 class="ts-card-title" id="ticket-heading">Ticket categories</h2><div class="ts-card-sub" id="category-count">Loading categories...</div></div><?=ts_icon('ticket')?></div>
        <div class="ts-event-booking-body">
          <div class="ts-event-price-label" id="selected-category-label">Tickets from</div>
          <div class="ts-event-booking-price" id="selected-category-price">&mdash;</div>
          <div class="ts-event-availability">
            <div><strong id="event-remaining" aria-live="polite">Checking remaining seats...</strong><span class="small secondary" id="availability-note">Sold tickets and active reservations are excluded.</span></div>
            <button class="ts-btn ts-btn-ghost" type="button" id="refresh-availability" aria-label="Refresh remaining seats">Refresh</button>
          </div>
          <div class="ts-event-category-list" id="cat-list" aria-label="Ticket categories"><p class="small secondary">Loading categories...</p></div>
          <p class="small secondary" id="category-selection-note" aria-live="polite">Select a category to highlight its section on the venue layout.</p>
          <div class="ts-event-order" id="event-order" hidden>
            <div class="ts-event-quantity-row">
              <label for="ticket-quantity">Quantity</label>
              <div class="ts-event-quantity-controls">
                <button class="ts-icon-btn" id="quantity-minus" type="button" aria-label="Decrease ticket quantity" disabled>&minus;</button>
                <output id="ticket-quantity" aria-live="polite">1</output>
                <button class="ts-icon-btn" id="quantity-plus" type="button" aria-label="Increase ticket quantity" disabled>+</button>
              </div>
            </div>
            <p class="small secondary" id="ticket-quantity-limit"></p>
            <div class="ts-summary-row"><span>Tickets subtotal</span><strong id="ticket-subtotal">&mdash;</strong></div>
            <div class="ts-summary-row"><span>Service charge</span><strong>RM20.00</strong></div>
            <div class="ts-summary-row total"><span>Total</span><strong id="ticket-total">&mdash;</strong></div>
          </div>
          <a class="ts-btn ts-btn-primary w-full" id="category-book-btn" href="../auth/login.php" data-book-event aria-disabled="true">Sign in to book <?=ts_icon('arrow-right')?></a>
          <p class="small secondary ts-event-booking-note">Seats are assigned automatically. Live availability is checked when you continue.</p>
        </div>
      </aside>
    </div>

    <div class="ts-event-more">
      <section class="ts-card ts-card-pad" aria-labelledby="event-about-heading">
        <h2 class="ts-card-title" id="event-about-heading">About the event</h2>
        <p class="secondary ts-event-about" id="ev-about">Loading event details...</p>
      </section>
      <section class="ts-card ts-card-pad" aria-labelledby="event-policies-heading">
        <h2 class="ts-card-title" id="event-policies-heading">Ticket policies</h2>
        <div class="ts-list">
          <div class="ts-list-item"><span>Automatic seat assignment</span><?=ts_status('Enabled', 'success')?></div>
          <div class="ts-list-item"><span>Ticket transfer</span><span id="ev-transfer">&mdash;</span></div>
          <div class="ts-list-item"><span>Official resale</span><span id="ev-resale">&mdash;</span></div>
        </div>
        <div id="buyer-rules-summary" class="mt-20"></div>
      </section>
    </div>
  </div>
</main>
<script src="<?=ts_asset_url('assets/js/venue-renderer.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/event-policy.js', '..')?>"></script>
<script type="module" src="<?=ts_asset_url('assets/js/event-detail.js', '..')?>"></script>

<?php
$content = ob_get_clean();
render_public_page('Event Details', 'events', $content, '..', false);
?>
