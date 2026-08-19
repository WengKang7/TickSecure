<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container" style="max-width:920px">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Ownership security</div>
                <h1 class="ts-section-title">Connect your wallet</h1>
                <p class="ts-section-copy">TickSecure uses the connected wallet to assign and verify NFT ticket
                    ownership. Private keys are never requested or stored.</p>
            </div>
        </div>
        <div class="ts-card ts-card-pad">
            <div class="ts-wallet-card">
                <div class="flex items-center gap-12"><span
                        class="ts-kpi-icon"><?=ts_icon('wallet', 'ts-icon-lg')?></span>
                    <div>
                        <div class="ts-card-title">MetaMask</div>
                        <div class="small muted">Supported Ethereum-compatible wallet</div>
                    </div>
                </div><button class="ts-btn ts-btn-primary" data-toast="Wallet connected in UI preview">Connect
                    Wallet</button>
            </div>
            <div class="ts-divider"></div>
            <div class="ts-detail-grid">
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Connection status</div>
                    <div class="ts-detail-value">
                        <?=ts_status('Connected', 'success')?>
                    </div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Wallet address</div>
                    <div class="ts-detail-value ts-wallet-id">0x12A4…8F92</div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Network</div>
                    <div class="ts-detail-value">Supported Test Network</div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Ownership sync</div>
                    <div class="ts-detail-value">
                        <?=ts_status('Ready', 'success')?>
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
            <div class="flex justify-between mt-24"><a class="ts-btn ts-btn-secondary"
                    href="seat-assignment.php">Back</a><a class="ts-btn ts-btn-primary" href="checkout.php">Continue to
                    Payment</a></div>
        </div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Wallet Connection', 'tickets', $content, '..', true);
?>