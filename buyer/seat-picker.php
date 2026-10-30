<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>
<main class="ts-section-tight ts-seat-page">
  <div class="ts-container">
    <div class="ts-steps">
      <div class="ts-step done"><span class="ts-step-num">&#10003;</span>Category</div><span class="ts-step-line"></span>
      <div class="ts-step active"><span class="ts-step-num">2</span>Choose Seats</div><span class="ts-step-line"></span>
      <div class="ts-step"><span class="ts-step-num">3</span>Checkout</div>
    </div>
    <div class="ts-seat-picker-layout">
      <section class="ts-card ts-card-pad">
        <h1 class="ts-section-title">Choose your seats</h1>
        <p class="muted mt-8" id="picker-event">Loading the event seating plan...</p>
        <p class="small muted mt-8" id="picker-instructions">Choose a seat to preview its view toward the stage, then reserve your selection.</p>
        <div class="ts-buyer-view-toolbar mt-20">
          <div class="ts-buyer-view-switch" role="group" aria-label="Seating view">
            <button type="button" id="picker-mode-3d" aria-pressed="true">3D view</button>
            <button type="button" id="picker-mode-2d" aria-pressed="false">2D plan</button>
          </div>
          <div class="ts-seat-tool-buttons">
            <button type="button" class="ts-btn ts-btn-secondary" id="picker-zoom-in" aria-label="Zoom in">+</button>
            <button type="button" class="ts-btn ts-btn-secondary" id="picker-zoom-out" aria-label="Zoom out">&minus;</button>
            <button type="button" class="ts-btn ts-btn-secondary" id="picker-fit">Reset view</button>
            <button type="button" class="ts-btn ts-btn-ghost" id="picker-refresh">Refresh availability</button>
          </div>
        </div>
        <div class="ts-seat-legend mt-16"><span>Available</span><span class="selected">Selected</span><span class="unavailable">Held / sold</span><span class="context" id="picker-context-legend" hidden>Other seats</span></div>
        <div class="ts-buyer-view-heading mt-16" id="picker-3d-heading" hidden>
          <strong id="picker-view-status" aria-live="polite">Venue overview</strong>
          <select class="ts-input" id="picker-plan-page" aria-label="Floor plan page" hidden></select>
          <button class="ts-btn ts-btn-secondary" type="button" id="picker-overview" hidden>Back to overview</button>
        </div>
        <div class="ts-seat-people-controls mt-12" id="picker-people-controls" hidden>
          <label class="ts-seat-people-toggle" for="picker-people">
            <input type="checkbox" role="switch" id="picker-people" aria-describedby="picker-people-note">
            <span><strong>Show people</strong><small id="picker-people-note">Sample seated people. Seat colours show actual availability.</small></span>
          </label>
          <button class="ts-btn ts-btn-secondary" type="button" id="picker-people-motion" aria-pressed="false" disabled>Pause animation</button>
        </div>
        <div class="ts-seat-3d-frame mt-12" id="buyer-seat-3d" hidden></div>
        <div class="ts-generated-board mt-16" id="buyer-seat-map" aria-label="Choose an available seat" hidden></div>
        <div class="ts-seat-view-preview mt-12" id="picker-seat-preview" hidden>
          <div><strong id="picker-preview-label"></strong><p class="small muted mt-4" id="picker-preview-status" role="status"></p></div>
          <button type="button" class="ts-btn ts-btn-secondary" id="picker-view-seat">View from this seat</button>
        </div>
        <p class="small muted mt-12" id="picker-3d-note" hidden>Drag to rotate. Illustrative view: actual attendees, floor slopes and obstructions are not modelled.</p>
        <p class="small muted mt-8" id="picker-3d-fallback" hidden>3D preview is unavailable in this browser. Use the 2D plan or seat list.</p>
        <p class="small muted mt-12" id="picker-position-note" hidden>Exact positions are unavailable for this layout. Choose by seat identifier below.</p>
        <details id="picker-list-details" class="ts-simple-details mt-16"><summary>Find seats by row or number</summary><label class="ts-label mt-16" for="picker-search">Find a seat</label>
        <input class="ts-input" id="picker-search" placeholder="Row or seat identifier" maxlength="80">
        <div class="ts-picker-seat-list mt-12" id="picker-seat-list" aria-label="Available seat identifiers"></div></details>
      </section>
      <aside class="ts-card ts-card-pad">
        <div class="ts-card-title">Your selection</div>
        <p class="muted mt-8" id="picker-category"></p>
        <p class="small mt-12" id="picker-count" role="status" aria-live="polite">Choose your seats.</p>
        <div class="ts-seat-pills mt-12" id="picker-selected"></div>
        <div class="ts-generation-total mt-16"><span>Total including RM20 service charge</span><strong id="picker-total">—</strong></div>
        <div class="ts-alert ts-alert-error mt-16" id="picker-error" role="alert" hidden></div>
        <div class="ts-alert ts-alert-info mt-16" id="picker-hold" role="status" hidden>Seats held for <strong id="picker-countdown"></strong></div>
        <button type="button" class="ts-btn ts-btn-primary w-full mt-20" id="picker-reserve" disabled>Reserve selected seats</button>
        <a hidden class="ts-btn ts-btn-primary w-full mt-12" id="picker-continue" aria-disabled="true">Continue</a>
        <button hidden type="button" class="ts-btn ts-btn-ghost w-full mt-12" id="picker-release" disabled>Release held seats</button>
        <details class="ts-simple-details mt-20"><summary>Prefer automatic selection?</summary><a class="ts-btn ts-btn-secondary w-full mt-12" id="picker-auto">Find seats for me</a></details>
        <a class="ts-btn ts-btn-tertiary w-full mt-12" id="picker-back">Change category</a>
      </aside>
    </div>
  </div>
</main>
<script src="<?= ts_asset_url('assets/js/venue-renderer.js', '..') ?>"></script>
<script src="<?= ts_asset_url('assets/js/seat-map-interactions.js', '..') ?>"></script>
<script src="<?= ts_asset_url('assets/js/seat-view-model.js', '..') ?>"></script>
<script src="<?= ts_asset_url('assets/js/seat-view-people.js', '..') ?>"></script>
<script src="<?= ts_asset_url('assets/js/seat-view-3d.js', '..') ?>"></script>
<script type="module" src="<?= ts_asset_url('assets/js/seat-picker.js', '..') ?>"></script>
<?php
$content = ob_get_clean();
render_public_page('Choose Seats', 'events', $content, '..', true);
?>
