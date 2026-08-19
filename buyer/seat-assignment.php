<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
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
        <div class="ts-section-eyebrow">Assignment completed</div>
        <h1 class="ts-section-title">Your seat is reserved</h1>
        <p class="secondary">TickSecure selected the first available seat in VIP1 based on the venue section assignment
          order.</p>
        <div class="ts-alert ts-alert-success mt-24">
          <?=ts_icon('check')?>
          <div><strong>VIP1 · Section A · Seat A06</strong>
            <div class="small mt-8">Seat A01–A05 are unavailable. A06 is the next available seat in the configured
              order.</div>
          </div>
        </div>
        <div class="ts-reservation-bar mt-20">
          <span><?=ts_icon('clock')?> Reservation
            expires in</span><span class="ts-reservation-time" data-countdown="582">09:42</span></div>
        <div class="ts-seat-pills mt-16">
          <?php for ($i = 1;$i <= 12;$i++): ?><span
            class="ts-seat-pill <?=$i <= 5 ? 'sold' : ($i === 6 ? 'next' : '')?>">A<?=str_pad((string)$i, 2, '0', STR_PAD_LEFT)?></span><?php endfor; ?>
        </div>
        <div class="small muted mt-12">Gray seats are unavailable. The highlighted seat is reserved for your checkout
          session.</div>
      </div>
      <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Next: secure your ownership wallet</div>
        <p class="secondary">A supported wallet is required so the NFT ticket can be assigned to the correct owner after
          payment.</p>
        <div class="ts-wallet-card mt-20">
          <div><strong>MetaMask</strong>
            <div class="small muted mt-8">Not connected for this checkout</div>
          </div><span class="ts-chip ts-chip-warning">Required</span>
        </div><a class="ts-btn ts-btn-primary w-full mt-24" href="wallet.php">Continue to Wallet</a><a
          class="ts-btn ts-btn-tertiary w-full mt-8" href="booking-category.php">Change Category</a>
      </div>
    </div>
  </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Seat Assignment', 'events', $content, '..', true);
?>