<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>
<main class="ts-record-page ts-booking-detail-page">
  <div class="ts-container">
    <a class="ts-record-back" href="bookings.php">&larr; Back to My Bookings</a>
    <header class="ts-record-heading"><div><div class="ts-section-eyebrow" id="val-eyebrow">Booking details</div><h1 id="val-event">Loading your booking...</h1><p class="secondary" id="val-date"></p></div><div id="val-status-head"></div></header>
    <div class="ts-alert ts-alert-error" id="booking-error" role="alert" hidden></div>
    <div id="booking-content" hidden>
      <div class="ts-booking-detail-layout">
        <div class="ts-record-main">
          <section class="ts-card ts-record-card" aria-labelledby="details-heading"><h2 id="details-heading">Booking details</h2>
            <dl class="ts-record-facts">
              <div><dt>Event date &amp; time</dt><dd id="val-event-date"></dd></div><div><dt>Venue</dt><dd id="val-venue"></dd></div>
              <div><dt>Category</dt><dd id="val-cat"></dd></div><div><dt>Section</dt><dd id="val-section"></dd></div>
              <div><dt>Assigned seats</dt><dd id="val-seat"></dd></div><div><dt>Quantity</dt><dd id="val-qty"></dd></div>
            </dl>
          </section>
          <section class="ts-card ts-record-card" aria-labelledby="tickets-heading"><div class="ts-record-card-heading"><h2 id="tickets-heading">Your tickets</h2><span class="small secondary" id="ticket-count"></span></div><div class="ts-alert ts-alert-error" id="tickets-error" role="alert" hidden></div><div class="ts-booking-ticket-list" id="booking-ticket-list"><p class="secondary">Loading your tickets...</p></div><p class="small secondary ts-record-policy-note">Showing tickets currently in your account. Open a ticket to view its entry QR code.</p></section>
        </div>
        <aside class="ts-card ts-record-card ts-booking-payment" aria-labelledby="payment-heading">
          <h2 id="payment-heading">Payment summary</h2>
          <div class="ts-record-payment-row"><span>Ticket subtotal</span><strong id="val-subtotal"></strong></div>
          <div class="ts-record-payment-row"><span>Service charge</span><strong id="val-fee"></strong></div>
          <div class="ts-record-payment-row ts-record-payment-total"><span id="payment-total-label">Total</span><strong id="val-total"></strong></div>
          <div class="ts-record-payment-status"><span class="small secondary">Payment status</span><div id="val-payment-status"></div><p class="small secondary" id="payment-note"></p></div>
          <a class="ts-btn ts-btn-secondary w-full" href="tickets.php">View My Tickets <?=ts_icon('arrow-right')?></a>
          <a class="ts-btn ts-btn-primary w-full mt-12" id="booking-buyer-chain-link" href="blockchain.php">Mint &amp; track ticket NFTs</a>
          <details class="ts-record-technical"><summary>Blockchain details <?=ts_icon('chevron-down')?></summary><dl class="ts-record-facts ts-record-facts-stack"><div><dt>Minting status</dt><dd id="val-mint-status"></dd></div><div><dt>Transaction</dt><dd class="ts-record-code" id="val-tx"></dd></div></dl></details>
        </aside>
      </div>
    </div>
  </div>
</main>
<script src="<?=ts_asset_url('assets/js/ticket-display.js', '..')?>"></script>
<script type="module" src="<?=ts_asset_url('assets/js/booking-detail.js', '..')?>"></script>
<?php
$content = ob_get_clean();
render_public_page('Booking Details', 'tickets', $content, '..', true);
?>
