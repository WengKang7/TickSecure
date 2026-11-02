import { sepolia } from './blockchain-client.js?v=20261102-organizer-chain';
import { createBookingMinter } from './booking-mint.js?v=20261102-organizer-chain';
import { fundDemoWallet } from './demo-funding-client.js?v=20261102-organizer-chain';
const el = id => document.getElementById(id);
let initialized = false;
let leftPage = false;
const navigation = ['btn-view-booking', 'confirmation-tickets-link', 'confirmation-chain-link', 'confirmation-events-link'].map(el);
const navigationTargets = new Map();
let navigationBusy = false;
function setNavigationBusy(busy) {
    navigationBusy = busy;
    el('confirmation-navigation').setAttribute('aria-busy', String(busy));
    for (const link of navigation) {
        if (busy) {
            if (!navigationTargets.has(link)) navigationTargets.set(link, { href: link.getAttribute('href') || link.href, tabindex: link.getAttribute('tabindex') });
            link.removeAttribute('href');
            link.setAttribute('aria-disabled', 'true');
            link.setAttribute('tabindex', '-1');
        } else {
            const target = navigationTargets.get(link);
            if (target?.href) link.setAttribute('href', target.href);
            if (target?.tabindex != null) link.setAttribute('tabindex', target.tabindex);
            else link.removeAttribute('tabindex');
            link.removeAttribute('aria-disabled');
            navigationTargets.delete(link);
        }
        link.classList.toggle('disabled', busy);
    }
}
for (const link of navigation) for (const type of ['click', 'auxclick', 'keydown']) link.addEventListener(type, event => {
    if (navigationBusy && (type !== 'keydown' || ['Enter', ' '].includes(event.key))) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }
});
window.addEventListener('pagehide', () => { leftPage = true; });
window.addEventListener('pageshow', () => { leftPage = false; });
async function loadConfirmation() {
    if (initialized || !window.tsCurrentUser?.uid) return;
    initialized = true;
    const uid = window.tsCurrentUser.uid;
    try {
        const id = new URLSearchParams(window.location.search).get('bookingId') || '';
        if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) throw Error('Choose a booking from My Bookings to view its confirmation.');
        const booking = await window.tsBookings.getBooking(id);
        if (leftPage || window.tsCurrentUser?.uid !== uid) return;
        if (!booking || booking.buyerUid !== window.tsCurrentUser.uid || booking.status !== 'CONFIRMED') throw Error('This confirmed booking could not be found. Check My Bookings or try again.');
        const demo = booking.paymentStatus === 'SIMULATED_PAID';
        el('confirmation-title').textContent = demo ? 'Demo booking confirmed' : 'Booking confirmed';
        el('booking-success-icon').hidden = false;
        el('confirmation-details').hidden = false;
        el('success-copy').textContent = demo ? 'Your simulated payment was successful. No money was charged for the ticket payment. Your tickets are now in My Tickets. NFT setup requests approval in MetaMask and uses Sepolia test ETH for gas.'
            : 'Your booking is confirmed. You can view your tickets in My Tickets.';
        el('val-event').textContent = booking.eventName || 'Event';
        el('val-booking-id').textContent = booking.bookingNumber || booking.id;
        el('val-category').textContent = booking.categoryName || booking.sectionId;
        el('val-seat').textContent = (booking.seats || []).join(', ') || 'See My Tickets';
        el('val-paid').textContent = `RM${Number(booking.totalAmount || 0).toFixed(2)}${demo ? ' (simulated)' : ''}`;
        el('btn-view-booking').href = `booking-detail.php?id=${encodeURIComponent(id)}`;
        el('btn-view-booking').hidden = false;
        el('confirmation-chain-link').href = 'blockchain.php?bookingId=' + encodeURIComponent(id);
        el('val-nft-status').textContent = demo ? 'Not minted (demo)' : 'Pending';
        el('val-tx').textContent = demo ? 'No blockchain transaction (demo)' : 'Pending';
        el('val-tx-status').textContent = demo ? 'Simulated' : 'Pending';
        {
            try {
                const tickets = await window.tsTickets.getTickets({ bookingId: id });
                if (leftPage || window.tsCurrentUser?.uid !== uid) return;
                const owned = tickets.filter(ticket => ticket.ownerUid === window.tsCurrentUser?.uid);
                const minted = owned.filter(ticket => ticket.chainId === 11155111 && ticket.mintingStatus === 'MINTED' && /^0x[0-9a-fA-F]{64}$/.test(ticket.transactionHash || ''));
                if (minted.length) {
                    el('val-nft-status').textContent = minted.length === owned.length ? 'Minted on Sepolia' : 'Partially minted on Sepolia';
                    el('val-tx').textContent = [...new Set(minted.map(ticket => ticket.transactionHash))].join('\n');
                    el('val-tx-status').textContent = 'Confirmed on Sepolia';
                }
            } catch (_) { /* Confirmed booking remains visible if issuance lookup fails. */ }
        }
        if (leftPage || window.tsCurrentUser?.uid !== uid) return;
        const isActive = expected => !leftPage && window.tsCurrentUser?.uid === expected
            && window.tsCurrentUser?.role === 'buyer' && window.tsCurrentUser?.status === 'active';
        let setupPending = false;
        const minter = createBookingMinter({ client: sepolia, wallet: window.tsChainWallet,
            storage: { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value), removeItem: key => localStorage.removeItem(key) },
            locks: window.navigator?.locks, isActive,
            ensureFunding: async (address, expectedUid, recordId) => {
                const funding = await fundDemoWallet({ walletAddress: address, recordId, onlyIfNeeded: true, isActive: () => isActive(uid),
                    onStatus: text => { el('confirmation-mint-status').textContent = text; } });
                if (['PENDING', 'BUSY'].includes(funding?.status)) throw Error('Demo gas is still confirming. Continue NFT setup shortly.');
            },
            onUpdate: progress => {
                setupPending = progress.state === 'pending';
                el('confirmation-mint-status').textContent = progress.message;
                el('confirmation-mint-retry').hidden = !['pending'].includes(progress.state);
                el('val-nft-status').textContent = `${progress.confirmed} of ${progress.total} NFTs confirmed`;
                el('val-tx-status').textContent = progress.state === 'complete' ? 'Confirmed on Sepolia'
                    : progress.state === 'submitted' ? 'Waiting for confirmations' : 'NFT setup in progress';
                if (progress.hashes.length) el('val-tx').textContent = [...new Set(progress.hashes)].join('\n');
            } });
        let mintBusy = false;
        async function continueMinting() {
            if (mintBusy || !isActive(uid)) return;
            mintBusy = true;
            setupPending = false;
            setNavigationBusy(true);
            el('confirmation-mint-panel').hidden = false;
            el('confirmation-mint-retry').hidden = true;
            el('confirmation-mint-status').textContent = 'Preparing your ticket NFTs...';
            try { await minter.run(id, uid); }
            catch (failure) {
                if (!isActive(uid)) return;
                el('confirmation-mint-status').textContent = failure.code === 4001
                    ? 'Wallet approval was cancelled. Your booking and tickets are saved. Continue NFT setup whenever you are ready.'
                    : (failure.message || 'NFT setup could not finish. Your booking and tickets are saved.');
                el('val-tx-status').textContent = 'NFT setup needs attention';
                el('confirmation-mint-retry').hidden = false;
            } finally { mintBusy = false; setNavigationBusy(setupPending && isActive(uid)); }
        }
        el('confirmation-mint-retry').addEventListener('click', continueMinting);
        let intent = 0;
        try {
            const key = `ts-auto-mint:${uid}:${id}`;
            intent = Number(sessionStorage.getItem(key));
            sessionStorage.removeItem(key);
        } catch (_) { /* Restricted storage: user can continue explicitly. */ }
        if (intent > 0 && Date.now() >= intent && Date.now() - intent < 15 * 60 * 1000) {
            await continueMinting();
        } else if (isActive(uid) && el('val-nft-status').textContent !== 'Minted on Sepolia') {
            el('confirmation-mint-panel').hidden = false;
            el('confirmation-mint-status').textContent = 'Your tickets are saved. Continue NFT setup when you are ready to approve in MetaMask.';
            el('confirmation-mint-retry').hidden = false;
        }
    } catch (error) {
        el('confirmation-title').textContent = 'Booking confirmation unavailable';
        el('success-copy').textContent = error.message || 'Please check My Bookings for your booking status.';
    }
}
window.addEventListener('ts-auth-ready', loadConfirmation);
if (window.tsCurrentUser?.uid) loadConfirmation();
