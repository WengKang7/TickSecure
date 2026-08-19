<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container" style="max-width:900px">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Ownership transfer</div>
                <h1 class="ts-section-title">Transfer Ticket</h1>
                <p class="ts-section-copy">Transfer Aurora After Dark · VIP1 · Seat A06 to another eligible wallet.</p>
            </div>
        </div>
        <div class="ts-card ts-card-pad">
            <div class="ts-steps">
                <div class="ts-step active"><span class="ts-step-num">1</span>Recipient</div><span
                    class="ts-step-line"></span>
                <div class="ts-step"><span class="ts-step-num">2</span>Review</div><span class="ts-step-line"></span>
                <div class="ts-step"><span class="ts-step-num">3</span>Wallet Approval</div>
            </div>
            <div class="ts-field mt-24"><label class="ts-label">Recipient Wallet Address</label><input class="ts-input"
                    placeholder="0x...">
                <div class="ts-help">Check the recipient address carefully. Ownership changes are recorded on the
                    blockchain after confirmation.</div>
            </div>
            <div class="ts-alert ts-alert-info mt-20">
                <?=ts_icon('shield')?>
                <div><strong>Transfer eligible</strong>
                    <div class="small mt-8">This event currently permits ticket transfers and the ticket is valid,
                        unused and owned by your connected wallet.</div>
                </div>
            </div>
            <div class="flex justify-between mt-24"><a class="ts-btn ts-btn-secondary"
                    href="ticket-detail.php">Cancel</a><button class="ts-btn ts-btn-primary"
                    data-modal-open="confirm-modal">Review Transfer</button></div>
        </div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Transfer Ticket', 'tickets', $content, '..', true);
?>