<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>
<main class="ts-record-page ts-ticket-detail-page">
  <div class="ts-container">
    <a class="ts-record-back" href="tickets.php">&larr; Back to My Tickets</a>
    <header class="ts-record-heading">
      <div><div class="ts-section-eyebrow">My Tickets</div><h1>Your digital ticket</h1><p class="secondary">Event entry and ownership details in one place.</p></div>
      <div class="ts-record-actions"><a class="ts-btn ts-btn-secondary" id="view-booking" href="bookings.php" hidden>View booking</a><button class="ts-btn ts-btn-secondary" id="download-qr" type="button" disabled><?=ts_icon('download')?> Download QR</button></div>
    </header>
    <div class="ts-alert ts-alert-error" id="ticket-error" role="alert" hidden></div>
    <div id="ticket-content" hidden>
      <div class="ts-ticket-detail-layout">
        <section class="ts-ticket-pass" aria-labelledby="val-event">
          <div class="ts-ticket-head">
            <div class="ts-ticket-heading-copy"><small>TickSecure digital ticket</small><h2 class="ts-ticket-event" id="val-event">Loading...</h2><div class="ts-ticket-event-facts"><span id="val-event-meta"></span><span id="val-venue"></span></div></div>
            <div id="val-status"></div>
          </div>
          <div class="ts-ticket-body">
            <div class="ts-ticket-grid">
              <div><div class="ts-ticket-label">Category</div><div class="ts-ticket-value" id="val-category"></div></div>
              <div><div class="ts-ticket-label">Section</div><div class="ts-ticket-value" id="val-section"></div></div>
              <div><div class="ts-ticket-label">Seat</div><div class="ts-ticket-value" id="val-seat"></div></div>
            </div>
            <div class="ts-ticket-entry">
              <div id="qr-container" class="ts-ticket-qr" aria-label="Ticket entry code"></div>
              <div class="ts-ticket-entry-copy"><h3 id="entry-heading">Entry QR code</h3><p class="secondary" id="qr-note">Present this QR code at the event entrance. Entry staff check the current ticket status.</p><p class="small secondary">Each ticket allows one entry. Keep your QR code private.</p></div>
            </div>
            <div class="ts-ticket-reference"><span>Ticket ID</span><code id="val-ticket-id"></code></div>
          </div>
        </section>
        <aside class="ts-card ts-record-card" aria-labelledby="ownership-heading">
          <div class="ts-record-card-heading"><h2 id="ownership-heading">Ticket ownership</h2><div id="val-status-label"></div></div>
          <dl class="ts-record-facts ts-record-facts-stack">
            <div><dt>Current owner wallet</dt><dd class="ts-record-code" id="val-owner"></dd></div>
            <div><dt>Token ID</dt><dd class="ts-record-code" id="val-token-id"></dd></div>
            <div><dt>Blockchain status</dt><dd id="val-mint-status"></dd></div>
          </dl>
          <div class="ts-record-ticket-actions"><a class="ts-btn ts-btn-secondary" href="#" id="btn-transfer" hidden><?=ts_icon('arrow-right')?> Transfer</a><a class="ts-btn ts-btn-primary" href="#" id="btn-resale" hidden>List for resale</a></div>
          <p class="small secondary ts-record-policy-note" id="ticket-actions-note"></p>
          <a class="ts-record-history-link" href="#history">View ownership history &darr;</a>
          <a class="ts-btn ts-btn-secondary w-full mt-16" id="ticket-buyer-chain-link" href="blockchain.php">My NFT transactions</a>
          <details class="ts-record-technical"><summary>Blockchain details <?=ts_icon('chevron-down')?></summary><dl class="ts-record-facts ts-record-facts-stack"><div><dt>Contract address</dt><dd class="ts-record-code" id="val-contract"></dd></div><div><dt>Mint transaction</dt><dd class="ts-record-code" id="val-tx"></dd></div><div id="ticket-chain-latest" hidden><dt>Latest confirmed Sepolia transaction</dt><dd class="ts-record-code" id="val-chain-latest"></dd><dt>Wallet recorded on Sepolia</dt><dd class="ts-record-code" id="val-chain-owner"></dd><dd class="small secondary" id="val-chain-sync"></dd></div></dl></details>
        </aside>
      </div>
      <section class="ts-card ts-record-card ts-record-history" id="history" aria-labelledby="history-heading"><div class="ts-transfer-page-heading"><h2 id="history-heading">Ownership history</h2><a class="ts-btn ts-btn-secondary" id="ticket-transfer-history-link" href="ticket-transfers.php">Sender &amp; receiver details</a></div><div class="ts-timeline" id="timeline-container"></div></section>
    </div>
  </div>
</main>
<script src="<?=ts_asset_url('assets/js/vendor/qrcode-generator-1.4.4.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/ticket-display.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/ticket-qr.js', '..')?>"></script>
<script type="module" src="<?=ts_asset_url('assets/js/ticket-detail.js', '..')?>"></script>
<?php
$content = ob_get_clean();
render_public_page('Digital Ticket', 'tickets', $content, '..', true);
?>
