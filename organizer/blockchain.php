<?php
require_once __DIR__ . '/../shared/ui.php';
$nftTab = ($_GET['tab'] ?? '') === 'nft';
ob_start();
?>
<style>
#organizer-blockchain-tabs .ts-table-wrap { max-width:100%; overflow-x:auto; }
#organizer-blockchain-tabs .ts-table { width:100%; min-width:1100px; table-layout:fixed; border-collapse:collapse; }
#organizer-blockchain-tabs .ts-table th,
#organizer-blockchain-tabs .ts-table td {
  border:1px solid #e5e5e5; padding:14px 16px; text-align:left;
  vertical-align:top; white-space:normal; overflow-wrap:anywhere; word-break:normal;
}
#organizer-blockchain-tabs .ts-table th { background:#f8fafb; font-weight:600; }
#organizer-blockchain-tabs .ts-table td { font-size:13px; line-height:1.65; }
#organizer-blockchain-tabs .ts-chain-code,
#organizer-blockchain-tabs .ts-chain-record-id { min-width:0; max-width:100%; white-space:normal; overflow-wrap:anywhere; }
#organizer-blockchain-tabs [data-panel="transactions"] th:nth-child(1) { width:26%; }
#organizer-blockchain-tabs [data-panel="transactions"] th:nth-child(2) { width:21%; }
#organizer-blockchain-tabs [data-panel="transactions"] th:nth-child(3) { width:17%; }
#organizer-blockchain-tabs [data-panel="transactions"] th:nth-child(4) { width:10%; }
#organizer-blockchain-tabs [data-panel="transactions"] th:nth-child(5),
#organizer-blockchain-tabs [data-panel="transactions"] th:nth-child(6) { width:13%; }
#organizer-blockchain-tabs [data-panel="nft"] .ts-table { min-width:1280px; }
#organizer-blockchain-tabs [data-panel="nft"] th:nth-child(1) { width:14%; }
#organizer-blockchain-tabs [data-panel="nft"] th:nth-child(2) { width:17%; }
#organizer-blockchain-tabs [data-panel="nft"] th:nth-child(3),
#organizer-blockchain-tabs [data-panel="nft"] th:nth-child(6) { width:19%; }
#organizer-blockchain-tabs [data-panel="nft"] th:nth-child(4) { width:16%; }
#organizer-blockchain-tabs [data-panel="nft"] th:nth-child(5) { width:8%; }
#organizer-blockchain-tabs [data-panel="nft"] th:nth-child(7) { width:7%; }
</style>
<div class="ts-chain-page">
<?=ts_page_head('Blockchain History', 'View ticket NFT transactions for your events. Manage your own contract and buyer demo gas.', '<button type="button" class="ts-btn ts-btn-secondary" id="chain-refresh">Refresh</button>')?>
<div class="ts-alert ts-alert-error mb-24" id="chain-error" role="alert" hidden></div>
<div class="ts-alert ts-alert-info mb-24" id="chain-message" role="status" hidden></div>
<section class="ts-card ts-card-pad mb-24" aria-labelledby="chain-setup-heading">
  <div class="ts-chain-heading"><div><h2 id="chain-setup-heading">Sepolia ticket contract</h2><p class="small secondary">Buyers approve mint, transfer and resale NFT transactions in their own wallets and pay test ETH gas. You monitor your events and configure your own contract.</p></div><button type="button" class="ts-btn ts-btn-secondary" id="chain-connect">Connect setup wallet</button></div>
  <dl class="ts-chain-config"><div><dt>Network</dt><dd>Ethereum Sepolia · 11155111</dd></div><div><dt>Connected setup wallet</dt><dd id="chain-wallet">Not connected</dd></div><div><dt>Contract</dt><dd id="chain-contract">Loading…</dd></div><div><dt>Organizer wallet</dt><dd id="chain-operator">Not registered</dd></div></dl>
  <div id="chain-deployment" hidden>
    <p class="small secondary">First time: deploy your buyer-enabled contract with a setup wallet and Sepolia test ETH. The backend authorizes each eligible action; only the required buyer wallet can submit it.</p>
    <div class="ts-chain-deploy-actions"><button type="button" class="ts-btn ts-btn-primary" id="chain-deploy" disabled>Deploy ticket contract</button><label class="ts-chain-hash-label"><span class="ts-label">Deployment transaction hash</span><input class="ts-input" id="chain-deployment-hash" placeholder="0x…" autocomplete="off" spellcheck="false"></label><button type="button" class="ts-btn ts-btn-secondary" id="chain-register">Verify &amp; register</button></div>
    <p class="small secondary mt-12">Maximum quoted fee: 0.0001 SepoliaETH per NFT operation and 0.001 SepoliaETH per deployment. Expensive requests pause. Verify after two confirmations. Paste a deployment hash to recover interrupted setup. Clear the field to start a new attempt only if the previous deployment was cancelled or reverted.</p>
  </div>
</section>
<section class="ts-card ts-card-pad mb-24" aria-labelledby="demo-funding-heading">
  <div class="ts-chain-heading"><h2 id="demo-funding-heading">Automatic buyer demo gas — your events</h2><button class="ts-btn ts-btn-secondary" id="demo-funding-refresh" type="button">Refresh funding</button></div>
  <p class="small secondary" id="demo-funding-message" role="status">Loading demo funding wallet...</p>
  <dl class="ts-chain-config" id="demo-funding-details" hidden><div><dt>Dedicated Sepolia funding address</dt><dd class="ts-chain-code" id="demo-funding-address"></dd></div><div><dt>Available test ETH</dt><dd id="demo-funding-balance"></dd></div><div><dt>Today's reserved budget (includes gas)</dt><dd id="demo-funding-budget"></dd></div></dl>
  <div id="demo-funding-failures" class="ts-list mt-16"></div>
</section>
<div data-tabs id="organizer-blockchain-tabs">
  <nav class="ts-tabs mb-24" aria-label="Blockchain history sections">
    <button type="button" class="ts-tab<?=$nftTab ? '' : ' active'?>" data-tab="transactions">Transaction history</button>
    <button type="button" class="ts-tab<?=$nftTab ? ' active' : ''?>" data-tab="nft">NFT Owner</button>
  </nav>
  <div class="ts-tab-panel<?=$nftTab ? '' : ' active'?>" data-panel="transactions">
<div class="ts-kpi-grid mb-24">
  <?=ts_kpi('All records', '<span id="tx-total-kpi">…</span>', 'check')?><?=ts_kpi('Awaiting confirmation', '<span id="tx-pending-kpi">…</span>', 'clock')?><?=ts_kpi('Confirmed on Sepolia', '<span id="tx-confirmed-kpi">…</span>', 'check')?><?=ts_kpi('Failed', '<span id="tx-failed-kpi">…</span>', 'alert')?>
</div>
<div class="ts-card">
  <div class="ts-filter-bar"><label class="ts-chain-search"><span class="ts-label">Find a record</span><input class="ts-input" id="chain-search" type="search" placeholder="Hash, ticket, wallet or record ID"></label><label><span class="ts-label">Status</span><select class="ts-select" id="chain-status"><option value="">All statuses</option><option value="PENDING">Pending</option><option value="SUBMITTED">Submitted</option><option value="CONFIRMED">Confirmed</option><option value="FAILED">Failed</option></select></label><label><span class="ts-label">Type</span><select class="ts-select" id="chain-type"><option value="">All transaction types</option><option value="MINT">Mint</option><option value="TRANSFER">Transfer</option><option value="RESALE">Resale</option></select></label></div>
  <div class="ts-table-wrap"><table class="ts-table"><thead><tr><th>Transaction hash</th><th>Receiver wallet</th><th>Type / ticket</th><th>Status</th><th>Recorded at</th><th>Action</th></tr></thead><tbody id="tx-table-body"><tr><td colspan="6" class="text-center secondary">Loading…</td></tr></tbody></table></div>
</div>
<p class="small secondary mt-20">Firebase saves the full hash in <code>BlockchainTransactions.transactionHash</code>. Mint hashes also appear in <code>NFTTickets.transactionHash</code>; the latest operation is in <code>NFTTickets.blockchainLastTransactionHash</code>. Sepolia gas uses test ETH. Ticket payments remain simulated.</p>
  </div>
  <div class="ts-tab-panel<?=$nftTab ? ' active' : ''?>" data-panel="nft">
    <?php require __DIR__ . '/partials/nft-ticket-list.php'; ?>
  </div>
</div>
</div>
<script src="<?=ts_asset_url('assets/js/blockchain-wallet.js', '..')?>"></script>
<script type="module" src="<?=ts_asset_url('assets/js/organizer-blockchain.js', '..')?>"></script>
<script type="module" src="<?=ts_asset_url('assets/js/organizer-demo-funding.js', '..')?>"></script>
<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Blockchain History', 'blockchain', $content, '..', '');
?>
