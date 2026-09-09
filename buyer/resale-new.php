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
        <div class="ts-card ts-card-pad" id="resale-form-container">
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
                        <div class="ts-card-title" id="val-event">Loading...</div>
                        <div class="small secondary mt-8" id="val-ticket-info">...</div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Current owner</div>
                            <div class="ts-detail-value ts-wallet-id" id="val-owner">...</div>
                        </div>
                        <div id="val-status"></div>
                    </div>
                    <div class="ts-alert ts-alert-info mt-16">
                        <?=ts_icon('shield')?>
                        <div><strong>Organizer resale rules</strong>
                            <div class="small mt-8" id="val-rules">Loading rules...</div>
                        </div>
                    </div>
                </div>
                <div>
                    <div class="ts-field"><label class="ts-label">Resale Price (RM)</label><input class="ts-input"
                            name="resalePrice" id="input-price" value="">
                        <div class="ts-help" id="val-price-help">Loading limits...</div>
                    </div>
                    <div class="ts-card ts-card-pad mt-16">
                        <div class="ts-summary-row"><span>Original price</span><strong id="summary-original">...</strong></div>
                        <div class="ts-summary-row"><span>Your resale price</span><strong id="summary-resale">...</strong></div>
                        <div class="ts-summary-row"><span>Maximum allowed</span><strong id="summary-max">...</strong></div>
                        <div class="ts-alert ts-alert-success mt-12" id="price-alert" style="display:none">
                            <?=ts_icon('check')?>
                            <span id="price-alert-text">Price is within the organizer-defined limit.</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex justify-between mt-24"><a class="ts-btn ts-btn-secondary"
                    href="tickets.php" id="btn-cancel">Cancel</a><button class="ts-btn ts-btn-primary"
                    id="btn-submit">Continue to Wallet Approval</button></div>
        </div>
    </div>
</main>

<script type="module">
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('ts-auth-ready', async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const ticketId = urlParams.get('ticketId');
        if (!ticketId) return;

        let ticket, eventRules;
        let originalPrice = 0;
        let maxAllowedPrice = 0;

        try {
            ticket = await window.tsTickets.getTicket(ticketId);
            const event = await window.tsEvents.getEvent(ticket.eventId);
            
            document.getElementById('val-event').textContent = ticket.eventName;
            document.getElementById('val-ticket-info').textContent = \`\${ticket.category} · Seat \${ticket.seat} · Ticket \${ticket.id}\`;
            document.getElementById('val-owner').textContent = ticket.ownerWallet || window.tsCurrentUser.walletAddress;
            document.getElementById('val-status').innerHTML = \`<span class="ts-chip ts-chip-success">Eligible</span>\`;
            
            // Mock event rules if not present
            eventRules = event.resaleRules || { maxMarkupPercent: 10 };
            
            // For mockup, assume a category price based on ticket
            originalPrice = ticket.price || 518;
            maxAllowedPrice = originalPrice * (1 + (eventRules.maxMarkupPercent / 100));
            
            document.getElementById('val-rules').textContent = \`Maximum allowed markup is \${eventRules.maxMarkupPercent}%. Maximum allowed price RM\${maxAllowedPrice.toFixed(2)}.\`;
            document.getElementById('val-price-help').textContent = \`Original price RM\${originalPrice.toFixed(2)} · Maximum RM\${maxAllowedPrice.toFixed(2)}\`;
            
            document.getElementById('summary-original').textContent = \`RM\${originalPrice.toFixed(2)}\`;
            document.getElementById('summary-max').textContent = \`RM\${maxAllowedPrice.toFixed(2)}\`;
            
            document.getElementById('btn-cancel').href = \`ticket-detail.php?id=\${ticketId}\`;
            
            const priceInput = document.getElementById('input-price');
            priceInput.value = originalPrice.toFixed(2);
            document.getElementById('summary-resale').textContent = \`RM\${originalPrice.toFixed(2)}\`;
            
            priceInput.addEventListener('input', () => {
                const p = parseFloat(priceInput.value) || 0;
                document.getElementById('summary-resale').textContent = \`RM\${p.toFixed(2)}\`;
                const alertBox = document.getElementById('price-alert');
                const alertText = document.getElementById('price-alert-text');
                
                alertBox.style.display = 'flex';
                if (p > 0 && p <= maxAllowedPrice) {
                    alertBox.className = 'ts-alert ts-alert-success mt-12';
                    alertText.textContent = 'Price is within the organizer-defined limit.';
                } else {
                    alertBox.className = 'ts-alert ts-alert-error mt-12';
                    alertText.textContent = 'Price exceeds maximum allowed or is invalid.';
                }
            });

            const submitBtn = document.getElementById('btn-submit');
            submitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const p = parseFloat(priceInput.value);
                if (!p || p <= 0 || p > maxAllowedPrice) {
                    window.tsValidation.showGlobalError(document.getElementById('resale-form-container'), 'Invalid Price', \`Price must be between RM1 and RM\${maxAllowedPrice.toFixed(2)}\`);
                    return;
                }
                
                submitBtn.disabled = true;
                submitBtn.textContent = 'Processing...';
                
                try {
                    await window.tsResale.createListing({
                        ticketId: ticket.id,
                        resalePrice: p,
                        originalPrice,
                        maxAllowedPrice
                    });
                    window.location.href = 'resale.php';
                } catch (err) {
                    window.tsValidation.showGlobalError(document.getElementById('resale-form-container'), 'Error', err.message);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Continue to Wallet Approval';
                }
            });
            
        } catch (err) {
            console.error(err);
        }
    });
});
</script>

<?php
$content = ob_get_clean();
render_public_page('Create Resale Listing', 'resale', $content, '..', true);
?>