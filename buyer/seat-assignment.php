<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight ts-seat-page">
  <div class="ts-container">
    <div class="ts-steps">
      <div class="ts-step done"><span class="ts-step-num">✓</span>Category</div><span class="ts-step-line"></span>
      <div class="ts-step active"><span class="ts-step-num">2</span>Seat Assignment</div><span
        class="ts-step-line"></span>
      <div class="ts-step"><span class="ts-step-num">3</span>Wallet</div><span class="ts-step-line"></span>
      <div class="ts-step"><span class="ts-step-num">4</span>Payment</div>
    </div>
    <div class="ts-grid-2">
      <div class="ts-card ts-card-pad">
        <div class="ts-section-eyebrow" id="assignment-state">Seat assignment</div>
        <h1 class="ts-section-title" id="assignment-title">Assigning your seats</h1>
        <p class="secondary">TickSecure assigns the first available seats in your selected category using the venue section assignment order.</p>
        <div class="ts-alert ts-alert-info mt-24" id="assigned-seat-alert">
          <span id="assignment-icon"><?=ts_icon('clock')?></span>
          <div><strong id="assigned-seat-text">Loading assignment...</strong>
            <div class="small mt-8" id="assigned-seat-sub">Assigning the best available seats...</div>
          </div>
        </div>
        <div class="ts-reservation-bar mt-20" id="reservation-bar" style="display:none">
          <span><?=ts_icon('clock')?> Reservation
            expires in</span><span class="ts-reservation-time" id="countdown-timer">10:00</span></div>
        <div class="ts-seat-pills mt-16" id="seat-pills-container">
           <!-- Dynamic seats -->
        </div>
        <div class="small muted mt-12">Seats are held only after a successful reservation.</div><button class="ts-btn ts-btn-secondary mt-16" type="button" id="retry-reservation" hidden>Try again</button>
      </div>
      <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Next: secure your ownership wallet</div>
        <p class="secondary">A supported wallet is required so the NFT ticket can be assigned to the correct owner after
          payment.</p>
        <div class="ts-wallet-card mt-20">
          <div><strong id="wallet-name">MetaMask</strong>
            <div class="small muted mt-8" id="wallet-status">Not connected for this checkout</div>
          </div><span class="ts-chip ts-chip-warning" id="wallet-chip">Required</span>
        </div><a class="ts-btn ts-btn-primary w-full mt-24" href="wallet.php" id="btn-continue">Continue to Wallet</a><a
          class="ts-btn ts-btn-tertiary w-full mt-8" href="../public/events.php" id="change-category-btn">Change Category</a>
      </div>
    </div>
  </div>
</main>

<script type="module" src="<?=ts_asset_url('assets/js/seat-assignment.js', '..')?>"></script>

<?php
$content = ob_get_clean();
render_public_page('Seat Assignment', 'events', $content, '..', true);
?>
