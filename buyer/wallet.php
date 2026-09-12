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
                </div><button class="ts-btn ts-btn-primary" id="btn-connect">Connect
                    Wallet</button>
            </div>
            <div class="ts-divider"></div>
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
                    <div class="ts-detail-value">Supported Test Network</div>
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
            <div class="flex justify-between mt-24"><a class="ts-btn ts-btn-secondary"
                    href="dashboard.php" id="btn-back">Back</a><a class="ts-btn ts-btn-primary" href="#" id="btn-continue" style="display:none">Continue</a></div>
        </div>
    </div>
</main>

<script type="module">
window.addEventListener('ts-auth-ready', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    
    if (redirect) {
        document.getElementById('btn-back').href = redirect;
    }
    
    const curUser = window.tsCurrentUser || {};
    const walletAddress = curUser.walletAddress;
    
    const render = (addr) => {
        if (addr) {
            document.getElementById('val-status').innerHTML = '<span class="ts-chip ts-chip-success">Connected</span>';
            document.getElementById('val-address').textContent = addr;
            document.getElementById('val-sync').innerHTML = '<span class="ts-chip ts-chip-success">Ready</span>';
            
            document.getElementById('btn-connect').textContent = 'Reconnect';
            
            if (redirect) {
                const btn = document.getElementById('btn-continue');
                btn.href = redirect;
                btn.style.display = 'block';
            }
        } else {
            document.getElementById('val-status').innerHTML = '<span class="ts-chip ts-chip-warning">Not Connected</span>';
            document.getElementById('val-address').textContent = '—';
            document.getElementById('val-sync').innerHTML = '<span class="ts-chip ts-chip-warning">Pending</span>';
        }
    };
    
    render(walletAddress);
    
    document.getElementById('btn-connect').addEventListener('click', async () => {
        try {
            if (!window.ethereum?.request) {
                throw new Error('No compatible wallet was detected. Install or unlock an Ethereum wallet such as MetaMask.');
            }
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const newAddr = String(accounts?.[0] || '').trim();
            if (!/^0x[a-fA-F0-9]{40}$/.test(newAddr)) {
                throw new Error('The connected wallet did not return a valid Ethereum address.');
            }
            await window.tsUsers.updateProfile(curUser.uid, { walletAddress: newAddr });
            curUser.walletAddress = newAddr;
            render(newAddr);
        } catch (e) {
            console.error('Wallet error', e);
            window.alert(e?.message || 'Unable to connect the wallet.');
        }
    });
});
</script>

<?php
$content = ob_get_clean();
render_public_page('Wallet Connection', 'tickets', $content, '..', true);
?>
