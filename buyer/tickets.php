<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Digital ticket wallet</div>
                <h1 class="ts-section-title">My Tickets</h1>
                <p class="ts-section-copy">View active, transferred, used and resale-listed NFT tickets owned by your
                    connected wallet.</p>
            </div><a class="ts-btn ts-btn-secondary"
                href="wallet.php"><?=ts_icon('wallet')?>
                Wallet 0x12A4…8F92</a>
        </div>
        <div class="ts-tabs mb-24"><button class="ts-tab active">Active</button><button class="ts-tab">Listed for
                Resale</button><button class="ts-tab">Transferred</button><button class="ts-tab">Used</button><button
                class="ts-tab">Cancelled / Expired</button></div>
        <div class="ts-ticket-list"><a class="ts-ticket-card" href="ticket-detail.php">
                <div class="ts-ticket-thumb">Aurora<br>After Dark</div>
                <div class="ts-ticket-card-body">
                    <div class="flex justify-between">
                        <div class="ts-card-title">Aurora After Dark</div>
                        <?=ts_status('Valid', 'success')?>
                    </div>
                    <div class="small secondary mt-8">18 Oct 2026 · Merdeka Hall</div>
                    <div class="small mt-16"><strong>VIP1 · Seat A06</strong></div>
                </div>
            </a><a class="ts-ticket-card" href="ticket-detail.php">
                <div class="ts-ticket-thumb" style="background:#312226">Velvet<br>Hour</div>
                <div class="ts-ticket-card-body">
                    <div class="flex justify-between">
                        <div class="ts-card-title">Velvet Hour Live</div>
                        <?=ts_status('Valid', 'success')?>
                    </div>
                    <div class="small secondary mt-8">02 Nov 2026 · Axiata Arena</div>
                    <div class="small mt-16"><strong>CAT1 · Seat B08</strong></div>
                </div>
            </a><a class="ts-ticket-card" href="ticket-detail.php">
                <div class="ts-ticket-thumb" style="background:#E8EBEE;color:#17202B">Midnight<br>Resonance</div>
                <div class="ts-ticket-card-body">
                    <div class="flex justify-between">
                        <div class="ts-card-title">Midnight Resonance</div>
                        <?=ts_status('Listed', 'gold')?>
                    </div>
                    <div class="small secondary mt-8">21 Nov 2026 · Zepp KL</div>
                    <div class="small mt-16"><strong>VIP2 · Seat C04</strong></div>
                </div>
            </a></div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('My Tickets', 'tickets', $content, '..', true);
?>