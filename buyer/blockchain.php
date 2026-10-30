<?php
require_once __DIR__.'/../shared/ui.php';
ob_start();
?>
<main class="ts-section-tight ts-buyer-chain-page" data-chain-role="buyer"><div class="ts-container" style="max-width:1100px">
  <a class="ts-record-back" href="tickets.php">&larr; My Tickets</a>
  <div class="ts-transfer-page-heading"><div><div class="ts-section-eyebrow">Your wallet, your approval</div><h1 class="ts-section-title">My blockchain transactions</h1><p class="ts-section-copy">Mint your ticket NFT and complete your ticket transfers and resale purchases on Sepolia using MetaMask.</p></div><button type="button" class="ts-btn ts-btn-secondary" id="buyer-chain-refresh">Refresh</button></div>
  <div class="ts-alert ts-alert-info mb-20">You approve each NFT transaction in your own wallet and pay Sepolia test ETH gas. Ticket payments remain simulated. Complete the earlier operations for a ticket before its next operation.</div>
  <p class="small secondary mb-20">Your ticket booking or handover is saved in TickSecure first. The NFT operation stays pending until you approve it in MetaMask and the backend verifies two confirmations.</p>
  <a class="ts-btn ts-btn-secondary mb-20" id="buyer-chain-receipt" href="ticket-transfers.php" hidden>View transfer receipt</a>
  <div class="ts-alert ts-alert-error mb-20" id="buyer-chain-error" role="alert" hidden></div><div class="ts-alert ts-alert-info mb-20" id="buyer-chain-message" role="status" hidden></div>
  <div class="ts-transfer-summary"><div><span>Pending your action</span><strong id="buyer-chain-pending">0</strong></div><div><span>Confirmed</span><strong id="buyer-chain-confirmed">0</strong></div></div>
  <div class="ts-transfer-toolbar"><label class="ts-transfer-search"><span class="ts-label">Search transactions</span><input class="ts-input" id="buyer-chain-search" type="search" placeholder="Event, ticket, wallet or hash"></label><label><span class="ts-label">Status</span><select class="ts-select" id="buyer-chain-filter"><option value="">All statuses</option><option value="PENDING">Pending</option><option value="SUBMITTED">Submitted</option><option value="CONFIRMED">Confirmed</option><option value="FAILED">Failed</option></select></label><a class="ts-btn ts-btn-tertiary" id="buyer-chain-all" href="blockchain.php" hidden>Show all transactions</a></div>
  <p id="buyer-chain-loading" role="status">Loading your transactions...</p><div id="buyer-chain-list" class="ts-transfer-history-list"></div>
  <details class="ts-card ts-card-pad mt-24" id="buyer-chain-recovery"><summary>Recover a submitted transaction</summary><p class="small secondary mt-12">If you closed the page after approving MetaMask, select the record below and paste the hash from your wallet. Verification will check the exact buyer and ticket operation.</p><div class="ts-chain-deploy-actions"><label><span class="ts-label">Your blockchain record</span><select class="ts-select" id="buyer-chain-recovery-id"></select></label><label class="ts-chain-hash-label"><span class="ts-label">Transaction hash</span><input class="ts-input" id="buyer-chain-recovery-hash" placeholder="0x..." autocomplete="off" spellcheck="false"></label><button type="button" class="ts-btn ts-btn-secondary" id="buyer-chain-recover">Verify my hash</button></div></details>
</div></main>
<script src="<?=ts_asset_url('assets/js/blockchain-wallet.js','..')?>"></script>
<script src="<?=ts_asset_url('assets/js/blockchain-display.js','..')?>"></script>
<script type="module" src="<?=ts_asset_url('assets/js/buyer-blockchain.js','..')?>"></script>
<?php
$content=ob_get_clean();render_public_page('My Blockchain','tickets',$content,'..',true);
?>
