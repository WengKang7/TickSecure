const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

class Element {
    constructor(tagName = 'div') {
        this.tagName = tagName;
        this.children = [];
        this.dataset = {};
        this.attributes = new Map();
        this.style = {};
        this.listeners = {};
        this.className = '';
        this.hidden = false;
    }
    set innerHTML(value) { this.html = value; this.children = []; }
    get innerHTML() { return this.html || ''; }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    appendChild(child) { this.children.push(child); child.parentElement = this; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    getAttribute(name) { return this.attributes.get(name); }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    get classList() {
        return { toggle: (name, enabled) => {
            const names = new Set(this.className.split(' ').filter(Boolean));
            enabled ? names.add(name) : names.delete(name);
            this.className = [...names].join(' ');
        } };
    }
    querySelectorAll(selector) {
        const result = [];
        for (const child of this.children) {
            if ((selector === '[data-section-id]' && child.dataset.sectionId !== undefined)
                || (selector === '[data-category-section]' && child.dataset.categorySection !== undefined)) result.push(child);
            result.push(...child.querySelectorAll(selector));
        }
        return result;
    }
}

const event = {
    id: 'event-1', name: 'Live at the Hall', date: '2026-12-19', time: '20:00',
    eventCategory: 'Concert', description: 'Event information.', organizerName: 'Organizer',
    venueId: 'hall', venueName: 'The Hall', venueLocation: 'Kuala Lumpur',
    categories: { A: { name: 'VIP', price: 288, quantity: 20 }, B: { name: 'Standard', price: 188, quantity: 40 } }
};
const venue = {
    name: 'The Hall', address: 'Venue address', layoutStatus: 'ACTIVE',
    sections: [
        { sectionId: 'A', name: 'Section A', seatCount: 20 },
        { sectionId: 'B', name: 'Section B', seatCount: 40 },
        { sectionId: 'C', name: 'Section C', seatCount: 60 },
        { sectionId: 'D', name: 'Section D', seatCount: 20 }
    ]
};

function createPage(options = {}) {
    const php = fs.readFileSync(path.join(root, 'public/event-detail.php'), 'utf8');
    const elements = new Map([...php.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
    let ready;
    let venueReads = 0;
    const writes = [];
    const context = {
        URL, URLSearchParams,
        console: { info() {} },
        alert: message => { throw new Error(message); },
        document: { getElementById: id => elements.get(id), createElement: tag => new Element(tag) },
        window: {
            location: { origin: 'http://localhost', search: options.search || '?id=event-1', href: '' },
            tsCurrentUser: options.guest ? null : { uid: 'buyer-1', role: 'buyer' },
            addEventListener: (type, callback) => { if (type === 'ts-auth-ready') ready = callback; },
            setInterval: callback => { context.pollAvailability = callback; return 1; },
            clearInterval() {},
            tsEvents: {
                getEvent: async () => options.missingEvent ? null : options.event || event,
                getEventAvailability: async () => {
                    if (options.availabilityError) throw Error('Unavailable');
                    if (options.getAvailability) return options.getAvailability();
                    const data = options.event || event;
                    const categories = Object.entries(data.categories || {}).map(([sectionId, category]) => ({
                        sectionId, allocated: category.quantity, remaining: options.remaining?.[sectionId] ?? category.quantity
                    }));
                    return { eventId: data.id, categories, remaining: categories.reduce((sum, category) => sum + category.remaining, 0) };
                }
            },
            tsVenues: { getVenue: async () => {
                venueReads++;
                if (options.venueError) throw new Error('Permission denied');
                return options.getVenue ? options.getVenue() : venue;
            } },
            tsUsers: {
                getFavoriteEventIds: async () => options.favorites || [],
                setFavoriteEvent: async (id, saved) => writes.push({ id, saved })
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/venue-renderer.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/event-policy.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/event-detail.js'), 'utf8'), context);
    return { elements, context, writes, ready: () => ready(), venueReads: () => venueReads };
}

test('remaining seats appear per category and section and constrain quantity', async () => {
    const page = createPage({ remaining: { A: 2, B: 0 } });
    await page.ready();
    assert.equal(page.elements.get('event-remaining').textContent, '2 seats remaining');
    const cards = page.elements.get('cat-list').children;
    assert.equal(cards[0].children[0].children[2].textContent, '2 seats remaining');
    assert.equal(cards[1].children[0].children[2].textContent, 'Sold out');
    assert.equal(cards[1].disabled, true);
    const sections = page.elements.get('ven-board').querySelectorAll('[data-section-id]');
    assert.equal(sections[0].children[0].children[2].textContent, '2 remaining');
    assert.equal(sections[0].children[0].children[1].textContent, '20 seats', 'physical capacity is retained');
    cards[0].listeners.click();
    page.elements.get('quantity-plus').listeners.click();
    page.elements.get('quantity-plus').listeners.click();
    assert.equal(page.elements.get('ticket-quantity').textContent, '2');
    assert.equal(page.elements.get('quantity-plus').disabled, true);
    sections[1].listeners.click();
    assert.equal(page.elements.get('category-book-btn').textContent, 'Sold out');
    assert.equal(page.elements.get('category-book-btn').getAttribute('aria-disabled'), 'true');
});

test('refresh updates quantities and sold-out categories; failures never display allocation as remaining', async () => {
    let count = 3;
    const page = createPage({ getAvailability: async () => {
        if (count === null) throw Error('Offline');
        return { eventId: event.id, remaining: count + 40, categories: [{ sectionId: 'A', remaining: count }, { sectionId: 'B', remaining: 40 }] };
    } });
    await page.ready();
    page.elements.get('cat-list').children[0].listeners.click();
    page.elements.get('quantity-plus').listeners.click();
    page.elements.get('quantity-plus').listeners.click();
    count = 1;
    await page.elements.get('refresh-availability').listeners.click();
    assert.equal(page.elements.get('ticket-quantity').textContent, '1');
    count = 0;
    await page.context.pollAvailability();
    // Interval callback intentionally does not await its asynchronous request.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(page.elements.get('cat-list').children[0].disabled, true);
    count = 2;
    await page.elements.get('refresh-availability').listeners.click();
    assert.equal(page.elements.get('cat-list').children[0].disabled, false);
    count = null;
    await page.elements.get('refresh-availability').listeners.click();
    assert.equal(page.elements.get('event-remaining').textContent, 'Remaining seats unavailable');
    assert.equal(page.elements.get('cat-list').children[0].children[0].children[2].textContent, 'Remaining seats unavailable');
    assert.equal(page.elements.get('refresh-availability').disabled, false);
});

test('the public seating renderer matches the admin layout positions exactly', () => {
    const page = createPage();
    const admin = fs.readFileSync(path.join(root, 'admin/venue-layout.php'), 'utf8');
    const calculate = admin.match(/function calcPositions\(n\) \{[\s\S]*?\n    \}/)[0];
    for (const count of [1, 2, 3, 4, 5, 8, 12]) {
        const adminPositions = JSON.parse(JSON.stringify(vm.runInNewContext(calculate + '; calcPositions(' + count + ');')));
        const positions = page.context.window.tsVenueRenderer.getSectionPositions(count);
        const publicPositions = JSON.parse(JSON.stringify(positions.map(position => ({
            top: position.top + '%', left: position.left + '%', width: position.width + '%', height: position.height + '%'
        }))));
        assert.deepEqual(publicPositions, adminPositions, 'Section count ' + count);
    }
});

test('signed-in visitors see real physical sections and category selection highlights the matching section', async () => {
    const page = createPage();
    await page.ready();
    assert.equal(page.elements.get('ev-title').textContent, event.name);
    assert.equal(page.elements.get('event-poster').hidden, true, 'no empty tall poster');
    const board = page.elements.get('ven-board');
    assert.equal(board.children[0].className, 'ts-generated-stage');
    const sections = board.querySelectorAll('[data-section-id]');
    assert.equal(sections.length, venue.sections.length);
    assert.equal(sections[0].children[0].children[0].textContent, 'Section A');
    assert.equal(sections[0].children[0].children[1].textContent, '20 seats');
    const categories = page.elements.get('cat-list').querySelectorAll('[data-category-section]');
    categories[0].listeners.click();
    assert.equal(sections[0].getAttribute('aria-pressed'), 'true');
    assert.equal(page.elements.get('selected-category-label').textContent, 'VIP');
    sections[1].listeners.click();
    assert.equal(categories[1].getAttribute('aria-pressed'), 'true');
    assert.equal(categories[0].getAttribute('aria-pressed'), 'false');
    assert.equal(page.elements.get('selected-category-label').textContent, 'Standard');
    assert.equal(page.elements.has('book-btn'), false, 'duplicate header booking button is removed');
    assert.match(page.elements.get('category-book-btn').href, /buyer\/seat-assignment\.php\?eventId=event-1&sectionId=B&qty=1/);
    assert.equal(page.writes.length, 0, 'previewing categories must not create reservations or writes');
});

test('guests can read event details and categories while booking still requires sign-in', async () => {
    const page = createPage({ guest: true });
    await page.ready();
    assert.equal(page.elements.get('ev-title').textContent, event.name);
    assert.equal(page.elements.get('cat-list').children.length, 2);
    assert.equal(page.venueReads(), 0, 'private Venues reads are not attempted for a guest');
    assert.equal(page.elements.get('category-book-btn').href, '../auth/login.php');
    page.elements.get('cat-list').children[0].listeners.click();
    assert.equal(page.elements.get('event-order').hidden, true);
    assert.equal(page.elements.get('quantity-plus').disabled, true);
    assert.match(page.elements.get('ven-board').children[0].textContent, /Sign in/);
    await page.elements.get('save-event-btn').listeners.click();
    assert.equal(page.writes.length, 0);
    assert.equal(page.context.window.location.href, '../auth/login.php');
});

test('the heart restores saved state and toggles the stored favorite without removing its icon', async () => {
    const page = createPage({ favorites: ['event-1'] });
    const button = page.elements.get('save-event-btn');
    const icon = new Element('svg');
    button.appendChild(icon);
    await page.ready();
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(button.getAttribute('aria-label'), 'Remove from saved events');
    await button.listeners.click();
    assert.deepEqual(page.writes, [{ id: 'event-1', saved: false }]);
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.equal(button.getAttribute('aria-label'), 'Save event');
    assert.equal(button.children[0], icon);
    await button.listeners.click();
    assert.equal(page.writes[1].saved, true);
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(button.disabled, false);
});

test('an optional venue lookup failure keeps key event facts, prices, and booking controls usable', async () => {
    const page = createPage({ venueError: true });
    await page.ready();
    assert.equal(page.elements.get('event-error').hidden, true);
    assert.equal(page.elements.get('ev-title').textContent, event.name);
    assert.equal(page.elements.get('cat-list').children.length, 2);
    assert.match(page.elements.get('ven-board').children[0].textContent, /could not be loaded/);
    page.elements.get('cat-list').children[0].listeners.click();
    assert.equal(page.elements.get('category-book-btn').getAttribute('aria-disabled'), 'false');
});

test('a missing event shows a recoverable error and does not enable booking', async () => {
    const page = createPage({ missingEvent: true });
    await page.ready();
    assert.equal(page.elements.get('event-error').hidden, false);
    assert.equal(page.elements.get('category-book-btn').getAttribute('aria-disabled'), 'true');
    assert.equal(page.venueReads(), 0);
});

test('signing out while a venue load is in flight cannot restore the old private layout', async () => {
    let resolveVenue;
    const page = createPage({ getVenue: () => new Promise(resolve => { resolveVenue = resolve; }) });
    const first = page.ready();
    for (let tick = 0; tick < 10 && !resolveVenue; tick++) await Promise.resolve();
    page.context.window.tsCurrentUser = null;
    await page.ready();
    resolveVenue(venue);
    await first;
    assert.equal(page.elements.get('ven-board').querySelectorAll('[data-section-id]').length, 0);
    assert.equal(page.elements.get('category-book-btn').href, '../auth/login.php');
});


test('the shared renderer preserves static admin and organizer previews', () => {
    const page = createPage();
    page.context.window.tsVenueRenderer.renderBoard('ven-board', venue.sections);
    const sections = page.elements.get('ven-board').querySelectorAll('[data-section-id]');
    assert.equal(sections.length, 4);
    assert.equal(sections[0].tagName, 'div');
    assert.equal(sections[0].className, 'ts-generated-section');
    assert.match(sections[0].style.cssText, /left:8%;top:22%;width:40%;height:20%/);
});

test('quantity respects the buyer limit, updates totals, and resets when a different category is chosen', async () => {
    const page = createPage({ event: { ...event, maxTicketsPerBuyer: 3 } });
    await page.ready();
    const elements = page.elements;
    assert.equal(elements.get('category-book-btn').getAttribute('aria-disabled'), 'true');
    elements.get('cat-list').children[0].listeners.click();
    assert.equal(elements.get('event-order').hidden, false);
    assert.equal(elements.get('quantity-minus').disabled, true);
    for (let count = 0; count < 5; count++) elements.get('quantity-plus').listeners.click();
    assert.equal(elements.get('ticket-quantity').textContent, '3');
    assert.equal(elements.get('quantity-plus').disabled, true);
    assert.equal(elements.get('ticket-subtotal').textContent, 'RM864.00');
    assert.equal(elements.get('ticket-total').textContent, 'RM884.00');
    elements.get('quantity-minus').listeners.click();
    assert.equal(elements.get('ticket-quantity').textContent, '2');
    elements.get('cat-list').children[1].listeners.click();
    assert.equal(elements.get('ticket-quantity').textContent, '1');
    assert.match(elements.get('category-book-btn').href, /sectionId=B&qty=1/);
});

test('returning from seat assignment restores the category and clamps quantity to its allocation', async () => {
    const page = createPage({
        event: { ...event, maxTicketsPerBuyer: 8, categories: { A: { name: 'VIP', price: 288, quantity: 2 } } },
        search: '?id=event-1&sectionId=A&qty=7'
    });
    await page.ready();
    assert.equal(page.elements.get('selected-category-label').textContent, 'VIP');
    assert.equal(page.elements.get('ticket-quantity').textContent, '2');
    assert.equal(page.elements.get('quantity-plus').disabled, true);
    assert.match(page.elements.get('category-book-btn').href, /sectionId=A&qty=2/);
});

test('sections without an allocated category cannot continue to booking', async () => {
    const page = createPage({ event: { ...event, categories: { A: { name: 'Pending', price: 288, quantity: 0 } } } });
    await page.ready();
    assert.equal(page.elements.get('cat-list').children[0].disabled, true);
    const sections = page.elements.get('ven-board').querySelectorAll('[data-section-id]');
    for (const section of [sections[0], sections[1]]) {
        section.listeners.click();
        assert.equal(page.elements.get('category-book-btn').getAttribute('aria-disabled'), 'true');
        assert.equal(page.elements.get('event-order').hidden, true);
    }
});

test('closed or upcoming sales stay visible but cannot start checkout', async () => {
    for (const [dates, label] of [
        [{ salesEndDate: '2000-09-22T21:37' }, 'Sales closed'],
        [{ salesStartDate: '2099-09-22' }, 'Sales not started']
    ]) {
        const page = createPage({ event: { ...event, ...dates } });
        await page.ready();
        page.elements.get('cat-list').children[0].listeners.click();
        assert.equal(page.elements.get('category-book-btn').textContent, label);
        assert.equal(page.elements.get('category-book-btn').getAttribute('aria-disabled'), 'true');
        assert.equal(page.elements.get('event-order').hidden, true);
    }
});

test('the selected category and quantity reach the existing reservation step without choosing again', async () => {
    const page = createPage();
    await page.ready();
    page.elements.get('cat-list').children[1].listeners.click();
    page.elements.get('quantity-plus').listeners.click();
    page.elements.get('quantity-plus').listeners.click();
    const target = new URL(page.elements.get('category-book-btn').href, 'http://localhost/ticksecure-ui/public/event-detail.php');
    assert.equal(target.pathname, '/ticksecure-ui/buyer/seat-assignment.php');
    const php = fs.readFileSync(path.join(root, 'buyer/seat-assignment.php'), 'utf8');
    const script = fs.readFileSync(path.join(root, 'assets/js/seat-assignment.js'), 'utf8');
    const elements = new Map([...php.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
    const reservations = [];
    const storage = new Map();
    let ready;
    const window = {
        location: { search: target.search },
        tsCurrentUser: { uid: 'buyer-1' },
        tsEvents: { getEvent: async () => event },
        tsVenues: { getVenue: async () => venue },
        tsSeats: {
            reserveNextAvailableSeats: async request => {
                reservations.push(request);
                return { seats: Array.from({ length: request.count }, (_, index) => ({ id: 'seat-' + index, seatLabel: 'B' + index })),
                    reservationExpiry: new Date(Date.now() + 600000).toISOString() };
            }
        },
        addEventListener(type, callback) { if (type === 'ts-auth-ready') ready = callback; }
    };
    // Let the real page initialize through its normal auth-ready handler.
    const user = window.tsCurrentUser;
    window.tsCurrentUser = null;
    vm.runInNewContext(script, {
        window, document: { getElementById: id => elements.get(id) }, URLSearchParams,
        sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        console: { warn() {}, error(error) { throw error; } }, setInterval: () => 1, clearInterval() {}
    });
    window.tsCurrentUser = user;
    ready({ detail: user });
    for (let tick = 0; tick < 30 && !elements.get('btn-continue').href; tick++) await Promise.resolve();
    assert.equal(reservations.length, 1);
    assert.equal(reservations[0].eventId, 'event-1');
    assert.equal(reservations[0].sectionId, 'B');
    assert.equal(reservations[0].count, 3);
    assert.match(elements.get('assigned-seat-text').textContent, /Standard/);
    assert.match(elements.get('btn-continue').href, /^wallet\.php\?redirect=/);
    assert.match(elements.get('change-category-btn').href, /event-detail\.php\?id=event-1&sectionId=B&qty=3/);
});
