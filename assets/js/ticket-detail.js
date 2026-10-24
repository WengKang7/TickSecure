const el = id => document.getElementById(id);
const display = window.tsTicketDisplay;
let loadVersion = 0;
let downloadSvg = '', downloadId = '';
el('download-qr').addEventListener('click', () => {
    if (!downloadSvg || el('download-qr').disabled) return;
    const url = URL.createObjectURL(new Blob([downloadSvg], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticksecure-ticket-${downloadId}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener('ts-auth-ready', async () => {
    const version = ++loadVersion;
    el('ticket-content').hidden = true;
    el('ticket-error').hidden = true;
    el('download-qr').disabled = true;
    el('view-booking').hidden = true;
    downloadSvg = '';
    if (!window.tsCurrentUser?.uid) return;
    const uid = window.tsCurrentUser.uid;
    try {
        const id = new URLSearchParams(window.location.search).get('id') || '';
        if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) throw Error('Choose a ticket from My Tickets to view its details.');
        const record = await window.tsTickets.getTicket(id);
        if (version !== loadVersion) return;
        if (!record || record.ownerUid !== uid) throw Error('This ticket could not be found or is no longer in your account.');
        const ticket = { ...record, id };
        const [eventResult, bookingResult] = await Promise.allSettled([
            ticket.eventId ? window.tsEvents.getEvent(ticket.eventId) : Promise.resolve(null),
            ticket.bookingId ? window.tsBookings.getBooking(ticket.bookingId) : Promise.resolve(null)
        ]);
        if (version !== loadVersion) return;
        const event = eventResult.status === 'fulfilled' ? eventResult.value : null;
        const booking = bookingResult.status === 'fulfilled' ? bookingResult.value : null;
        const demo = booking?.paymentStatus === 'SIMULATED_PAID';
        el('val-event').textContent = ticket.eventName || event?.name || 'Event';
        el('val-event-meta').textContent = display.eventDate(ticket, event);
        el('val-venue').textContent = event?.venueName || ticket.venueName || 'Venue details unavailable';
        display.chip(el('val-status'), ...display.ticketStatus(ticket.status));
        display.chip(el('val-status-label'), ...display.ticketStatus(ticket.status));
        el('val-category').textContent = ticket.categoryName || 'Not available';
        el('val-section').textContent = ticket.sectionId || 'Not available';
        el('val-seat').textContent = ticket.seatId || 'Not assigned';
        el('val-owner').textContent = ticket.walletAddress || 'No wallet assigned';
        el('val-ticket-id').textContent = id;
        const minted = ticket.mintingStatus === 'MINTED' && Boolean(ticket.transactionHash);
        el('val-token-id').textContent = ticket.tokenId != null && String(ticket.tokenId).trim() !== '' ? ticket.tokenId : (demo ? 'Not issued on chain (demo)' : 'Not issued on chain yet');
        el('val-mint-status').textContent = minted ? 'Minted' : demo ? 'Not minted (demo)' : 'Not minted yet';
        el('val-contract').textContent = ticket.contractAddress || 'No contract recorded';
        el('val-tx').textContent = ticket.transactionHash || (demo ? 'No blockchain transaction in demo mode' : 'No mint transaction recorded');
        if (booking?.buyerUid === uid) {
            el('view-booking').href = `booking-detail.php?id=${encodeURIComponent(ticket.bookingId)}`;
            el('view-booking').hidden = false;
        }
        const valid = ticket.status === 'VALID';
        const published = event?.status === 'PUBLISHED';
        el('btn-transfer').hidden = !(valid && published && event.transferEnabled === true);
        el('btn-resale').hidden = !(valid && published && event.resaleEnabled === true && display.windowOpen(event.resaleStartDate, event.resaleDeadline));
        el('btn-transfer').href = `ticket-transfer.php?ticketId=${encodeURIComponent(id)}`;
        el('btn-resale').href = `resale-new.php?ticketId=${encodeURIComponent(id)}`;
        el('ticket-actions-note').textContent = !valid ? 'Transfer and resale are unavailable for this ticket status.'
            : !event ? 'Event rules could not be loaded. Refresh to check transfer and resale eligibility.'
                : 'Transfer and resale are available only when permitted by the event rules and current ticket status.';
        el('qr-container').replaceChildren();
        el('entry-heading').textContent = 'Entry unavailable';
        if (valid && (!event || published)) {
            try {
                const seat = String(ticket.seatId || '');
                if (!/^[A-Za-z0-9_-]{1,160}$/.test(ticket.eventId || '') || !seat || seat.includes(':')) throw Error('Ticket entry data is incomplete. Please contact support.');
                downloadSvg = window.tsTicketQr.svg(`TKSECURE:${id}:${ticket.eventId}:${seat}`);
                downloadId = id;
                el('qr-container').innerHTML = downloadSvg;
                el('entry-heading').textContent = 'Ready for entry';
                el('download-qr').disabled = false;
                el('qr-note').textContent = 'Present this QR code at the event entrance. Entry staff check current ownership and usage status.';
            } catch (error) { el('qr-note').textContent = error.message || 'QR code unavailable. Refresh to try again.'; }
        } else {
            el('qr-note').textContent = 'Entry QR is unavailable for this ticket or event status.';
        }
        const entries = Array.isArray(ticket.transferHistory) ? [...ticket.transferHistory].reverse() : [];
        entries.push({ type: 'ISSUED', timestamp: ticket.createdAt });
        const rows = entries.map((entry, index) => {
            const row = document.createElement('div');
            row.className = 'ts-timeline-item' + (index === 0 ? ' current' : '');
            const title = document.createElement('div');
            title.className = 'ts-timeline-title';
            title.textContent = entry.type === 'ISSUED' ? 'Ticket issued' : entry.type === 'RESALE' ? 'Resale purchase' : 'Transferred';
            const date = document.createElement('div');
            date.className = 'ts-timeline-meta';
            date.textContent = display.date(entry.timestamp);
            row.append(title, date);
            if (entry.type !== 'ISSUED') {
                const wallets = document.createElement('div');
                wallets.className = 'ts-timeline-meta ts-record-code';
                wallets.textContent = `${entry.fromWallet || entry.from || 'Previous wallet'} \u2192 ${entry.toWallet || entry.to || 'Current wallet'}`;
                row.appendChild(wallets);
            }
            return row;
        });
        el('timeline-container').replaceChildren(...rows);
        el('ticket-content').hidden = false;
    } catch (error) {
        if (version !== loadVersion) return;
        el('ticket-error').textContent = error.message || 'Your ticket could not be loaded. Please try again.';
        el('ticket-error').hidden = false;
    }
});
