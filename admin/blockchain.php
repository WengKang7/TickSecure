<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>
<div class="ts-chain-page">
<?=ts_page_head('Blockchain monitoring', 'View the ticket NFT transactions submitted by buyers. Manage the one-time contract setup here.', '<button type="button" class="ts-btn ts-btn-secondary" id="chain-refresh">Refresh</button>')?>
<div class="ts-alert ts-alert-error mb-24" id="chain-error" role="alert" hidden></div>
<div class="ts-alert ts-alert-info mb-24" id="chain-message" role="status" hidden></div>
<section class="ts-card ts-card-pad mb-24" aria-labelledby="chain-setup-heading">
  <div class="ts-chain-heading"><div><h2 id="chain-setup-heading">Sepolia ticket contract</h2><p class="small secondary">Buyers approve mint, transfer and resale NFT transactions in their own wallets and pay test ETH gas. Administrators monitor activity and configure the contract.</p></div><button type="button" class="ts-btn ts-btn-secondary" id="chain-connect">Connect setup wallet</button></div>
  <dl class="ts-chain-config"><div><dt>Network</dt><dd>Ethereum Sepolia · 11155111</dd></div><div><dt>Connected setup wallet</dt><dd id="chain-wallet">Not connected</dd></div><div><dt>Contract</dt><dd id="chain-contract">Loading…</dd></div><div><dt>Contract administrator</dt><dd id="chain-operator">Not registered</dd></div></dl>
  <div id="chain-deployment" hidden>
    <p class="small secondary">First time: deploy the buyer-enabled contract with a setup wallet and Sepolia test ETH. The backend authorizes each eligible action; only the required buyer wallet can submit it.</p>
    <div class="ts-chain-deploy-actions"><button type="button" class="ts-btn ts-btn-primary" id="chain-deploy" disabled>Deploy ticket contract</button><label class="ts-chain-hash-label"><span class="ts-label">Deployment transaction hash</span><input class="ts-input" id="chain-deployment-hash" placeholder="0x…" autocomplete="off" spellcheck="false"></label><button type="button" class="ts-btn ts-btn-secondary" id="chain-register">Verify &amp; register</button></div>
    <p class="small secondary mt-12">Verify after two confirmations. Paste a deployment hash to recover interrupted setup. Clear the field to start a new attempt only if the previous deployment was cancelled or reverted.</p>
  </div>
</section>
<div class="ts-kpi-grid mb-24">
  <?=ts_kpi('All records', '<span id="tx-total-kpi">…</span>', 'check')?><?=ts_kpi('Awaiting confirmation', '<span id="tx-pending-kpi">…</span>', 'clock')?><?=ts_kpi('Confirmed on Sepolia', '<span id="tx-confirmed-kpi">…</span>', 'check')?><?=ts_kpi('Failed', '<span id="tx-failed-kpi">…</span>', 'alert')?>
</div>
<div class="ts-card">
  <div class="ts-filter-bar"><label class="ts-chain-search"><span class="ts-label">Find a record</span><input class="ts-input" id="chain-search" type="search" placeholder="Hash, ticket, wallet or record ID"></label><label><span class="ts-label">Status</span><select class="ts-select" id="chain-status"><option value="">All statuses</option><option value="PENDING">Pending</option><option value="SUBMITTED">Submitted</option><option value="CONFIRMED">Confirmed</option><option value="FAILED">Failed</option></select></label><label><span class="ts-label">Type</span><select class="ts-select" id="chain-type"><option value="">All transaction types</option><option value="MINT">Mint</option><option value="TRANSFER">Transfer</option><option value="RESALE">Resale</option></select></label></div>
  <div class="ts-table-wrap"><table class="ts-table"><thead><tr><th>Transaction hash</th><th>Receiver wallet</th><th>Type / ticket</th><th>Status</th><th>Recorded at</th><th>Action</th></tr></thead><tbody id="tx-table-body"><tr><td colspan="6" class="text-center secondary">Loading…</td></tr></tbody></table></div>
</div>
<p class="small secondary mt-20">Firebase saves the full hash in <code>BlockchainTransactions.transactionHash</code>. Mint hashes also appear in <code>NFTTickets.transactionHash</code>; the latest operation is in <code>NFTTickets.blockchainLastTransactionHash</code>. Sepolia gas uses test ETH. Ticket payments remain simulated.</p>
</div>
<script src="<?=ts_asset_url('assets/js/blockchain-wallet.js', '..')?>"></script>
<script type="module" src="<?=ts_asset_url('assets/js/admin-blockchain.js', '..')?>"></script>
<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Blockchain Transactions', 'blockchain', $content, '..', '');
?>
