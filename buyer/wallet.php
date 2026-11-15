<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<style>
    body .ts-wallet-page .ts-wallet-panel { display: grid; gap: 24px; padding: 28px; }
    body .ts-wallet-page .ts-wallet-panel > p { margin: 0; }
    body .ts-wallet-page #wallet-reservation-note:empty { display: none; }
    body .ts-wallet-page .ts-wallet-card { gap: 20px; padding: 20px; border-radius: 10px; }
    body .ts-wallet-page .ts-wallet-provider { display: flex; align-items: center; gap: 14px; min-width: 0; }
    body .ts-wallet-page .ts-wallet-provider .ts-kpi-icon { flex-shrink: 0; }
    body .ts-wallet-page #btn-connect { flex-shrink: 0; }
    body .ts-wallet-page .ts-divider { margin: 0; }
    body .ts-wallet-page .ts-detail-grid { column-gap: 32px; }
    body .ts-wallet-page .ts-detail-item { min-width: 0; padding: 16px 0; }
    body .ts-wallet-page .ts-detail-item:nth-last-child(-n+2) { border-bottom: 0; }
    body .ts-wallet-page .ts-detail-label { margin-bottom: 8px; }
    body .ts-wallet-page .ts-detail-value { overflow-wrap: anywhere; }
    body .ts-wallet-page .ts-wallet-security { margin: 0; }
    body .ts-wallet-page .ts-wallet-transactions { display: flex; align-items: center; gap: 24px; }
    body .ts-wallet-page .ts-wallet-transactions > a { flex-shrink: 0; }
    body .ts-wallet-page .ts-wallet-transactions > p { margin: 0; line-height: 1.65; }
    body .ts-wallet-page .ts-wallet-navigation { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-top: 24px; border-top: 1px solid var(--border-default); }
    @media (max-width: 600px) {
        body .ts-wallet-page .ts-wallet-panel { padding: 20px; gap: 20px; }
        body .ts-wallet-page .ts-wallet-card { align-items: stretch; flex-direction: column; }
        body .ts-wallet-page .ts-detail-grid { grid-template-columns: minmax(0, 1fr); }
        body .ts-wallet-page .ts-detail-item:nth-last-child(2) { border-bottom: 1px solid #F2F4F7; }
        body .ts-wallet-page .ts-wallet-transactions { align-items: stretch; flex-direction: column; gap: 12px; }
        body .ts-wallet-page .ts-wallet-navigation > a { flex: 1 1 100%; }
    }
</style>

<main class="ts-section-tight ts-wallet-page">
    <div class="ts-container" style="max-width:920px">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Ownership security</div>
                <h1 class="ts-section-title" id="wallet-page-title">My wallet</h1>
                <p class="ts-section-copy">TickSecure uses the connected wallet to assign and verify NFT ticket
                    ownership. Private keys are never requested or stored.</p>
            </div>
        </div>
        <div class="ts-card ts-card-pad ts-wallet-panel">
            <div class="ts-alert ts-alert-error mb-20" id="wallet-error" role="alert" hidden></div>
            <p class="small secondary" id="wallet-reservation-note" aria-live="polite"></p>
            <p class="small secondary" id="wallet-funding-status" role="status" aria-live="polite">Eligible verified buyers can receive 0.0001 SepoliaETH once per event organizer when submitting a ticket NFT operation. Your organizer supplies the demo gas.</p>
            <div class="ts-wallet-card">
                <div class="ts-wallet-provider"><span
                        class="ts-kpi-icon"><?=ts_icon('wallet', 'ts-icon-lg')?></span>
                    <div>
                        <div class="ts-card-title">MetaMask</div>
                        <div class="small muted">Supported Ethereum-compatible wallet</div>
                    </div>
                </div><button class="ts-btn ts-btn-primary" id="btn-connect">Connect
                    Wallet</button>
            </div>
            <a class="ts-btn ts-btn-secondary mt-16" id="wallet-install" href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" hidden>Get MetaMask</a><div class="ts-divider"></div>
            <div class="ts-detail-grid">
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Connection status</div>
                    <div class="ts-detail-value" id="val-status">
                        <span class="ts-chip ts-chip-warning">Not Connected</span>
                    </div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Wallet address</div>
                    <div class="ts-detail-value ts-wallet-id" id="val-address">...</div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Network</div>
                    <div class="ts-detail-value" id="wallet-network">No transaction required for demo checkout</div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Ownership sync</div>
                    <div class="ts-detail-value" id="val-sync">
                        <span class="ts-chip ts-chip-warning">Pending</span>
                    </div>
                </div>
            </div>
            <div class="ts-alert ts-alert-info ts-wallet-security">
                <?=ts_icon('shield')?>
                <div><strong>Security note</strong>
                    <div class="small mt-8">TickSecure only asks you to approve wallet connection, signatures and
                        ticket-related transactions. Never enter a wallet private key into this platform.</div>
                </div>
            </div>
            <div class="ts-wallet-transactions">
                <a class="ts-btn ts-btn-secondary" href="blockchain.php">My blockchain transactions</a>
                <p class="small secondary">Mint and transfer ticket NFTs from your own MetaMask wallet on Sepolia. Each NFT transaction needs your approval and Sepolia test ETH for gas.</p>
            </div>
            <div class="ts-wallet-navigation"><a class="ts-btn ts-btn-secondary"
                    href="tickets.php" id="btn-back">Back to My Tickets</a><a class="ts-btn ts-btn-primary" href="#" id="btn-continue" style="display:none">Continue</a></div>
        </div>
    </div>
</main>

<script type="module" src="<?=ts_asset_url('assets/js/wallet.js', '..')?>"></script>

<?php
$content = ob_get_clean();
render_public_page('My Wallet', 'wallet', $content, '..', true);
?>
