<?php
require_once __DIR__.'/../shared/ui.php';
ob_start();
?>
<main class="ts-section-tight ts-buyer-chain-page" data-chain-role="buyer"><div class="ts-container">
  <a class="ts-record-back" href="tickets.php">&larr; My Tickets</a>
  <header class="chain-page-heading"><div><div class="ts-section-eyebrow">My blockchain transactions</div><h1>Your tickets.<br>On the record.</h1><p>Keep track of your ticket NFTs, transfers and resale purchases. Your wallet gives the final approval.</p></div><div class="chain-network-card"><span class="chain-network-label"><span aria-hidden="true"></span> Ethereum Sepolia</span><strong>Your wallet.<br>Your approval.</strong><span>Test network · Chain ID 11155111</span><button type="button" class="ts-btn ts-btn-secondary" id="buyer-chain-refresh"><?=ts_icon('activity')?> Refresh activity</button></div></header>
  <div class="chain-guide"><div><span>01</span><strong>Review your ticket</strong><p>Your booking or handover is saved first.</p></div><div><span>02</span><strong>Approve in MetaMask</strong><p>Confirm with the wallet required for the operation.</p></div><div><span>03</span><strong>Wait for confirmation</strong><p>Two Sepolia confirmations complete the record.</p></div></div>
  <p class="chain-demo-note"><?=ts_icon('shield')?> Sepolia test ETH covers network gas. Ticket payments are simulated. Complete earlier operations for a ticket before starting the next one.</p>
  <a class="ts-btn ts-btn-secondary mb-20" id="buyer-chain-receipt" href="ticket-transfers.php" hidden>View transfer receipt</a>
  <div class="ts-alert ts-alert-error mb-20" id="buyer-chain-error" role="alert" hidden></div><div class="ts-alert ts-alert-info mb-20" id="buyer-chain-message" role="status" hidden></div>
  <div class="ts-transfer-summary chain-stats"><div><span class="chain-stat-icon"><?=ts_icon('clock')?></span><span>Not yet confirmed</span><strong id="buyer-chain-pending">0</strong><small>Pending, submitted or needing attention</small></div><div><span class="chain-stat-icon"><?=ts_icon('check')?></span><span>Confirmed on Sepolia</span><strong id="buyer-chain-confirmed">0</strong><small>Verified ticket operations</small></div></div>
  <div class="chain-activity-heading"><h2>Ticket activity</h2><span>Mint · Transfer · Resale</span></div>
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
