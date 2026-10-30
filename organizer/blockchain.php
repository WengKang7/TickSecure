<?php
require_once __DIR__.'/../shared/ui.php';
ob_start();
?>
<div class="ts-buyer-chain-page" data-chain-role="organizer">
  <?=ts_page_head('Event blockchain activity','View the ticket NFT transactions for your own events. Buyers submit their wallet transactions.','<button type="button" class="ts-btn ts-btn-secondary" id="buyer-chain-refresh">Refresh</button>')?>
  <div class="ts-alert ts-alert-error mb-20" id="buyer-chain-error" role="alert" hidden></div><div class="ts-alert ts-alert-info mb-20" id="buyer-chain-message" role="status" hidden></div>
  <div class="ts-transfer-summary"><div><span>Pending</span><strong id="buyer-chain-pending">0</strong></div><div><span>Confirmed</span><strong id="buyer-chain-confirmed">0</strong></div></div>
  <div class="ts-transfer-toolbar"><label class="ts-transfer-search"><span class="ts-label">Search transactions</span><input class="ts-input" id="buyer-chain-search" type="search" placeholder="Event, ticket, wallet or hash"></label><label><span class="ts-label">Status</span><select class="ts-select" id="buyer-chain-filter"><option value="">All statuses</option><option value="PENDING">Pending</option><option value="SUBMITTED">Submitted</option><option value="CONFIRMED">Confirmed</option><option value="FAILED">Failed</option></select></label></div>
  <p id="buyer-chain-loading" role="status">Loading your event activity...</p><div id="buyer-chain-list" class="ts-transfer-history-list"></div>
</div>
<script src="<?=ts_asset_url('assets/js/blockchain-display.js','..')?>"></script>
<script type="module" src="<?=ts_asset_url('assets/js/buyer-blockchain.js','..')?>"></script>
<?php
$content=ob_get_clean();render_dashboard_page('organizer','Blockchain Activity','blockchain',$content,'..','');
?>
