const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

class Element {
    constructor() { this.children = []; this.listeners = {}; this.attributes = {}; this.hidden = false; }
    set innerHTML(value) { this.html = value; this.children = []; }
    get innerHTML() { return this.html || ''; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; this.html = ''; }
}
const booking = { id: 'booking-1', buyerUid: 'buyer-1', eventId: 'event-1', eventName: 'Test concert', bookingNumber: 'TS123',
    createdAt: '2026-10-23T09:06:20.505Z', categoryName: 'VIP', sectionId: 'A', seats: ['A01', 'A02'], quantity: 2,
    serviceCharge: 7.5, totalAmount: 100, status: 'CONFIRMED', paymentStatus: 'SIMULATED_PAID' };
const event = { id: 'event-1', date: '2026-11-25', time: '16:36', venueName: 'Test Hall', status: 'PUBLISHED', transferEnabled: true, resaleEnabled: true };
const ticket = { id: 'ticket-1', ownerUid: 'buyer-1', bookingId: 'booking-1', eventId: 'event-1', eventName: 'Test concert',
    categoryName: 'VIP', sectionId: 'A', seatId: 'A01', walletAddress: '0x' + 'a'.repeat(40), status: 'VALID', createdAt: booking.createdAt, transferHistory: [] };

function createPage(name, options = {}) {
    const php = fs.readFileSync(path.join(root, 'buyer', name + '.php'), 'utf8');
    const elements = new Map([...php.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
    let ready;
    const window = {
        location: { search: '?id=' + (name === 'booking-detail' ? 'booking-1' : 'ticket-1') },
        tsCurrentUser: { uid: 'buyer-1' },
        addEventListener(type, callback) { if (type === 'ts-auth-ready') ready = callback; },
        tsBookings: { getBooking: async () => options.booking || booking },
        tsEvents: { getEvent: async () => { if (options.eventError) throw Error('Unavailable'); return options.event || event; } },
        tsTickets: {
            getTicket: async () => options.getTicket ? options.getTicket() : options.ticket || ticket,
            getTickets: async () => {
                if (options.ticketsError) throw Error('Unavailable');
                return options.tickets || [ticket, { ...ticket, id: 'ticket-2', seatId: 'A02' }];
            }
        }
    };
    const context = vm.createContext({ window, document: { getElementById: id => elements.get(id), createElement: () => new Element() }, URLSearchParams, URL, Intl, console, setTimeout });
    for (const script of ['ticket-display.js', 'vendor/qrcode-generator-1.4.4.js', 'ticket-qr.js', name + '.js'])
        vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', script), 'utf8'), context);
    return { window, elements, ready: () => ready() };
}

test('booking shows readable local dates, the actual fee, and a separate link for each owned ticket', async () => {
    const p = createPage('booking-detail');
    await p.ready();
    assert.equal(p.elements.get('booking-content').hidden, false);
    assert.match(p.elements.get('val-date').textContent, /23 Oct 2026.*5:06.*SGT/);
    assert.doesNotMatch(p.elements.get('val-date').textContent, /T09:06/);
    assert.match(p.elements.get('val-event-date').textContent, /25 Nov 2026.*4:36/);
    assert.match(p.elements.get('val-fee').textContent, /7\.50/);
    assert.match(p.elements.get('val-subtotal').textContent, /92\.50/);
    const links = p.elements.get('booking-ticket-list').children;
    assert.equal(links.length, 2);
    assert.equal(links[0].href, 'ticket-detail.php?id=ticket-1');
    assert.equal(links[1].href, 'ticket-detail.php?id=ticket-2');
    assert.equal(p.elements.get('val-mint-status').textContent, 'Not minted (demo)');
});

test('booking stays usable when ticket lookup fails and excludes tickets belonging to another owner', async () => {
    const failure = createPage('booking-detail', { ticketsError: true, eventError: true });
    await failure.ready();
    assert.equal(failure.elements.get('booking-content').hidden, false);
    assert.equal(failure.elements.get('tickets-error').hidden, false);
    const p = createPage('booking-detail', { tickets: [ticket, { ...ticket, id: 'other', ownerUid: 'another-buyer' }] });
    await p.ready();
    assert.equal(p.elements.get('booking-ticket-list').children.length, 1);
});

test('valid tickets have a real SVG QR, download action, formatted event date, and honest demo status', async () => {
    const p = createPage('ticket-detail');
    await p.ready();
    assert.equal(p.elements.get('ticket-content').hidden, false);
    assert.match(p.elements.get('qr-container').innerHTML, /^<svg.*viewBox=.*<path d="M/);
    assert.equal(p.elements.get('download-qr').disabled, false);
    assert.equal(p.elements.get('val-owner').textContent, ticket.walletAddress);
    assert.match(p.elements.get('val-event-meta').textContent, /25 Nov 2026/);
    assert.equal(p.elements.get('val-token-id').textContent, 'Not issued on chain (demo)');
    assert.equal(p.elements.get('btn-transfer').hidden, false);
    assert.equal(p.elements.get('btn-resale').hidden, false);
    assert.equal(p.elements.get('view-booking').href, 'booking-detail.php?id=booking-1');
});

test('used tickets suppress the QR and ticket actions, and event rules disable ineligible actions', async () => {
    const used = createPage('ticket-detail', { ticket: { ...ticket, status: 'USED' } });
    await used.ready();
    assert.equal(used.elements.get('download-qr').disabled, true);
    assert.equal(used.elements.get('qr-container').innerHTML, '');
    assert.equal(used.elements.get('entry-heading').textContent, 'Entry unavailable');
    assert.equal(used.elements.get('btn-transfer').hidden, true);
    assert.equal(used.elements.get('btn-resale').hidden, true);
    const restricted = createPage('ticket-detail', { event: { ...event, transferEnabled: false, resaleStartDate: '2099-01-01' } });
    await restricted.ready();
    assert.equal(restricted.elements.get('btn-transfer').hidden, true);
    assert.equal(restricted.elements.get('btn-resale').hidden, true);
});

test('ownership history includes transfers and the original issuance without inserting wallet data as HTML', async () => {
    const p = createPage('ticket-detail', { ticket: { ...ticket, transferHistory: [{ fromWallet: '<old-wallet>', toWallet: '<new-wallet>', timestamp: booking.createdAt }] } });
    await p.ready();
    const history = p.elements.get('timeline-container').children;
    assert.equal(history.length, 2);
    assert.equal(history[0].children[2].textContent, '<old-wallet> \u2192 <new-wallet>');
    assert.equal(history[1].children[0].textContent, 'Ticket issued');
});

test('a different owner and stale signed-out requests cannot display ticket details or an entry QR', async () => {
    const p = createPage('ticket-detail', { ticket: { ...ticket, ownerUid: 'another-buyer' } });
    await p.ready();
    assert.equal(p.elements.get('ticket-content').hidden, true);
    assert.equal(p.elements.get('ticket-error').hidden, false);
    let resolve;
    const pending = createPage('ticket-detail', { getTicket: () => new Promise(done => { resolve = done; }) });
    const initial = pending.ready();
    pending.window.tsCurrentUser = null;
    await pending.ready();
    resolve(ticket);
    await initial;
    assert.equal(pending.elements.get('ticket-content').hidden, true);
    assert.equal(pending.elements.get('download-qr').disabled, true);
});
