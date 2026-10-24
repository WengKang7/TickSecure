const el = id => document.getElementById(id);
const validId = value => /^[A-Za-z0-9_-]{1,160}$/.test(value);
const money = amount => 'RM' + Number(amount).toFixed(2);
let initialized = false;
window.addEventListener('ts-auth-ready', async () => {
    if (initialized || !window.tsCurrentUser?.uid) return;
    initialized = true;
    const user = window.tsCurrentUser;
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('eventId') || '';
    const sectionId = params.get('sectionId') || '';
    const seatDocIds = (params.get('seatIds') || '').split(',').filter(Boolean);
    const expiresAt = Date.parse(params.get('reservationExpiry') || '');
    const quantity = Number(params.get('qty'));
    let processing = false, completed = false, expired = false, ready = false;
    let total = 0;
    let timer;
    const storageKey = `ts-seat-reservation:${user.uid}:${eventId}:${sectionId}:${quantity}`;
    const selection = new URL('../public/event-detail.php', window.location.href);
    selection.search = new URLSearchParams({ id: eventId, sectionId, qty: String(quantity || 1) });
    el('checkout-back').href = validId(eventId) ? selection.href : '../public/events.php';
    function error(message) {
        el('checkout-error').textContent = message;
        el('checkout-error').hidden = false;
    }
    function updatePaymentButton() {
        const consent = el('demo-payment-consent').checked;
        el('btn-pay').disabled = !ready || !consent || processing || expired || completed;
        el('btn-pay').textContent = completed ? 'Payment confirmed' : processing ? 'Processing demo payment...' : expired ? 'Reservation expired'
            : ready ? `Confirm simulated payment ${money(total)}` : 'Checkout unavailable';
    }
    async function expire() {
        if (expired || completed || processing) return;
        expired = true;
        clearInterval(timer);
        updatePaymentButton();
        error('Your reservation expired. Change tickets to reserve seats again.');
        try { sessionStorage.removeItem(storageKey); } catch (_) {}
        try { await window.tsSeats.releaseSeats(seatDocIds, { eventId }); } catch (_) { /* Server also reclaims expired seats. */ }
    }
    function tick() {
        const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        el('countdown-timer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        if (seconds <= 0) expire();
    }
    el('demo-payment-consent').addEventListener('change', updatePaymentButton);
    el('checkout-back').addEventListener('click', async event => {
        if (!validId(eventId) || !seatDocIds.length) return;
        if (processing) { event.preventDefault(); return; }
        event.preventDefault();
        try {
            await window.tsSeats.releaseSeats(seatDocIds, { eventId });
            try { sessionStorage.removeItem(storageKey); } catch (_) {}
            clearInterval(timer);
            window.location.href = el('checkout-back').href;
        } catch (failure) { error(failure.message || 'Could not release seats. Please try again.'); }
    });
    try {
        if (!validId(eventId) || !validId(sectionId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20
            || seatDocIds.length !== quantity || new Set(seatDocIds).size !== quantity || !seatDocIds.every(validId)
            || !Number.isFinite(expiresAt)) throw Error('Your reservation link is incomplete. Change tickets to try again.');
        if (expiresAt <= Date.now()) { await expire(); return; }
        const event = await window.tsEvents.getEvent(eventId);
        if (!event || event.status !== 'PUBLISHED') throw Error('This event is no longer available for booking.');
        const source = Array.isArray(event.categories) ? event.categories : Object.entries(event.categories || {}).map(([id, category]) => ({ sectionId: id, ...category }));
        const category = source.find(category => String(category.sectionId || category.id || category.section) === sectionId);
        const price = Number(String(category?.price ?? category?.unitPrice ?? '').replace(/[^\d.-]/g, ''));
        if (!category || !Number.isFinite(price) || price <= 0) throw Error('The selected ticket category is no longer available.');
        const subtotal = price * quantity;
        total = subtotal + 20;
        // Text nodes keep event names and query-string values out of HTML.
        const summary = document.createElement('div');
        summary.className = 'ts-list-item';
        const description = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = event.name || 'Event';
        const subtitle = document.createElement('p');
        subtitle.className = 'small secondary';
        subtitle.textContent = `${category.name || category.categoryName || sectionId} / Section ${sectionId} / ${quantity} ticket${quantity === 1 ? '' : 's'}`;
        description.append(title, subtitle);
        summary.appendChild(description);
        el('order-summary-list').replaceChildren(summary);
        el('subtotal').textContent = money(subtotal);
        el('fee').textContent = 'RM20.00';
        el('total').textContent = money(total);
        if (!/^0x[a-fA-F0-9]{40}$/.test(user.walletAddress || '')) {
            const target = new URL('wallet.php', window.location.href);
            target.searchParams.set('redirect', 'checkout.php' + window.location.search);
            const link = document.createElement('a');
            link.href = target.href;
            link.textContent = 'Connect your wallet to continue';
            el('wallet-info').replaceChildren(link);
            throw Error('Connect a valid wallet before completing checkout.');
        }
        el('wallet-info').textContent = `Wallet ${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)} / demo payment`;
        ready = true;
        updatePaymentButton();
        timer = setInterval(tick, 1000);
        tick();
        el('btn-pay').addEventListener('click', async () => {
            if (processing || completed || !ready || !el('demo-payment-consent').checked) return;
            if (Date.now() >= expiresAt) { await expire(); return; }
            el('checkout-error').hidden = true;
            if (el('demo-payment-outcome').value === 'decline') {
                error('Demo payment declined. Your seats remain reserved until the timer ends. Select successful payment to retry.');
                return;
            }
            processing = true;
            updatePaymentButton();
            try {
                const booking = await window.tsBookings.createBooking({ eventId, sectionId, seatDocIds,
                    walletAddress: user.walletAddress, paymentMethod: 'simulated' });
                if (!booking?.id) throw Error('No booking confirmation was returned. Retry to recover your booking.');
                completed = true;
                clearInterval(timer);
                try { sessionStorage.removeItem(storageKey); } catch (_) {}
                window.location.href = `booking-confirmation.php?bookingId=${encodeURIComponent(booking.id)}`;
            } catch (failure) {
                error(failure.message || 'Demo checkout could not be completed. You can retry.');
            } finally {
                processing = false;
                if (!completed && Date.now() >= expiresAt) await expire();
                updatePaymentButton();
            }
        });
    } catch (failure) {
        error(failure.message || 'Checkout could not be loaded.');
        updatePaymentButton();
    }
});
