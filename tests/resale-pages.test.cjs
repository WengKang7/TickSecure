const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const policy = require('../assets/js/resale-policy');
const root = path.join(__dirname, '..');
class Element {
    constructor() { this.listeners = {}; this.disabled = false; this.hidden = false; this.value = ''; this.textContent = ''; this.style = {}; this.children = []; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    replaceChildren(...children) { this.children = children; this.value = ''; }
    add(option) { this.children.push(option); }
    append(child) { this.children.push(child); }
}
const wallet = '0x' + 'a'.repeat(40);
const ticket = { id: 'ticket', status: 'VALID', eventId: 'event', sectionId: 'A', eventName: 'Concert', categoryName: 'VIP', seatId: 'A1' };
const event = { status: 'PUBLISHED', resaleEnabled: true, categories: { A: { price: 100 } }, maxResalePrice: 80 };
async function createPage(options = {}) {
    const ids = ['resale-ticket','btn-submit','input-price','resale-message','summary-resale','price-alert','price-alert-text','val-event','val-ticket-info','val-owner','val-status','val-rules','val-price-help','summary-original','summary-max','btn-cancel'];
    const elements = new Map(ids.map(id => [id, new Element()]));
    elements.get('btn-submit').disabled = elements.get('input-price').disabled = true;
    const location = { search: options.search || '', pathname: '/ticksecure-ui/buyer/resale-new.php' };
    const calls = [];
    let initialize;
    const window = { location, tsResalePolicy: policy, addEventListener: (_, callback) => { initialize = callback; },
        tsDecision: async () => options.cancelDecision ? null : {},
        tsTickets: { getUserTickets: async () => options.tickets || [ticket] },
        tsEvents: { getEvent: async () => options.event || event },
        tsResale: { createListing: async request => { calls.push(request); if (options.fail) throw Error('Listing failed'); } } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/resale-create.js'), 'utf8').replace(/^import .*;\r?\n/gm, ''), {
        window, location, URLSearchParams, Option: class { constructor(label, value) { this.label = label; this.value = value; } },
        document: { getElementById: id => elements.get(id), createElement: () => new Element() }
    });
    window.tsCurrentUser = { uid: 'buyer', role: 'buyer', walletAddress: options.noWallet ? '' : wallet };
    await initialize();
    return { elements, location, calls, choose: async value => { elements.get('resale-ticket').value = value; await elements.get('resale-ticket').listeners.change(); },
        price: value => { elements.get('input-price').value = value; elements.get('input-price').listeners.input(); }, submit: () => elements.get('btn-submit').listeners.click() };
}
test('Create Listing works without a ticket ID and supports a fixed cap below the original price', async () => {
    const p = await createPage();
    assert.equal(p.elements.get('resale-ticket').value, 'ticket');
    assert.equal(p.elements.get('input-price').value, '80.00');
    assert.equal(p.elements.get('summary-original').textContent, 'RM100.00');
    assert.equal(p.elements.get('btn-submit').disabled, false);
    await p.submit();
    assert.equal(p.calls.length, 1);
    assert.equal(p.calls[0].ticketId, 'ticket'); assert.equal(p.calls[0].resalePrice, 80);
    assert.equal(p.location.href, 'resale.php');
});
test('missing wallets, ineligible tickets, disabled resale and fractional-cent prices cannot submit', async () => {
    const p = await createPage({ noWallet: true });
    p.price('60.00');
    assert.equal(p.elements.get('btn-submit').disabled, true);
    await p.submit(); assert.equal(p.calls.length, 0);
    assert.match(p.elements.get('resale-message').children[0].href, /returnTo=.*resale-new/);
    const empty = await createPage({ tickets: [] });
    assert.match(empty.elements.get('resale-message').textContent, /no valid/);
    const disabled = await createPage({ event: { ...event, resaleEnabled: false } });
    assert.equal(disabled.elements.get('btn-submit').disabled, true);
    const fractional = await createPage(); fractional.price('50.001');
    assert.equal(fractional.elements.get('btn-submit').disabled, true);
});
test('listing service failures retain the selected ticket and allow a retry', async () => {
    const p = await createPage({ fail: true });
    await p.submit();
    assert.equal(p.elements.get('resale-message').textContent, 'Listing failed');
    assert.equal(p.elements.get('resale-ticket').value, 'ticket');
    assert.equal(p.elements.get('btn-submit').disabled, false);
});

async function detailPage(options = {}) {
    const php = fs.readFileSync(path.join(root, 'public/resale-detail.php'), 'utf8');
    const elements = new Map([...php.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
    let initialize;
    const location = { search: '?id=listing', pathname: '/ticksecure-ui/public/resale-detail.php' };
    const purchases = [];
    const window = { tsResalePolicy: policy, location, tsDecision: async () => options.cancelDecision ? null : {}, addEventListener: (_, cb) => { initialize = cb; },
        tsResale: { getListing: async () => ({ id: 'listing', ticketId: 'ticket', eventId: 'event', sectionId: 'A', originalPrice: 100, resalePrice: 75, maxAllowedPrice: 80, status: options.sold ? 'SOLD' : 'ACTIVE', sellerUid: 'seller', buyerUid: options.sold ? 'buyer' : '' }),
            purchaseListing: async (...args) => { purchases.push(args); return { ticketId: 'ticket' }; } }, tsEvents: { getEvent: async () => event } };
    const source = php.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\r?\n/gm, '');
    vm.runInNewContext(source, { window, document: { getElementById: id => elements.get(id) }, URLSearchParams, console });
    window.tsCurrentUser = { uid: 'buyer', role: 'buyer', status: 'active', walletAddress: options.noWallet ? '' : wallet };
    await initialize();
    return { window, elements, purchases, click: () => elements.get('rd-purchase-btn').listeners.click() };
}
test('resale purchase confirms the displayed price and routes the buyer to their ticket', async () => {
    const p = await detailPage();
    await p.click();
    assert.deepEqual(p.purchases, [['listing', 75]]);
    assert.match(p.window.location.href, /tickets.php\?resalePurchase=ticket/);
});
test('resale detail offers wallet connection before purchase and a ticket link after purchase', async () => {
    const walletPage = await detailPage({ noWallet: true });
    await walletPage.click();
    assert.match(walletPage.window.location.href, /wallet.php\?returnTo=/);
    assert.equal(walletPage.purchases.length, 0);
    const receipt = await detailPage({ sold: true });
    assert.equal(receipt.elements.get('rd-purchase-btn').textContent, 'View purchased ticket');
    await receipt.click(); assert.match(receipt.window.location.href, /ticket-detail.php\?id=ticket/);
    assert.equal(receipt.purchases.length, 0);
});


test('cancelling listing creation or resale purchase performs no mutation and restores the action', async () => {
    const listing = await createPage({ cancelDecision: true });
    await listing.submit();
    assert.equal(listing.calls.length, 0);
    assert.equal(listing.elements.get('btn-submit').disabled, false);
    const purchase = await detailPage({ cancelDecision: true });
    await purchase.click();
    assert.equal(purchase.purchases.length, 0);
    assert.equal(purchase.elements.get('rd-purchase-btn').disabled, false);
});
