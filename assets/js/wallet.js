const el = id => document.getElementById(id);
const validAddress = value => /^0x[a-fA-F0-9]{40}$/.test(String(value || ''));
let initialized = false;
window.addEventListener('ts-auth-ready', () => {
    if (initialized || !window.tsCurrentUser?.uid) return;
    initialized = true;
    const user = window.tsCurrentUser;
    const checkout = new URL('checkout.php', window.location.href);
    const walletParams = new URLSearchParams(window.location.search);
    const requested = walletParams.get('redirect');
    const root = new URL('../', window.location.href);
    let returnHref = 'tickets.php';
    let returnLabel = 'Back to My Tickets';
    const returnLabels = {
        'buyer/tickets.php': 'Back to My Tickets', 'buyer/bookings.php': 'Back to My Bookings',
        'buyer/ticket-detail.php': 'Back to ticket', 'buyer/booking-detail.php': 'Back to booking',
        'buyer/profile.php': 'Back to profile', 'buyer/dashboard.php': 'Back to dashboard',
        'buyer/notifications.php': 'Back to notifications', 'buyer/complaints.php': 'Back to Help',
        'buyer/resale.php': 'Back to My Resale', 'public/events.php': 'Back to events',
        'public/event-detail.php': 'Back to event', 'public/resale.php': 'Back to resale',
        'public/resale-detail.php': 'Back to resale ticket', 'index.php': 'Back to home'
    };
    try {
        const candidate = new URL(walletParams.get('returnTo') || '', window.location.href);
        const route = candidate.pathname.startsWith(root.pathname) ? candidate.pathname.slice(root.pathname.length) : '';
        if (candidate.origin === root.origin && Object.hasOwn(returnLabels, route)) {
            returnHref = candidate.href;
            returnLabel = returnLabels[route];
        }
    } catch (_) { /* Invalid return links fall back to My Tickets. */ }
    let redirect = null;
    if (requested) {
        try {
            const url = new URL(requested, window.location.href);
            if (url.origin === checkout.origin && url.pathname === checkout.pathname) redirect = url;
            else throw Error();
        } catch (_) {
            el('wallet-error').hidden = false;
            el('wallet-error').textContent = 'This checkout link is invalid. Return to the event and choose tickets again.';
        }
    }
    const params = redirect?.searchParams;
    const eventId = params?.get('eventId');
    const sectionId = params?.get('sectionId');
    const qty = params?.get('qty') || '1';
    const expiry = params ? Date.parse(params.get('reservationExpiry') || '') : null;
    const selection = new URL('../public/event-detail.php', window.location.href);
    if (eventId) selection.search = new URLSearchParams({ id: eventId, sectionId: sectionId || '', qty }).toString();
    el('btn-back').href = eventId ? selection.href : returnHref;
    el('btn-back').textContent = eventId ? 'Change tickets' : returnLabel;
    el('wallet-page-title').textContent = redirect ? 'Connect your wallet' : 'My wallet';
    el('btn-back').addEventListener('click', async event => {
        const seats = (params?.get('seatIds') || '').split(',').filter(Boolean);
        if (!eventId || !seats.length) return;
        event.preventDefault();
        try {
            await window.tsSeats.releaseSeats(seats, { eventId });
            try { sessionStorage.removeItem(`ts-seat-reservation:${user.uid}:${eventId}:${sectionId}:${qty}`); } catch (_) {}
            window.location.href = el('btn-back').href;
        } catch (error) {
            el('wallet-error').hidden = false;
            el('wallet-error').textContent = error.message || 'Could not release your seats. Please try again.';
        }
    });
    const expired = () => Boolean(redirect) && (!Number.isFinite(expiry) || Date.now() >= expiry);
    function render(address) {
        const connected = validAddress(address);
        el('val-status').textContent = connected ? 'Wallet saved' : 'Not connected';
        el('val-address').textContent = connected ? address : 'No wallet connected';
        el('val-sync').textContent = connected ? 'Ready for demo checkout' : 'Connect a wallet to continue';
        el('btn-connect').textContent = connected ? 'Change wallet' : 'Connect wallet';
        el('btn-continue').style.display = connected && Boolean(redirect) && !expired() ? 'inline-flex' : 'none';
        el('btn-continue').href = redirect?.href || returnHref;
        el('btn-continue').textContent = redirect ? 'Continue to payment' : 'Continue';
    }
    function updateCountdown() {
        if (!redirect) return;
        const remaining = Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
        el('wallet-reservation-note').textContent = expired() ? 'Your reservation expired. Go back to the event to reserve seats again.'
            : `Seats are held for ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}.`;
        if (expired()) el('btn-continue').style.display = 'none';
    }
    render(user.walletAddress);
    updateCountdown();
    if (redirect) setInterval(updateCountdown, 1000);
    el('btn-continue').addEventListener('click', event => {
        if (!redirect || expired() || !validAddress(user.walletAddress)) event.preventDefault();
    });
    el('btn-connect').addEventListener('click', async () => {
        if (el('btn-connect').disabled) return;
        el('wallet-error').hidden = true;
        el('btn-connect').disabled = true;
        try {
            if (!window.ethereum?.request) {
                el('wallet-install').hidden = false;
                throw Error('Install or unlock MetaMask, then refresh this page and connect your wallet.');
            }
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const address = String(accounts?.[0] || '').trim();
            if (!validAddress(address)) throw Error('The wallet did not return a valid Ethereum address.');
            await window.tsUsers.updateProfile(user.uid, { walletAddress: address });
            user.walletAddress = address;
            render(address);
            try {
                const chain = await window.ethereum.request({ method: 'eth_chainId' });
                el('wallet-network').textContent = `Connected network: ${chain}. Demo payment does not send a blockchain transaction.`;
            } catch (_) { /* Connecting the address is enough for this demo. */ }
        } catch (error) {
            el('wallet-error').hidden = false;
            el('wallet-error').textContent = error.code === 4001 ? 'Wallet connection was cancelled. You can try again.'
                : error.code === -32002 ? 'A wallet request is already open. Check MetaMask to continue.' : error.message || 'Could not save your wallet. Please try again.';
        } finally { el('btn-connect').disabled = false; }
    });
    window.ethereum?.on?.('accountsChanged', () => {
        el('btn-continue').style.display = 'none';
        el('val-status').textContent = 'Wallet changed. Connect again to save your selected account.';
    });
});
