<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight ts-checkout-page">
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
                    <p class="secondary">This is a demo payment. No money is charged and no card details are collected.</p>
                    <div class="ts-alert ts-alert-info mt-20"><?=ts_icon('lock')?><div><strong>Simulated payment</strong><div class="small mt-8">Confirming creates a demo booking and tickets in your account. Blockchain minting is not performed.</div></div></div>
                    <div class="ts-alert ts-alert-error mt-20" id="checkout-error" role="alert" hidden></div>
                    <div class="ts-field mt-20"><label class="ts-label" for="demo-payment-outcome">Demo payment result</label><select class="ts-select" id="demo-payment-outcome"><option value="success">Successful payment</option><option value="decline">Declined payment (test)</option></select></div>
                    <label class="ts-event-demo-consent mt-20"><input type="checkbox" id="demo-payment-consent"> I understand this is a simulated payment.</label>
                    <a class="ts-btn ts-btn-secondary mt-20" id="checkout-back" href="../public/events.php">Change tickets</a>
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
                        class="ts-btn ts-btn-primary w-full mt-16" id="btn-pay" type="button" disabled>Loading checkout...</button>
                    <div class="small muted text-center mt-12" id="wallet-info">Checking wallet...</div>
                </div>
            </aside>
        </div>
</div>
</main>

<script type="module" src="<?=ts_asset_url('assets/js/checkout.js', '..')?>"></script>

<?php
$content = ob_get_clean();
render_public_page('Checkout', 'tickets', $content, '..', true);
?>
