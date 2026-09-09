<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container">
        <div class="ts-steps">
            <div class="ts-step done"><span class="ts-step-num">✓</span>Category</div><span class="ts-step-line"></span>
            <div class="ts-step done"><span class="ts-step-num">✓</span>Seat Assignment</div><span
                class="ts-step-line"></span>
            <div class="ts-step done"><span class="ts-step-num">✓</span>Wallet</div><span class="ts-step-line"></span>
            <div class="ts-step active"><span class="ts-step-num">4</span>Payment</div>
        </div>
        <div class="ts-content-grid">
            <div>
                <div class="ts-card ts-card-pad">
                    <div class="ts-card-title">Payment method</div>
                    <p class="secondary">Choose a supported payment method. This UI is visual only and does not submit
                        payment information.</p>
                    <div class="ts-role-choice mt-20">
                        <div class="ts-role-card active"><strong>Card Payment</strong><span>Visa / Mastercard /
                                supported gateway</span></div>
                        <div class="ts-role-card"><strong>Online Banking</strong><span>Secure redirect through payment
                                gateway</span></div>
                    </div>
                    <div class="ts-form-grid mt-24" id="payment-form">
                        <div class="ts-field span-2"><label class="ts-label">Cardholder Name</label><input
                                class="ts-input" name="cardName" placeholder="Name on card"></div>
                        <div class="ts-field span-2"><label class="ts-label">Card Number</label><input class="ts-input"
                                name="cardNumber" placeholder="•••• •••• •••• ••••"></div>
                        <div class="ts-field"><label class="ts-label">Expiry</label><input class="ts-input"
                                name="cardExpiry" placeholder="MM / YY"></div>
                        <div class="ts-field"><label class="ts-label">Security Code</label><input class="ts-input"
                                name="cardCvc" placeholder="CVC"></div>
                    </div>
                    <div class="ts-alert ts-alert-info mt-20">
                        <?=ts_icon('lock')?>
                        <div><strong>Secure payment processing</strong>
                            <div class="small mt-8">Payment data is intended to be handled by the configured payment
                                gateway rather than stored directly by TickSecure.</div>
                        </div>
                    </div>
                </div>
            </div>
            <aside>
                <div class="ts-card ts-card-pad ts-order-summary">
                    <div class="ts-reservation-bar">
                        <span><?=ts_icon('clock')?>
                            Reservation</span><span class="ts-reservation-time" id="countdown-timer">10:00</span></div>
                    <div class="ts-card-title">Order summary</div>
                    <div class="ts-list mt-12" id="order-summary-list">
                        <p class="secondary">Loading...</p>
                    </div>
                    <div class="ts-summary-row"><span>Ticket subtotal</span><strong id="subtotal">-</strong></div>
                    <div class="ts-summary-row"><span>Service charge</span><strong id="fee">RM20.00</strong></div>
                    <div class="ts-summary-row total"><span>Total</span><span id="total">-</span></div><button
                        class="ts-btn ts-btn-primary w-full mt-16" id="btn-pay">Pay</button>
                    <div class="small muted text-center mt-12" id="wallet-info">Checking wallet...</div>
                </div>
            </aside>
        </div>
</div>
</main>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    const sectionId = urlParams.get('sectionId');
    const qty = parseInt(urlParams.get('qty') || '1', 10);
    const seatsStr = urlParams.get('seats') || '';
    
    if (!eventId) return;

    try {
        const event = await window.tsEvents.getEvent(eventId);
        const selectedCat = (event.categories || []).find(c => c.sectionId === sectionId || c.id === sectionId);
        const price = selectedCat ? parseFloat(selectedCat.price) : 0;
        
        const subtotal = price * qty;
        const total = subtotal + 20;

        document.getElementById('order-summary-list').innerHTML = \`
            <div class="ts-list-item">
                <div>
                    <div class="ts-list-title">\${event.name}</div>
                    <div class="ts-list-sub">\${selectedCat ? selectedCat.name : ''} · Section \${sectionId} · \${qty} Seat(s)</div>
                </div>
            </div>
        \`;
        
        document.getElementById('subtotal').textContent = \`RM\${subtotal.toFixed(2)}\`;
        document.getElementById('total').textContent = \`RM\${total.toFixed(2)}\`;
        
        const btnPay = document.getElementById('btn-pay');
        btnPay.textContent = \`Pay RM\${total.toFixed(2)}\`;

        const profile = window.tsCurrentUser;
        if (profile.walletAddress) {
            document.getElementById('wallet-info').textContent = \`Wallet \${profile.walletAddress.substring(0, 6)}...\${profile.walletAddress.substring(profile.walletAddress.length - 4)} · Network verified\`;
        }

        let timeLeft = 600;
        const timer = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) clearInterval(timer);
            const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            const s = (timeLeft % 60).toString().padStart(2, '0');
            document.getElementById('countdown-timer').textContent = \`\${m}:\${s}\`;
        }, 1000);

        btnPay.addEventListener('click', async (e) => {
            e.preventDefault();
            const V = window.tsValidation;
            const form = document.getElementById('payment-form');
            // Simplified validation for mockup
            const ok = V.runAll([
                { check: () => V.validateRequired(V.val(form, 'cardName'), 'Card Name'), el: V.el(form, 'cardName') },
                { check: () => V.validateRequired(V.val(form, 'cardNumber'), 'Card Number'), el: V.el(form, 'cardNumber') }
            ]);
            
            if (!ok) return;

            btnPay.disabled = true;
            btnPay.textContent = 'Processing...';

            try {
                const booking = await window.tsBookings.createBooking({
                    eventId,
                    sectionId,
                    qty,
                    seatIds: seatsStr.split(','),
                    totalAmount: total,
                    walletAddress: profile.walletAddress
                });
                
                window.location.href = \`booking-confirmation.php?bookingId=\${booking.id}\`;
            } catch (err) {
                V.showGlobalError(document.querySelector('.ts-content-grid'), 'Payment Error', err.message);
                btnPay.disabled = false;
                btnPay.textContent = \`Pay RM\${total.toFixed(2)}\`;
            }
        });
        
    } catch (err) {
        console.error(err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_public_page('Checkout', 'tickets', $content, '..', true);
?>