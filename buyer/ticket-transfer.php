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
                <p class="ts-section-copy" id="transfer-desc">Loading ticket details...</p>
            </div>
        </div>
        <div class="ts-card ts-card-pad" id="transfer-form">
            <div class="ts-steps">
                <div class="ts-step active"><span class="ts-step-num">1</span>Recipient</div><span
                    class="ts-step-line"></span>
                <div class="ts-step"><span class="ts-step-num">2</span>Review</div><span class="ts-step-line"></span>
                <div class="ts-step"><span class="ts-step-num">3</span>Wallet Approval</div>
            </div>
            <div class="ts-field mt-24"><label class="ts-label">Recipient Wallet Address</label><input class="ts-input"
                    name="recipientWallet" placeholder="0x...">
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
                    href="#" id="btn-cancel">Cancel</a><button class="ts-btn ts-btn-primary"
                    id="btn-submit">Review Transfer</button></div>
        </div>
    </div>
</main>

<script type="module">
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('ts-auth-ready', async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const ticketId = urlParams.get('ticketId');
        if (!ticketId) return;

        try {
            const ticket = await window.tsTickets.getTicket(ticketId);
            document.getElementById('transfer-desc').textContent = `Transfer ${ticket.eventName} · ${ticket.categoryName || 'N/A'} · Seat ${ticket.seatId || 'N/A'} to another eligible wallet.`;
            document.getElementById('btn-cancel').href = `ticket-detail.php?id=${ticket.id}`;
            
            const form = document.getElementById('transfer-form');
            const submitBtn = document.getElementById('btn-submit');
            
            submitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const V = window.tsValidation;
                V.clearFieldErrors(form);

                const ok = V.runAll([
                    { check: () => V.validateRequired(V.val(form, 'recipientWallet'), 'Recipient Wallet'), el: V.el(form, 'recipientWallet') },
                    { check: () => V.validateWalletAddress(V.val(form, 'recipientWallet')), el: V.el(form, 'recipientWallet') }
                ]);
                if (!ok) return;

                submitBtn.disabled = true;
                submitBtn.textContent = 'Transferring...';
                try {
                    await window.tsTickets.transferTicket(ticket.id, V.val(form, 'recipientWallet'));
                    window.location.href = `ticket-detail.php?id=${ticket.id}`;
                } catch (err) {
                    V.showGlobalError(form, 'Transfer Error', err.message);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Review Transfer';
                }
            });
            
        } catch (err) {
            console.error('Load error:', err);
        }
    });
});
</script>

<?php
$content = ob_get_clean();
render_public_page('Transfer Ticket', 'tickets', $content, '..', true);
?>
