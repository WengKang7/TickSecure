<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>
<main class="ts-section-tight ts-transfer-page"><div class="ts-container">
  <a class="ts-record-back" href="tickets.php">&larr; Back to My Tickets</a>
  <header class="ts-transfer-page-heading"><div><div class="ts-section-eyebrow">Ownership records</div><h1 class="ts-section-title">Ticket transfers</h1><p class="ts-section-copy">See the tickets you sent and received, with the people, wallets and event details for each transfer.</p></div><button type="button" class="ts-btn ts-btn-secondary" id="transfer-history-refresh">Refresh</button></header>
  <div class="ts-alert ts-alert-success mb-24" id="transfer-receipt-notice" role="status" hidden>Transfer completed. This receipt is available to both the sender and receiver. <a href="ticket-transfers.php">View all transfers</a></div>
  <p class="small secondary mb-16" id="transfer-ticket-filter" hidden>Showing your transfers for this ticket. <a href="ticket-transfers.php">View all transfers</a></p>
  <div class="ts-transfer-summary"><div><span>Sent by you</span><strong id="transfer-count-sent">0</strong></div><div><span>Received by you</span><strong id="transfer-count-received">0</strong></div></div>
  <div class="ts-transfer-toolbar"><div class="ts-tabs" role="group" aria-label="Transfer direction"><button type="button" class="ts-tab active" data-transfer-filter="all" aria-pressed="true">All transfers</button><button type="button" class="ts-tab" data-transfer-filter="SENT" aria-pressed="false">Sent</button><button type="button" class="ts-tab" data-transfer-filter="RECEIVED" aria-pressed="false">Received</button></div><label class="ts-transfer-search"><span class="ts-label">Find a transfer</span><input class="ts-input" id="transfer-search" type="search" placeholder="Event, person, wallet or seat"></label></div>
  <p class="small secondary mb-16" id="transfer-history-count" role="status"></p>
  <div class="ts-alert ts-alert-error mb-16" id="transfer-history-error" role="alert" hidden></div>
  <p class="secondary" id="transfer-history-loading" role="status">Loading transfers...</p>
  <p class="ts-transfer-empty" id="transfer-history-empty" hidden>No ticket transfers recorded yet.</p>
  <div class="ts-transfer-history-list" id="transfer-history-list"></div>
  <p class="small secondary mt-24">Transfer times use UTC+8. Demo transfers update ownership in TickSecure and do not submit a blockchain transaction.</p>
</div></main>
<script src="<?=ts_asset_url('assets/js/ticket-display.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/transfer-display.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/ticket-transfer-history.js', '..')?>"></script>
<?php
$content=ob_get_clean();
render_public_page('Ticket Transfers', 'tickets', $content, '..', true);
?>
