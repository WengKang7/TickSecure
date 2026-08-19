<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container" style="max-width:1000px">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Official resale</div>
                <h1 class="ts-section-title">Create Resale Listing</h1>
                <p class="ts-section-copy">Only eligible, currently owned and unused NFT tickets can be listed.</p>
            </div>
        </div>
        <div class="ts-card ts-card-pad">
            <div class="ts-steps">
                <div class="ts-step done"><span class="ts-step-num">✓</span>Ticket</div><span
                    class="ts-step-line"></span>
                <div class="ts-step active"><span class="ts-step-num">2</span>Price</div><span
                    class="ts-step-line"></span>
                <div class="ts-step"><span class="ts-step-num">3</span>Wallet Approval</div>
            </div>
            <div class="ts-grid-2 mt-24">
                <div>
                    <div class="ts-card ts-card-pad">
                        <div class="ts-card-title">Midnight Resonance</div>
                        <div class="small secondary mt-8">VIP2 · Seat C04 · Ticket TS-TK-0048</div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Current owner</div>
                            <div class="ts-detail-value ts-wallet-id">0x12A4…8F92</div>
                        </div>
                        <?=ts_status('Eligible', 'success')?>
                    </div>
                    <div class="ts-alert ts-alert-info mt-16">
                        <?=ts_icon('shield')?>
                        <div><strong>Organizer resale rules</strong>
                            <div class="small mt-8">Resale is active until 20 Nov 2026 · Maximum allowed price RM570.
                            </div>
                        </div>
                    </div>
                </div>
                <div>
                    <div class="ts-field"><label class="ts-label">Resale Price (RM)</label><input class="ts-input"
                            value="540.00">
                        <div class="ts-help">Original price RM518 · Maximum RM570</div>
                    </div>
                    <div class="ts-card ts-card-pad mt-16">
                        <div class="ts-summary-row"><span>Original price</span><strong>RM518</strong></div>
                        <div class="ts-summary-row"><span>Your resale price</span><strong>RM540</strong></div>
                        <div class="ts-summary-row"><span>Maximum allowed</span><strong>RM570</strong></div>
                        <div class="ts-alert ts-alert-success mt-12">
                            <?=ts_icon('check')?>
                            Price is within the organizer-defined limit.</div>
                    </div>
                </div>
            </div>
            <div class="flex justify-between mt-24"><a class="ts-btn ts-btn-secondary"
                    href="tickets.php">Cancel</a><button class="ts-btn ts-btn-primary"
                    data-modal-open="confirm-modal">Continue to Wallet Approval</button></div>
        </div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Create Resale Listing', 'resale', $content, '..', true);
?>