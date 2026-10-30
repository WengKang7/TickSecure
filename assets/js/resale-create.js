import './resale-policy.js';
const policy = window.tsResalePolicy;
const select = document.getElementById('resale-ticket');
const submit = document.getElementById('btn-submit');
const price = document.getElementById('input-price');
const message = document.getElementById('resale-message');
const requested = new URLSearchParams(location.search).get('ticketId');
let initialized = false, tickets = [], current = null, maximum = 0, loading = 0;
function showPrice() {
    const valid = current && policy.price(price.value, maximum)
        && /^0x[a-fA-F0-9]{40}$/.test(window.tsCurrentUser?.walletAddress || '');
    const value = Number(price.value);
    document.getElementById('summary-resale').textContent = `RM${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
    const alert = document.getElementById('price-alert');
    alert.style.display = 'flex';
    alert.className = `ts-alert ts-alert-${valid ? 'success' : 'error'} mt-12`;
    document.getElementById('price-alert-text').textContent = valid ? 'Price is within the organizer-defined limit.' : `Enter a price above RM0.00, up to RM${maximum.toFixed(2)}, with at most two decimal places.`;
    submit.disabled = !valid;
}
async function choose() {
    const generation = ++loading;
    current = null;
    submit.disabled = true;
    price.disabled = true;
    message.textContent = '';
    const ticket = tickets.find(item => item.id === select.value);
    if (!ticket) { message.textContent = 'Select a valid, unused ticket to continue.'; return; }
    try {
        const event = await window.tsEvents.getEvent(ticket.eventId);
        if (generation !== loading) return;
        const reason = policy.unavailable(event);
        if (reason) throw new Error(reason);
        const limits = policy.limits(event, ticket);
        maximum = limits.maximum;
        if (!(maximum > 0)) throw new Error('The organizer has not configured a valid resale price limit.');
        current = ticket;
        document.getElementById('val-event').textContent = ticket.eventName || event.name;
        document.getElementById('val-ticket-info').textContent = `${ticket.categoryName || 'Ticket'} · Seat ${ticket.seatId || '-'} · ${ticket.id}`;
        document.getElementById('val-owner').textContent = window.tsCurrentUser.walletAddress || 'Wallet required';
        document.getElementById('val-status').textContent = 'Eligible, unused ticket';
        document.getElementById('val-rules').textContent = `Resale ${event.resaleStartDate || 'now'} to ${event.resaleDeadline || 'no configured deadline'} (UTC+8). Maximum ticket price RM${maximum.toFixed(2)}. A service charge is shown separately to the buyer.`;
        document.getElementById('val-price-help').textContent = `Original RM${limits.originalPrice.toFixed(2)} · Maximum RM${maximum.toFixed(2)}`;
        document.getElementById('summary-original').textContent = `RM${limits.originalPrice.toFixed(2)}`;
        document.getElementById('summary-max').textContent = `RM${maximum.toFixed(2)}`;
        document.getElementById('btn-cancel').href = `ticket-detail.php?id=${encodeURIComponent(ticket.id)}`;
        price.value = Math.min(limits.originalPrice || maximum, maximum).toFixed(2);
        price.disabled = false;
        showPrice();
        if (!/^0x[a-fA-F0-9]{40}$/.test(window.tsCurrentUser.walletAddress || '')) {
            submit.disabled = true;
            message.textContent = 'Connect your wallet before listing this ticket. ';
            const link = document.createElement('a');
            link.href = `wallet.php?returnTo=${encodeURIComponent(location.pathname + '?ticketId=' + encodeURIComponent(ticket.id))}`;
            link.textContent = 'Connect wallet';
            message.append(link);
        }
    } catch (error) { if (generation === loading) message.textContent = error.message; }
}
async function initialize() {
    if (initialized || !window.tsCurrentUser?.uid) return;
    initialized = true;
    try {
        if (window.tsCurrentUser.role !== 'buyer') throw new Error('Use a buyer account to sell tickets.');
        tickets = (await window.tsTickets.getUserTickets()).filter(ticket => ticket.status === 'VALID');
        select.replaceChildren(new Option('Select a ticket', ''));
        tickets.forEach(ticket => select.add(new Option(`${ticket.eventName || 'Event'} · ${ticket.categoryName || 'Ticket'} · Seat ${ticket.seatId || ticket.id}`, ticket.id)));
        select.disabled = false;
        if (!tickets.length) throw new Error('You have no valid, unused tickets to list.');
        if (requested && tickets.some(ticket => ticket.id === requested)) select.value = requested;
        else if (tickets.length === 1) select.value = tickets[0].id;
        if (requested && !select.value) message.textContent = 'That ticket is unavailable or already listed. Choose another ticket.';
        else await choose();
    } catch (error) { message.textContent = error.message; }
}
select.addEventListener('change', choose);
price.addEventListener('input', showPrice);
submit.addEventListener('click', async () => {
    if (submit.disabled || !current || !policy.price(price.value, maximum)) return;
    submit.disabled = select.disabled = price.disabled = true;
    submit.textContent = 'Creating listing…';
    try {
        if (!await window.tsDecision('createListing', current.eventName || 'Ticket',
            [['Seat', current.seatId || current.id], ['Listing price', `RM${Number(price.value).toFixed(2)}`], ['Maximum price', `RM${maximum.toFixed(2)}`]])) {
            submit.textContent = 'Create listing';
            select.disabled = price.disabled = false;
            showPrice();
            return;
        }
        await window.tsResale.createListing({ ticketId: current.id, resalePrice: Number(price.value) });
        location.href = 'resale.php';
    } catch (error) {
        message.textContent = error.message || 'Unable to create listing.';
        submit.textContent = 'Create listing';
        select.disabled = price.disabled = false;
        showPrice();
    }
});
window.addEventListener('ts-auth-ready', initialize);
if (window.tsCurrentUser?.uid) initialize();
