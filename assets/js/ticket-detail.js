const el = id => document.getElementById(id);
const display = window.tsTicketDisplay;
let loadVersion = 0;
let downloadSvg = '', downloadId = '';
let artworkReady = false;
function flipTicket(flipped) {
    el('ticket-flip-card').setAttribute('data-flipped', String(flipped));
    el('ticket-flip-button').setAttribute('aria-pressed', String(flipped));
    el('ticket-flip-button').textContent = flipped ? 'Show entry ticket' : 'View NFT artwork';
    el('ticket-flip-front').setAttribute('aria-hidden', String(flipped));
    el('ticket-flip-back').setAttribute('aria-hidden', String(!flipped));
    el('ticket-flip-front').inert = flipped;
    el('ticket-flip-back').inert = !flipped;
}
el('ticket-flip-button').addEventListener('click', () => {
    if (!artworkReady || el('ticket-content').hidden) return;
    flipTicket(el('ticket-flip-button').getAttribute('aria-pressed') !== 'true');
});
el('ticket-art-image').addEventListener('error', () => { el('ticket-art-image').hidden = true; });
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
    el('ticket-face-gate').hidden = true;
    artworkReady = false; flipTicket(false); el('ticket-flip-button').disabled = true;
    el('ticket-art-image').removeAttribute('src');
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
        const identity = await window.tsFace.request('status', { ticketId: id });
        if (version !== loadVersion) return;
        el('ticket-face-manage').href = 'face-registration.php?ticketId=' + encodeURIComponent(id);
        if (!identity.registered && ticket.status !== 'USED') {
            el('ticket-face-gate').hidden = false;
            el('ticket-face-message').textContent = identity.message;
            el('ticket-face-register').href = 'face-registration.php?ticketId=' + encodeURIComponent(id);
            el('ticket-face-register').hidden = !identity.eligible;
            el('ticket-face-nft').href = 'blockchain.php?ticketId=' + encodeURIComponent(id);
            return;
        }
        el('ticket-transfer-history-link').href = 'ticket-transfers.php?ticketId=' + encodeURIComponent(id);
        el('ticket-buyer-chain-link').href = 'blockchain.php?ticketId=' + encodeURIComponent(id);
        const [eventResult, bookingResult, transferResult] = await Promise.allSettled([
            ticket.eventId ? window.tsEvents.getEvent(ticket.eventId) : Promise.resolve(null),
            ticket.bookingId ? window.tsBookings.getBooking(ticket.bookingId) : Promise.resolve(null),
            window.tsTickets.getTransfers?.({ ticketId: id }) || Promise.resolve({ records: [] })
        ]);
        if (version !== loadVersion) return;
        const event = eventResult.status === 'fulfilled' ? eventResult.value : null;
        const booking = bookingResult.status === 'fulfilled' ? bookingResult.value : null;
        const transfers = transferResult.status === 'fulfilled' && Array.isArray(transferResult.value?.records) ? transferResult.value.records : [];
        const demo = booking?.paymentStatus === 'SIMULATED_PAID';
        const artwork = window.tsCollectibleArt.artwork(ticket);
        el('ticket-art-poster').className = 'ts-collectible-poster ts-collectible-' + artwork.key;
        el('ticket-art-image').hidden = false;
        el('ticket-art-image').src = artwork.src;
        el('ticket-art-image').alt = artwork.name + ' collectible artwork';
        el('ticket-art-edition').textContent = artwork.name;
        el('ticket-art-category').textContent = ticket.categoryName || 'Event pass';
        el('ticket-art-event').textContent = ticket.eventName || event?.name || 'Event ticket';
        el('ticket-art-date').textContent = display.eventDate(ticket, event);
        el('ticket-art-number').textContent = '#' + String(ticket.id).slice(-8).toUpperCase();
        el('ticket-art-seat').textContent = 'Seat ' + (ticket.seatId || 'not assigned');
        el('ticket-art-mint').textContent = window.tsCollectibleArt.mintState(ticket).label;
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
        const latest = ticket.chainId === 11155111 && /^0x[0-9a-fA-F]{64}$/.test(ticket.blockchainLastTransactionHash || '');
        el('ticket-chain-latest').hidden = !latest;
        el('val-chain-latest').replaceChildren();
        if (latest) {
            const link = document.createElement('a');
            link.textContent = ticket.blockchainLastTransactionHash;
            link.href = 'https://sepolia.etherscan.io/tx/' + ticket.blockchainLastTransactionHash;
            link.target = '_blank'; link.rel = 'noopener noreferrer';
            el('val-chain-latest').append(link);
            el('val-chain-owner').textContent = ticket.blockchainWalletAddress || 'Not recorded';
            el('val-chain-sync').textContent = (ticket.blockchainWalletAddress || '').toLowerCase() === (ticket.walletAddress || '').toLowerCase()
                ? 'The recorded blockchain wallet matches your ticket wallet.' : 'Your current ticket ownership is awaiting blockchain synchronization.';
        }
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
        if (valid && published && identity.qr) {
            try {
                const seat = String(ticket.seatId || '');
                if (!/^[A-Za-z0-9_-]{1,160}$/.test(ticket.eventId || '') || !seat || seat.includes(':')) throw Error('Ticket entry data is incomplete. Please contact support.');
                downloadSvg = window.tsTicketQr.svg(identity.qr);
                downloadId = id;
                el('qr-container').innerHTML = downloadSvg;
                el('entry-heading').textContent = 'Ready for entry';
                el('download-qr').disabled = false;
                el('qr-note').textContent = 'Present this QR code and verify your face at the entrance. Your face must match this ticket’s registration.';
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
            const receipt = entry.type !== 'ISSUED' && entry.type !== 'RESALE' ? transfers.find(t => t.fromWallet === entry.fromWallet && t.toWallet === entry.toWallet && Math.abs(Date.parse(t.timestamp) - Date.parse(entry.timestamp)) < 5000) : null;
            if (receipt) title.textContent = receipt.direction === 'SENT' ? `Sent to ${receipt.toName || 'another buyer'}` : `Received from ${receipt.fromName || 'another buyer'}`;
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
        artworkReady = true; el('ticket-flip-button').disabled = false;
    } catch (error) {
        if (version !== loadVersion) return;
        el('ticket-error').textContent = error.message || 'Your ticket could not be loaded. Please try again.';
        el('ticket-error').hidden = false;
    }
});
