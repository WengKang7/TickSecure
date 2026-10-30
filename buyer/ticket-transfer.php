<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight ts-transfer-page">
    <div class="ts-container">
        <a class="ts-record-back" href="ticket-transfers.php">&larr; My sent &amp; received transfers</a>
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Ownership transfer</div>
                <h1 class="ts-section-title">Transfer Ticket</h1>
                <p class="ts-section-copy" id="transfer-desc">Loading ticket details...</p>
            </div>
        </div>
        <div class="ts-alert ts-alert-error mb-24" id="transfer-error" role="alert" hidden></div>
        <section class="ts-transfer-receipt mb-24" id="transfer-ticket-summary" hidden>
            <div class="ts-transfer-receipt-heading"><div><span class="ts-transfer-kicker">Ticket to transfer</span><h2 id="transfer-event-name"></h2></div><span class="ts-chip ts-chip-success">Valid ticket</span></div>
            <dl class="ts-transfer-facts"><div><dt>Event date</dt><dd id="transfer-event-date"></dd></div><div><dt>Venue</dt><dd id="transfer-venue"></dd></div><div><dt>Category</dt><dd id="transfer-category"></dd></div><div><dt>Section / seat</dt><dd id="transfer-seat"></dd></div></dl>
            <div class="ts-transfer-person"><small class="ts-transfer-kicker">Sender (you)</small><strong id="transfer-sender-name"></strong><div class="ts-transfer-code" id="transfer-sender-wallet"></div></div>
            <dl class="ts-transfer-references"><div><dt>Ticket ID</dt><dd class="ts-transfer-code" id="transfer-ticket-id"></dd></div></dl>
        </section>
        <div class="ts-card ts-card-pad" id="transfer-form" hidden>
            <div class="ts-steps">
                <div class="ts-step active"><span class="ts-step-num">1</span>Recipient</div><span
                    class="ts-step-line"></span>
                <div class="ts-step"><span class="ts-step-num">2</span>Review</div><span class="ts-step-line"></span>
                <div class="ts-step"><span class="ts-step-num">3</span>Complete</div>
            </div>
            <div class="ts-field mt-24"><label class="ts-label" for="recipient-wallet">Receiver wallet address</label><input class="ts-input"
                    id="recipient-wallet" name="recipientWallet" placeholder="0x..." autocomplete="off" spellcheck="false">
                <div class="ts-help">Use the wallet saved by an active, verified TickSecure buyer. This demo updates
                    ticket ownership in TickSecure; it does not send a blockchain transaction.</div>
            </div>
            <div class="ts-alert ts-alert-info mt-20">
                <?=ts_icon('shield')?>
                <div><strong>Before you confirm</strong>
                    <div class="small mt-8">The receiver will become the ticket owner and can use it for entry. You will keep a transfer receipt, but the ticket will leave your account.</div>
                </div>
            </div>
            <div class="flex justify-between mt-24"><a class="ts-btn ts-btn-secondary"
                    href="#" id="btn-cancel">Cancel</a><button class="ts-btn ts-btn-primary"
                    id="btn-submit" type="button" disabled>Review transfer</button></div>
        </div>
        <section class="mt-24" aria-labelledby="transfer-history-heading">
            <div class="ts-transfer-page-heading"><div><h2 id="transfer-history-heading">Your transfers for this ticket</h2><p class="small secondary">Records where you were the sender or receiver.</p></div><button type="button" class="ts-btn ts-btn-secondary" id="transfer-history-refresh">Refresh history</button></div>
            <div class="ts-alert ts-alert-error mb-16" id="transfer-history-error" role="alert" hidden></div>
            <p class="secondary" id="transfer-history-loading" role="status">Loading transfers...</p>
            <p class="ts-transfer-empty" id="transfer-history-empty" hidden>No ticket transfers recorded yet.</p>
            <div class="ts-transfer-history-list" id="transfer-history-list"></div>
        </section>
    </div>
</main>

<script src="<?=ts_asset_url('assets/js/ticket-display.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/transfer-display.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/ticket-transfer-history.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/ticket-transfer.js', '..')?>"></script>

<?php
$content = ob_get_clean();
render_public_page('Transfer Ticket', 'tickets', $content, '..', true);
?>
