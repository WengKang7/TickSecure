const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const wallet = '0x1111111111111111111111111111111111111111';
class Element {
    constructor() { this.listeners = {}; this.attributes = {}; this.dataset = {}; this.style = {}; this.hidden = true; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key]; }
    focus() { this.focused = true; }
    scrollIntoView() { this.scrolled = true; }
    click() { this.clicks = (this.clicks || 0) + 1; return this.listeners.click?.({}); }
}
function createNavigation(page = 'buyer/ticket-detail.php?id=ticket-1', search = false) {
    const ids = ['public-menu-toggle', 'public-mobile-panel', 'mobile-logout-btn', 'public-logout-btn', 'public-wallet-mini', 'public-wallet-text', 'mobile-wallet-text', 'mobile-profile-link'];
    const elements = new Map(ids.map(id => [id, new Element()]));
    if (search) elements.set('event-search', new Element());
    const buyer = [elements.get('public-wallet-mini'), new Element()];
    const staff = [new Element()];
    const guests = [new Element()];
    const protectedLinks = [...buyer, ...staff, elements.get('mobile-profile-link')];
    const mobileWallet = new Element();
    const searchLink = new Element();
    const header = new Element();
    header.dataset.appRoot = '..';
    header.contains = target => target?.inside === true;
    header.querySelector = selector => selector === '.ts-header-search' ? searchLink : null;
    header.querySelectorAll = selector => ({
        '[data-ts-auth-only]': protectedLinks, '[data-ts-buyer-only]': buyer,
        '[data-ts-staff-only]': staff, '[data-ts-guest-only]': guests, '.ts-mobile-wallet-link': [mobileWallet]
    })[selector] || [];
    const documentEvents = {}, windowEvents = {};
    let resize;
    const window = {
        location: new URL('http://localhost/ticksecure-ui/' + page),
        addEventListener(type, callback) { windowEvents[type] = callback; },
        matchMedia: () => ({ addEventListener(_type, callback) { resize = callback; } })
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/public-navigation.js'), 'utf8'), {
        window, URL, document: { querySelector: () => header, getElementById: id => elements.get(id), addEventListener(type, callback) { documentEvents[type] = callback; } }
    });
    return { elements, buyer, staff, guests, mobileWallet, searchLink, documentEvents, windowEvents, resize: () => resize({ matches: true }),
        auth: profile => windowEvents['ts-auth-ready']({ detail: profile }) };
}

test('wallet navigation has a named entry with a safe return to the current page, including unconnected buyers', () => {
    const p = createNavigation();
    p.auth({ uid: 'buyer-1', role: 'buyer' });
    const badge = p.elements.get('public-wallet-mini');
    assert.equal(badge.style.display, 'inline-flex');
    assert.equal(p.elements.get('public-wallet-text').textContent, 'Not connected');
    assert.equal(new URL(badge.href).searchParams.get('returnTo'), '/ticksecure-ui/buyer/ticket-detail.php?id=ticket-1');
    p.windowEvents['ts-profile-updated']({ detail: { uid: 'buyer-1', role: 'buyer', walletAddress: wallet } });
    assert.equal(p.elements.get('public-wallet-text').textContent, '0x1111\u20261111');
    assert.equal(badge.dataset.saved, 'true');
    assert.equal(p.mobileWallet.href, badge.href);
    assert.match(badge.getAttribute('aria-label'), /Manage wallet/);
});

test('opening wallet from checkout preserves its complete reservation redirect', () => {
    const p = createNavigation('buyer/checkout.php?eventId=e1&sectionId=A&qty=2&seatIds=s1,s2');
    p.auth({ role: 'buyer', walletAddress: wallet });
    assert.equal(new URL(p.elements.get('public-wallet-mini').href).searchParams.get('redirect'), 'checkout.php?eventId=e1&sectionId=A&qty=2&seatIds=s1,s2');
});

test('guest, buyer and staff links reflect the authenticated role', () => {
    const p = createNavigation();
    p.auth(null);
    assert.ok(p.buyer.every(link => link.hidden));
    assert.equal(p.guests[0].hidden, false);
    p.auth({ role: 'buyer' });
    assert.ok(p.buyer.every(link => !link.hidden));
    assert.ok(p.staff.every(link => link.hidden));
    p.auth({ role: 'organizer' });
    assert.ok(p.buyer.every(link => link.hidden));
    assert.equal(new URL(p.staff[0].href).pathname, '/ticksecure-ui/organizer/dashboard.php');
    assert.equal(new URL(p.elements.get('mobile-profile-link').href).pathname, '/ticksecure-ui/organizer/profile.php');
});

test('the compact menu supports open/close, Escape, outside clicks, resizing and the existing logout action', () => {
    const p = createNavigation();
    const toggle = p.elements.get('public-menu-toggle'), panel = p.elements.get('public-mobile-panel');
    toggle.click();
    assert.equal(panel.hidden, false);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    p.documentEvents.keydown({ key: 'Escape' });
    assert.equal(panel.hidden, true);
    assert.equal(toggle.focused, true);
    toggle.click();
    p.documentEvents.click({ target: {} });
    assert.equal(panel.hidden, true);
    toggle.click();
    p.resize();
    assert.equal(panel.hidden, true);
    p.elements.get('mobile-logout-btn').click();
    assert.equal(p.elements.get('public-logout-btn').clicks, 1);
});

test('search navigation focuses the event search instead of being an inert button', () => {
    const p = createNavigation('public/events.php', true);
    let prevented = false;
    p.searchLink.listeners.click({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(p.elements.get('event-search').focused, true);
    assert.equal(p.elements.get('event-search').scrolled, true);
});

test('PHP active navigation follows the actual wallet, booking, help and checkout routes', () => {
    const php = process.env.PHP_BINARY || 'C:/xampp/php/php.exe';
    for (const [page, key] of [['wallet.php', 'wallet'], ['booking-detail.php', 'bookings'], ['complaints.php', 'help'], ['checkout.php', 'events']]) {
        const html = execFileSync(php, ['-r', "$_SERVER['SCRIPT_NAME'] = $argv[1]; require $argv[2]; render_public_page('Test', 'tickets', '', '..');", '/ticksecure-ui/buyer/' + page, path.join(root, 'shared/ui.php')], { encoding: 'utf8' });
        const anchors = [...html.matchAll(/<a\b[^>]+>/g)].map(match => match[0]);
        assert.ok(anchors.some(anchor => anchor.includes('data-nav-key="' + key + '"') && /aria-current="page"/.test(anchor)), page);
        if (key !== 'tickets') assert.ok(anchors.filter(anchor => anchor.includes('data-nav-key="tickets"')).every(anchor => !anchor.includes('aria-current')));
        assert.match(html, /public-navigation\.js\?v=\d+/);
        assert.match(html, /public\/events\.php#event-search/);
        assert.match(html, /buyer\/bookings\.php/);
    }
});
