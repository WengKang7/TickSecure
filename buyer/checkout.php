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

<script type="text/plain" data-legacy-checkout-script>
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

<script type="module">
const asAmount = value => {
    const amount = typeof value === 'number'
        ? value
        : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(amount) ? amount : 0;
};

const findCategory = (rawCategories, sectionId, sectionIdsByName = new Map()) => {
    const entries = Array.isArray(rawCategories)
        ? rawCategories.map((category, index) => [
            category?.sectionId ?? category?.id ?? category?.section ?? String(index),
            category
        ])
        : Object.entries(rawCategories || {});

    return entries.map(([key, category]) => {
        const legacySection = String(category?.sectionId ?? category?.id ?? category?.section ?? key ?? '').trim();
        const canonicalSectionId = sectionIdsByName.get(legacySection.toLowerCase()) || legacySection;
        return {
            sectionId: canonicalSectionId,
            name: String(category?.name ?? category?.categoryName ?? canonicalSectionId).trim() || canonicalSectionId,
            price: asAmount(category?.price ?? category?.unitPrice)
        };
    }).find(category => category.sectionId === sectionId) || null;
};

const reservationStorageKey = (eventId, sectionId, quantity) =>
    `ts-seat-reservation:${eventId}:${sectionId}:${quantity}`;

let initialized = false;
const initializeCheckout = async () => {
    if (initialized) return;
    initialized = true;

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = String(urlParams.get('eventId') || '').trim();
    const sectionId = String(urlParams.get('sectionId') || '').trim();
    const seatDocIds = [...new Set(String(urlParams.get('seatIds') || urlParams.get('seats') || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean))];
    const seatLabels = String(urlParams.get('seatLabels') || '')
        .split(',')
        .map(label => label.trim())
        .filter(Boolean);
    const reservationExpiry = String(urlParams.get('reservationExpiry') || '').trim();
    const expiresAt = Date.parse(reservationExpiry);
    const payButton = document.getElementById('btn-pay');
    const walletInfo = document.getElementById('wallet-info');
    const countdown = document.getElementById('countdown-timer');
    const contentGrid = document.querySelector('.ts-content-grid');

    const disablePayment = label => {
        payButton.disabled = true;
        payButton.textContent = label;
    };
    const showCheckoutError = message => {
        document.getElementById('order-summary-list').innerHTML = `<p class="secondary">${message}</p>`;
        walletInfo.textContent = message;
        disablePayment('Choose Tickets Again');
    };

    if (!eventId || !sectionId || !seatDocIds.length || !Number.isFinite(expiresAt)) {
        showCheckoutError('Your reservation details are missing. Return to ticket categories and try again.');
        return;
    }

    try {
        const event = await window.tsEvents.getEvent(eventId);
        if (!event?.venueId) throw new Error('The event is no longer available.');

        const venue = await window.tsVenues.getVenue(event.venueId);
        const sectionIdsByName = new Map();
        (venue?.sections || []).forEach(section => {
            const physicalSectionId = String(section.sectionId ?? '').trim();
            if (!physicalSectionId) return;
            sectionIdsByName.set(physicalSectionId.toLowerCase(), physicalSectionId);
            sectionIdsByName.set(String(section.name ?? '').trim().toLowerCase(), physicalSectionId);
        });

        const selectedCategory = findCategory(event.categories, sectionId, sectionIdsByName);
        if (!selectedCategory) throw new Error('The selected ticket category is no longer available.');

        const quantity = seatDocIds.length;
        const subtotal = selectedCategory.price * quantity;
        const serviceCharge = 20;
        const total = subtotal + serviceCharge;
        const seatDescription = seatLabels.length === quantity
            ? ` · Seats ${seatLabels.join(', ')}`
            : ` · ${quantity} auto-assigned seat${quantity === 1 ? '' : 's'}`;

        document.getElementById('order-summary-list').innerHTML = `
            <div class="ts-list-item">
                <div>
                    <div class="ts-list-title">${event.name || 'Event'}</div>
                    <div class="ts-list-sub">${selectedCategory.name} · Section ${sectionId}${seatDescription}</div>
                </div>
            </div>`;
        document.getElementById('subtotal').textContent = `RM${subtotal.toFixed(2)}`;
        document.getElementById('fee').textContent = `RM${serviceCharge.toFixed(2)}`;
        document.getElementById('total').textContent = `RM${total.toFixed(2)}`;

        const profile = window.tsCurrentUser || {};
        const hasWallet = Boolean(profile.walletAddress);
        if (hasWallet) {
            const wallet = profile.walletAddress;
            walletInfo.textContent = `Wallet ${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)} on file`;
            payButton.disabled = false;
            payButton.textContent = `Pay RM${total.toFixed(2)}`;
        } else {
            walletInfo.textContent = 'Connect a wallet before completing payment.';
            disablePayment('Wallet Required');
        }

        let released = false;
        const storageKey = reservationStorageKey(eventId, sectionId, quantity);
        const expireReservation = async () => {
            if (released) return;
            released = true;
            sessionStorage.removeItem(storageKey);
            disablePayment('Reservation Expired');
            walletInfo.textContent = 'Your seat reservation expired. Please choose tickets again.';
            try {
                await window.tsSeats.releaseSeats(seatDocIds, { eventId });
            } catch (error) {
                console.warn('Could not release the expired reservation:', error);
            }
        };
        const updateCountdown = () => {
            const remainingSeconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
            countdown.textContent = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;
            if (remainingSeconds <= 0) {
                clearInterval(timer);
                expireReservation();
            }
        };
        const timer = setInterval(updateCountdown, 1000);
        updateCountdown();

        payButton.addEventListener('click', async event => {
            event.preventDefault();
            if (payButton.disabled || released || Date.now() >= expiresAt) {
                if (Date.now() >= expiresAt) await expireReservation();
                return;
            }

            const validation = window.tsValidation;
            const form = document.getElementById('payment-form');
            const valid = validation.runAll([
                { check: () => validation.validateRequired(validation.val(form, 'cardName'), 'Card Name'), el: validation.el(form, 'cardName') },
                { check: () => validation.validateRequired(validation.val(form, 'cardNumber'), 'Card Number'), el: validation.el(form, 'cardNumber') }
            ]);
            if (!valid) return;

            payButton.disabled = true;
            payButton.textContent = 'Processing…';
            try {
                const booking = await window.tsBookings.createBooking({
                    eventId,
                    sectionId,
                    seatDocIds,
                    seatLabels,
                    walletAddress: profile.walletAddress,
                    paymentMethod: 'mock_card',
                    serviceCharge
                });
                sessionStorage.removeItem(storageKey);
                window.location.href = `booking-confirmation.php?bookingId=${encodeURIComponent(booking.id)}`;
            } catch (error) {
                validation.showGlobalError(contentGrid, 'Payment Error', error.message || 'Checkout could not be completed.');
                if (!released && Date.now() < expiresAt && hasWallet) {
                    payButton.disabled = false;
                    payButton.textContent = `Pay RM${total.toFixed(2)}`;
                }
            }
        });
    } catch (error) {
        console.error('Checkout loading failed:', error);
        showCheckoutError(error.message || 'Checkout could not be loaded.');
    }
};

window.addEventListener('ts-auth-ready', event => {
    if (event.detail) initializeCheckout();
});
if (window.tsCurrentUser) initializeCheckout();
</script>

<?php
$content = ob_get_clean();
render_public_page('Checkout', 'tickets', $content, '..', true);
?>
