const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const wallet = '0x1111111111111111111111111111111111111111';
const expiry = new Date(Date.now() + 600000).toISOString();
const query = new URLSearchParams({ eventId: 'event-1', sectionId: 'A', qty: '2', seatIds: 's1,s2', reservationExpiry: expiry });
const event = { id: 'event-1', name: '<Event>', status: 'PUBLISHED', venueId: 'venue-1', maxTicketsPerBuyer: 4,
    categories: { A: { name: 'VIP', price: 288, quantity: 10 } } };

class Element {
    constructor() { this.children = []; this.listeners = {}; this.attributes = {}; this.style = {}; this.checked = false; this.value = ''; }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    getAttribute(key) { return this.attributes[key]; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    append(...nodes) { this.children.push(...nodes); }
    appendChild(node) { this.children.push(node); }
    replaceChildren(...nodes) { this.children = nodes; }
}
function page(name, options = {}) {
    const php = fs.readFileSync(path.join(root, 'buyer', name + '.php'), 'utf8');
    const elements = new Map([...php.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
    const calls = { bookings: [], releases: [], profiles: [], reservations: [], confirmations: [] };
    const state = { now: Date.now() };
    let ready;
    const ticks = [];
    const user = { uid: 'buyer-1', walletAddress: wallet, ...options.user };
    const location = new URL('http://localhost/ticksecure-ui/buyer/' + name + '.php?' + (options.query ?? query.toString()));
    const window = {
        location: { href: location.href, search: location.search, hostname: location.hostname, origin: location.origin },
        tsDecision: async (...args) => { calls.confirmations.push(args); return options.cancelDecision ? null : {}; },
        tsCurrentUser: null,
        addEventListener(type, callback) { if (type === 'ts-auth-ready') ready = callback; },
        tsEvents: { getEvent: async () => event },
        tsVenues: { getVenue: async () => ({ sections: [{ sectionId: 'A', name: 'VIP' }] }) },
        tsSeats: {
            releaseSeats: async (ids, data) => calls.releases.push({ ids, data }),
            reserveNextAvailableSeats: async request => {
                calls.reservations.push(request);
                if (options.reserveError) throw Error('No seats available');
                return { seats: [{ id: 's1', seatLabel: 'A01' }, { id: 's2', seatLabel: 'A02' }], reservationExpiry: expiry };
            }
        },
        tsUsers: { updateProfile: async (uid, data) => calls.profiles.push({ uid, data }) },
        tsBookings: {
            createBooking: async data => {
                calls.bookings.push(data);
                if (options.paymentError) throw Error('Temporary backend failure');
                return options.createBooking ? options.createBooking(data) : { id: 'booking-1' };
            },
            getBooking: async () => options.booking ?? { id: 'booking-1', buyerUid: 'buyer-1', eventName: 'Event', categoryName: 'VIP',
                seats: ['A01', 'A02'], totalAmount: 596, status: 'CONFIRMED', paymentStatus: 'SIMULATED_PAID' }
        },
        ethereum: options.ethereum
    };
    const storage = new Map();
    vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js', name + '.js'), 'utf8'), {
        window, document: { getElementById: id => elements.get(id), createElement: () => new Element() }, URL, URLSearchParams,
        Date: class extends Date { static now() { return state.now; } },
        sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        setInterval: callback => { ticks.push(callback); return ticks.length; }, clearInterval() {}, console: { error() {}, warn() {} }
    });
    window.tsCurrentUser = user;
    return { elements, calls, window, user, state, ticks, ready: () => ready({ detail: user }) };
}

test('failed reservation shows an error state and retry rather than claiming a seat is reserved', async () => {
    const p = page('seat-assignment', { reserveError: true });
    await p.ready();
    assert.equal(p.elements.get('assignment-title').textContent, 'Reservation unsuccessful');
    assert.match(p.elements.get('assigned-seat-alert').className, /ts-alert-error/);
    assert.equal(p.elements.get('retry-reservation').hidden, false);
    assert.equal(p.elements.get('btn-continue').getAttribute('aria-disabled'), 'true');
});

test('changing category releases the current reservation before returning to the event', async () => {
    const p = page('seat-assignment');
    await p.ready();
    await p.elements.get('change-category-btn').listeners.click({ preventDefault() {} });
    assert.equal(p.calls.releases.length, 1);
    assert.match(p.window.location.href, /event-detail\.php\?id=event-1&sectionId=A&qty=2/);
});

test('wallet connection saves the provider account and retains the full checkout reservation', async () => {
    const redirect = 'checkout.php?' + query;
    const p = page('wallet', { query: 'redirect=' + encodeURIComponent(redirect), user: { walletAddress: '' },
        ethereum: { request: async ({ method }) => method === 'eth_requestAccounts' ? [wallet] : '0xaa36a7' } });
    await p.ready();
    await p.elements.get('btn-connect').listeners.click();
    assert.equal(p.calls.profiles[0].uid, 'buyer-1');
    assert.equal(p.calls.profiles[0].data.walletAddress, wallet);
    assert.equal(p.elements.get('btn-continue').style.display, 'inline-flex');
    assert.equal(new URL(p.elements.get('btn-continue').href).searchParams.get('seatIds'), 's1,s2');
});

test('wallet cancellation and missing wallet provider show recoverable errors', async () => {
    for (const ethereum of [undefined, { request: async () => { throw Object.assign(Error('Cancelled'), { code: 4001 }); } }]) {
        const p = page('wallet', { ethereum, user: { walletAddress: '' }, query: '' });
        await p.ready();
        await p.elements.get('btn-connect').listeners.click();
        assert.equal(p.elements.get('wallet-error').hidden, false);
        assert.equal(p.calls.profiles.length, 0);
        assert.equal(p.elements.get('btn-connect').disabled, false);
    }
});

test('wallet continuation rejects external redirects and expired reservations', async () => {
    const external = page('wallet', { query: 'redirect=' + encodeURIComponent('https://example.com/') });
    await external.ready();
    assert.equal(external.elements.get('btn-continue').style.display, 'none');
    const expired = new URLSearchParams(query);
    expired.set('reservationExpiry', new Date(Date.now() - 1000).toISOString());
    const p = page('wallet', { query: 'redirect=' + encodeURIComponent('checkout.php?' + expired) });
    await p.ready();
    assert.equal(p.elements.get('btn-continue').style.display, 'none');
    assert.match(p.elements.get('wallet-reservation-note').textContent, /expired/);
});

test('standalone wallet settings returns to their source page and never offers a checkout continuation', async () => {
    for (const [returnTo, expected] of [
        ['/ticksecure-ui/buyer/ticket-detail.php?id=ticket-1', 'ticket-detail.php?id=ticket-1'],
        ['https://example.com/', 'tickets.php']
    ]) {
        const p = page('wallet', { query: 'returnTo=' + encodeURIComponent(returnTo) });
        await p.ready();
        assert.equal(p.elements.get('wallet-page-title').textContent, 'My wallet');
        assert.equal(p.elements.get('btn-continue').style.display, 'none');
        assert.ok(p.elements.get('btn-back').href.endsWith(expected));
        assert.doesNotMatch(p.elements.get('btn-back').href, /dashboard\.php/);
    }
});

test('leaving wallet or checkout to change tickets releases the existing hold', async () => {
    for (const name of ['wallet', 'checkout']) {
        const options = name === 'wallet' ? { query: 'redirect=' + encodeURIComponent('checkout.php?' + query) } : {};
        const p = page(name, options);
        await p.ready();
        const button = p.elements.get(name === 'wallet' ? 'btn-back' : 'checkout-back');
        await button.listeners.click({ preventDefault() {} });
        assert.equal(p.calls.releases.length, 1);
        assert.match(p.window.location.href, /event-detail\.php/);
    }
});

test('demo checkout requires consent, supports decline without creating a booking, and preserves the server request', async () => {
    const p = page('checkout');
    await p.ready();
    const e = p.elements;
    assert.equal(e.get('total').textContent, 'RM596.00');
    assert.equal(e.get('btn-pay').disabled, true);
    e.get('demo-payment-consent').checked = true;
    e.get('demo-payment-consent').listeners.change();
    assert.equal(e.get('btn-pay').disabled, false);
    e.get('demo-payment-outcome').value = 'decline';
    await e.get('btn-pay').listeners.click();
    assert.equal(p.calls.bookings.length, 0);
    assert.match(e.get('checkout-error').textContent, /declined/);
    e.get('demo-payment-outcome').value = 'success';
    await e.get('btn-pay').listeners.click();
    assert.equal(p.calls.bookings.length, 1);
    assert.equal(p.calls.bookings[0].paymentMethod, 'simulated');
    assert.equal(p.calls.bookings[0].seatDocIds.join(','), 's1,s2');
    assert.equal('totalAmount' in p.calls.bookings[0], false, 'prices are calculated on the server');
    assert.match(p.window.location.href, /booking-confirmation\.php\?bookingId=booking-1/);
    assert.equal(e.get('btn-pay').disabled, true);
});

test('expired, invalid and wallet-less checkout cannot submit payment', async () => {
    const expired = new URLSearchParams(query);
    expired.set('reservationExpiry', new Date(Date.now() - 1000).toISOString());
    for (const options of [{ query: expired.toString() }, { query: 'eventId=event-1' }, { user: { walletAddress: '' } }]) {
        const p = page('checkout', options);
        await p.ready();
        assert.equal(p.elements.get('btn-pay').disabled, true);
        assert.equal(p.calls.bookings.length, 0);
        assert.equal(p.elements.get('checkout-error').hidden, false);
    }
});

test('payment retries recover after a backend failure and repeated clicks cannot duplicate a pending payment', async () => {
    let finish;
    const p = page('checkout', { createBooking: () => new Promise(resolve => { finish = resolve; }) });
    await p.ready();
    p.elements.get('demo-payment-consent').checked = true;
    const first = p.elements.get('btn-pay').listeners.click();
    await p.elements.get('btn-pay').listeners.click();
    assert.equal(p.calls.bookings.length, 1);
    finish({ id: 'booking-1' });
    await first;
    const failure = page('checkout', { paymentError: true });
    await failure.ready();
    failure.elements.get('demo-payment-consent').checked = true;
    await failure.elements.get('btn-pay').listeners.click();
    assert.equal(failure.elements.get('btn-pay').disabled, false);
    assert.match(failure.elements.get('checkout-error').textContent, /Temporary/);
});

test('an expired checkout releases the hold and disables payment', async () => {
    const p = page('checkout');
    await p.ready();
    p.elements.get('demo-payment-consent').checked = true;
    p.state.now = Date.parse(expiry) + 1;
    p.ticks[0]();
    assert.equal(p.elements.get('btn-pay').disabled, true);
    assert.equal(p.calls.releases.length, 1);
    assert.match(p.elements.get('checkout-error').textContent, /expired/);
});

test('confirmation displays simulated payment truthfully and rejects an unavailable or different buyer booking', async () => {
    const p = page('booking-confirmation', { query: 'bookingId=booking-1' });
    await p.ready();
    assert.equal(p.elements.get('confirmation-title').textContent, 'Demo booking confirmed');
    assert.equal(p.elements.get('val-nft-status').textContent, 'Not minted (demo)');
    for (const booking of [{ buyerUid: 'another-buyer', status: 'CONFIRMED' }, { buyerUid: 'buyer-1', status: 'CANCELLED' }]) {
        const denied = page('booking-confirmation', { query: 'bookingId=booking-1', booking });
        await denied.ready();
        assert.equal(denied.elements.get('confirmation-title').textContent, 'Booking confirmation unavailable');
    }
});


test('cancelling purchase or seat release keeps the current booking flow unchanged', async () => {
    const p = page('checkout', { cancelDecision: true });
    await p.ready();
    p.elements.get('demo-payment-consent').checked = true;
    await p.elements.get('btn-pay').listeners.click();
    assert.equal(p.calls.bookings.length, 0);
    assert.equal(p.calls.confirmations[0][0], 'checkout');
    assert.equal(p.elements.get('btn-pay').disabled, false);
    await p.elements.get('checkout-back').listeners.click({ preventDefault() {} });
    assert.equal(p.calls.releases.length, 0);
    assert.equal(p.calls.confirmations.at(-1)[0], 'releaseReservation');
});

test('reservation expiry during the confirmation prevents checkout and releases the hold', async () => {
    const p = page('checkout');
    await p.ready();
    p.elements.get('demo-payment-consent').checked = true;
    p.window.tsDecision = async () => { p.state.now = Date.parse(expiry) + 1; return {}; };
    await p.elements.get('btn-pay').listeners.click();
    assert.equal(p.calls.bookings.length, 0);
    assert.equal(p.calls.releases.length, 1);
    assert.equal(p.elements.get('btn-pay').disabled, true);
    assert.match(p.elements.get('checkout-error').textContent, /expired/);
});
