<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

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
        <div class="ts-card ts-card-pad">
            <div class="ts-alert ts-alert-error mb-20" id="wallet-error" role="alert" hidden></div>
            <p class="small secondary" id="wallet-reservation-note" aria-live="polite"></p>
            <div class="ts-wallet-card">
                <div class="flex items-center gap-12"><span
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
            <div class="ts-alert ts-alert-info mt-20">
                <?=ts_icon('shield')?>
                <div><strong>Security note</strong>
                    <div class="small mt-8">TickSecure only asks you to approve wallet connection, signatures and
                        ticket-related transactions. Never enter a wallet private key into this platform.</div>
                </div>
            </div>
            <a class="ts-btn ts-btn-secondary mt-20" href="blockchain.php">My blockchain transactions</a><p class="small secondary mt-12">Mint and transfer ticket NFTs from your own MetaMask wallet on Sepolia. Each NFT transaction needs your approval and Sepolia test ETH for gas.</p>
            <div class="flex justify-between mt-24"><a class="ts-btn ts-btn-secondary"
                    href="tickets.php" id="btn-back">Back to My Tickets</a><a class="ts-btn ts-btn-primary" href="#" id="btn-continue" style="display:none">Continue</a></div>
        </div>
    </div>
</main>

<script type="module" src="<?=ts_asset_url('assets/js/wallet.js', '..')?>"></script>

<?php
$content = ob_get_clean();
render_public_page('My Wallet', 'wallet', $content, '..', true);
?>
