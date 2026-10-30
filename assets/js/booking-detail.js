const el = id => document.getElementById(id);
const display = window.tsTicketDisplay;
let loadVersion = 0;
window.addEventListener('ts-auth-ready', async () => {
    const version = ++loadVersion;
    el('booking-content').hidden = true;
    el('booking-error').hidden = true;
    el('val-eyebrow').textContent = 'Booking details';
    el('val-event').textContent = 'Loading your booking...';
    el('val-date').textContent = '';
    el('val-status-head').replaceChildren();
    if (!window.tsCurrentUser?.uid) return;
    const uid = window.tsCurrentUser.uid;
    try {
        const id = new URLSearchParams(window.location.search).get('id') || '';
        if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) throw Error('Choose a booking from My Bookings to view its details.');
        const record = await window.tsBookings.getBooking(id);
        if (version !== loadVersion) return;
        if (!record || record.buyerUid !== uid) throw Error('This booking could not be found or you do not have access to it.');
        const booking = { ...record, id };
        el('booking-buyer-chain-link').href = 'blockchain.php?bookingId=' + encodeURIComponent(id);
        const status = ({ CONFIRMED: ['Confirmed', 'success'], COMPLETED: ['Completed', 'neutral'], CANCELLED: ['Cancelled', 'error'],
            PENDING: ['Pending', 'warning'] })[String(booking.status).toUpperCase()] || ['Status unavailable', 'neutral'];
        el('val-eyebrow').textContent = `Booking ${booking.bookingNumber || id}`;
        el('val-event').textContent = booking.eventName || 'Event';
        el('val-date').textContent = `Booked on ${display.date(booking.createdAt)} (SGT)`;
        display.chip(el('val-status-head'), ...status);
        el('val-cat').textContent = booking.categoryName || 'Not available';
        el('val-section').textContent = booking.sectionId || 'Not available';
        el('val-seat').textContent = (booking.seats || []).join(', ') || 'Not assigned';
        const quantity = Number(booking.quantity) || booking.seats?.length || 1;
        el('val-qty').textContent = `${quantity} ticket${quantity === 1 ? '' : 's'}`;
        el('val-event-date').textContent = display.eventDate(booking, null);
        el('val-venue').textContent = booking.venueName || 'Venue details unavailable';
        const total = Number(booking.totalAmount) || 0;
        const fee = booking.serviceCharge != null && Number.isFinite(Number(booking.serviceCharge)) ? Number(booking.serviceCharge) : 20;
        el('val-subtotal').textContent = display.money(Math.max(0, total - fee));
        el('val-fee').textContent = display.money(fee);
        el('val-total').textContent = display.money(total);
        const payment = String(booking.paymentStatus || '').toUpperCase();
        const demo = payment === 'SIMULATED_PAID';
        const paid = demo || payment === 'PAID';
        display.chip(el('val-payment-status'), demo ? 'Simulated payment successful' : paid ? 'Payment successful' : payment === 'REFUNDED' ? 'Refunded' : 'Payment pending', paid ? 'success' : 'neutral');
        el('payment-total-label').textContent = demo ? 'Total (simulated)' : paid ? 'Total paid' : 'Total';
        el('payment-note').textContent = demo ? 'Demo booking. No money was charged.' : 'Amounts are shown in Malaysian Ringgit (MYR).';
        el('val-mint-status').textContent = demo ? 'Not minted (demo)' : 'Not minted yet';
        el('val-tx').textContent = demo ? 'No blockchain transaction in demo mode' : 'No transaction recorded';
        el('booking-content').hidden = false;
        el('tickets-error').hidden = true;
        const loadEvent = async () => {
            try {
                if (!booking.eventId) return;
                const event = await window.tsEvents.getEvent(booking.eventId);
                if (version !== loadVersion || !event) return;
                el('val-event-date').textContent = display.eventDate(booking, event);
                el('val-venue').textContent = [event.venueName, event.venueLocation].filter(Boolean).join(' / ') || 'Venue details unavailable';
            } catch (_) { /* Booking/payment remain available when event lookup fails. */ }
        };
        const loadTickets = async () => {
            try {
                const tickets = await window.tsTickets.getTickets({ bookingId: id });
                if (version !== loadVersion) return;
                const owned = tickets.filter(ticket => ticket.ownerUid === uid && ticket.bookingId === id)
                    .sort((a, b) => String(a.seatId || '').localeCompare(String(b.seatId || ''), undefined, { numeric: true }));
                el('ticket-count').textContent = `${owned.length} ticket${owned.length === 1 ? '' : 's'}`;
                const rows = owned.map(ticket => {
                    const link = document.createElement('a');
                    link.className = 'ts-booking-ticket-row';
                    link.href = `ticket-detail.php?id=${encodeURIComponent(ticket.id)}`;
                    const info = document.createElement('span');
                    const seat = document.createElement('strong');
                    seat.textContent = `Seat ${ticket.seatId || 'Not assigned'}`;
                    const category = document.createElement('span');
                    category.className = 'small secondary';
                    category.textContent = `${ticket.categoryName || booking.categoryName || 'Ticket'} / Section ${ticket.sectionId || booking.sectionId || '-'}`;
                    info.append(seat, category);
                    const status = document.createElement('span');
                    display.chip(status, ...display.ticketStatus(ticket.status));
                    const action = document.createElement('span');
                    action.className = 'ts-booking-ticket-open';
                    action.textContent = 'Open ticket \u2192';
                    link.append(info, status, action);
                    return link;
                });
                if (!rows.length) {
                    const empty = document.createElement('p');
                    empty.className = 'secondary';
                    empty.textContent = 'No tickets for this booking are currently in your account.';
                    rows.push(empty);
                }
                el('booking-ticket-list').replaceChildren(...rows);
                const hashes = [...new Set(owned.map(ticket => ticket.transactionHash).filter(Boolean))];
                if (hashes.length) {
                    el('val-tx').textContent = hashes.join('\n');
                    el('val-mint-status').textContent = owned.every(ticket => ticket.mintingStatus === 'MINTED') ? 'Minted' : 'Partially minted';
                }
            } catch (_) {
                if (version !== loadVersion) return;
                el('booking-ticket-list').replaceChildren();
                el('ticket-count').textContent = 'Unavailable';
                el('tickets-error').textContent = 'Tickets could not be loaded. Refresh this page or open My Tickets to try again.';
                el('tickets-error').hidden = false;
            }
        };
        await Promise.allSettled([loadEvent(), loadTickets()]);
    } catch (error) {
        if (version !== loadVersion) return;
        el('val-event').textContent = 'Booking unavailable';
        el('val-date').textContent = '';
        el('val-status-head').replaceChildren();
        el('booking-error').textContent = error.message || 'Your booking could not be loaded. Please try again.';
        el('booking-error').hidden = false;
    }
});
