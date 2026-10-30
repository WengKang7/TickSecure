const el = id => document.getElementById(id);
let initialized = false;
window.addEventListener('ts-auth-ready', async () => {
    if (initialized || !window.tsCurrentUser?.uid) return;
    initialized = true;
    try {
        const id = new URLSearchParams(window.location.search).get('bookingId') || '';
        if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) throw Error('Choose a booking from My Bookings to view its confirmation.');
        const booking = await window.tsBookings.getBooking(id);
        if (!booking || booking.buyerUid !== window.tsCurrentUser.uid || booking.status !== 'CONFIRMED') throw Error('This confirmed booking could not be found. Check My Bookings or try again.');
        const demo = booking.paymentStatus === 'SIMULATED_PAID';
        el('confirmation-title').textContent = demo ? 'Demo booking confirmed' : 'Booking confirmed';
        el('booking-success-icon').hidden = false;
        el('confirmation-details').hidden = false;
        el('success-copy').textContent = demo ? 'Your simulated payment was successful. No money was charged. Your tickets are now in My Tickets. Sepolia NFT issuance is tracked separately in each ticket’s blockchain details.'
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
                const owned = tickets.filter(ticket => ticket.ownerUid === window.tsCurrentUser?.uid);
                const minted = owned.filter(ticket => ticket.chainId === 11155111 && ticket.mintingStatus === 'MINTED' && /^0x[0-9a-fA-F]{64}$/.test(ticket.transactionHash || ''));
                if (minted.length) {
                    el('val-nft-status').textContent = minted.length === owned.length ? 'Minted on Sepolia' : 'Partially minted on Sepolia';
                    el('val-tx').textContent = [...new Set(minted.map(ticket => ticket.transactionHash))].join('\n');
                    el('val-tx-status').textContent = 'Confirmed on Sepolia';
                }
            } catch (_) { /* Confirmed booking remains visible if issuance lookup fails. */ }
        }
    } catch (error) {
        el('confirmation-title').textContent = 'Booking confirmation unavailable';
        el('success-copy').textContent = error.message || 'Please check My Bookings for your booking status.';
    }
});
