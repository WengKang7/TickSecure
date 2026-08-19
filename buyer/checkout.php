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
                    <div class="ts-form-grid mt-24">
                        <div class="ts-field span-2"><label class="ts-label">Cardholder Name</label><input
                                class="ts-input" placeholder="Name on card"></div>
                        <div class="ts-field span-2"><label class="ts-label">Card Number</label><input class="ts-input"
                                placeholder="•••• •••• •••• ••••"></div>
                        <div class="ts-field"><label class="ts-label">Expiry</label><input class="ts-input"
                                placeholder="MM / YY"></div>
                        <div class="ts-field"><label class="ts-label">Security Code</label><input class="ts-input"
                                placeholder="CVC"></div>
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
                            Reservation</span><span class="ts-reservation-time" data-countdown="521">08:41</span></div>
                    <div class="ts-card-title">Order summary</div>
                    <div class="ts-list mt-12">
                        <div class="ts-list-item">
                            <div>
                                <div class="ts-list-title">Aurora After Dark</div>
                                <div class="ts-list-sub">VIP1 · Section A · Seat A06</div>
                            </div>
                        </div>
                    </div>
                    <div class="ts-summary-row"><span>Ticket subtotal</span><strong>RM688.00</strong></div>
                    <div class="ts-summary-row"><span>Service charge</span><strong>RM20.00</strong></div>
                    <div class="ts-summary-row total"><span>Total</span><span>RM708.00</span></div><a
                        class="ts-btn ts-btn-primary w-full mt-16" href="booking-confirmation.php">Pay RM708.00</a>
                    <div class="small muted text-center mt-12">Wallet 0x12A4…8F92 · Network verified</div>
                </div>
            </aside>
        </div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Checkout', 'tickets', $content, '..', true);
?>