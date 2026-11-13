const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const art = require('../assets/js/collectible-art.js');
const flush = () => new Promise(resolve => setImmediate(resolve));

test('category artwork uses the organizer image and border and survives owner changes', () => {
    const event = {categories: {VIP: {name:'VIP', nftArtwork: {imageUrl:'https://example.com/vip.jpg', border:'gold'}},
        CAT1: {name:'CAT1', nftArtwork: {imageUrl:'https://example.com/vip.jpg', border:'silver'}}}};
    const ticket = {id:'ticket-42', sectionId:'VIP', categoryName:'VIP', _event:event};
    assert.equal(art.artwork(ticket).src, 'https://example.com/vip.jpg');
    assert.equal(art.artwork(ticket).key, 'gold');
    assert.deepEqual(art.artwork({...ticket, ownerUid:'new-owner'}), art.artwork(ticket));
    assert.equal(art.artwork({...ticket, sectionId:'CAT1'}).key, 'silver');
    assert.equal(art.artwork({id:'legacy'}).src, '');
    assert.equal(art.artwork({categoryName:'VIP', _event:event}).src, 'https://example.com/vip.jpg');
    assert.equal(art.artwork({sectionId:'VIP', _event:{categories:{VIP:{nftArtwork:{imageUrl:'javascript:alert(1)',border:'gold'}}}}}).src, '');
});
test('collectible artwork never implies that an unconfirmed NFT is minted', () => {
    assert.equal(art.mintState({ mintingStatus: 'MINTED', transactionHash: '0x' + 'a'.repeat(64) }).minted, true);
    assert.equal(art.mintState({ mintingStatus: 'MINTED' }).minted, false);
    assert.equal(art.mintState({ mintingStatus: 'PENDING' }).minted, false);
    assert.equal(art.mintState({ mintingStatus: 'FAILED' }).label, 'Mint needs attention');
});

class Element {
    constructor(tag = 'div') { this.tagName = tag; this.attributes = {}; this.children = []; this.listeners = {}; this.dataset = {}; this.value = ''; this.hidden = false; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    addEventListener(key, fn) { this.listeners[key] = fn; }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    click() { return this.listeners.click?.(); }
}
function page(options = {}) {
    const html = fs.readFileSync('buyer/collections.php', 'utf8');
    const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
    const filters = ['all', 'minted', 'pending'].map(key => { const e = new Element(); e.dataset.collectionFilter = key; return e; });
    const events = {}, timers = [], eventReads = [];
    let fail = !!options.fail, reads = 0;
    const transactionHash = '0x' + '1'.repeat(64);
    const records = ['VALID','USED','LISTED_FOR_RESALE','CANCELLED','EXPIRED'].map((status, index) => ({
        id: 'ticket-' + index, ownerUid: 'buyer-1', eventId: index < 2 ? 'event-a' : 'event-b',
        eventName: index ? 'Live Festival' : '<img src=x onerror=alert(1)>', eventDate: '2027-07-24', seatId: 'A' + index, categoryName: 'VIP', status,
        mintingStatus: index < 2 ? 'MINTED' : 'PENDING', transactionHash: index < 2 ? transactionHash : ''
    }));
    const window = { tsCollectibleArt: art, addEventListener: (key, fn) => { events[key] = fn; },
        tsTickets: { getUserTickets: async () => { reads++; if (options.getTickets) return options.getTickets(); if (fail) throw Error('Offline'); return structuredClone(options.records || records); } },
        tsEvents: { getEvent: async id => { eventReads.push(id); if (options.eventError) throw Error('No event access'); return { name: 'Recovered event', date: '2027-07-24', time: '19:00' }; } } };
    const context = vm.createContext({ window, document: { hidden: false, getElementById: id => elements.get(id), querySelectorAll: () => filters, createElement: tag => new Element(tag), addEventListener() {} },
        setInterval: fn => { timers.push(fn); return timers.length; }, clearInterval() {}, console });
    vm.runInContext(fs.readFileSync('assets/js/ticket-display.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('assets/js/buyer-collections.js', 'utf8'), context);
    return { elements, filters, events, records, timers, eventReads, window, reads: () => reads, recover: () => { fail = false; },
        auth: async profile => { window.tsCurrentUser = profile; events['ts-auth-ready']({ detail: profile }); await flush(); } };
}
const buyer = { uid: 'buyer-1', role: 'buyer' };

test('the collection includes every owned ticket status, safely labels real tickets and preserves ticket links', async () => {
    const p = page(); await p.auth(buyer);
    const cards = p.elements.get('collection-grid').children;
    assert.equal(cards.length, 5);
    assert.equal(p.elements.get('collection-total').textContent, '05');
    assert.equal(p.elements.get('collection-minted').textContent, '02');
    assert.equal(p.elements.get('collection-events').textContent, '02');
    assert.equal(cards[0].href, 'ticket-detail.php?id=ticket-0');
    assert.equal(cards[0].children[0].children[2].children[2].textContent, '<img src=x onerror=alert(1)>');
    assert.equal(cards[0].children[0].children[0].hidden, true);
});
test('mint-status filters and search never hide the true total or rewrite ownership', async () => {
    const p = page(); await p.auth(buyer);
    p.filters[1].click(); assert.equal(p.elements.get('collection-grid').children.length, 2);
    p.filters[2].click(); assert.equal(p.elements.get('collection-grid').children.length, 3);
    p.elements.get('collection-search').value = 'A4'; p.elements.get('collection-search').listeners.input();
    assert.equal(p.elements.get('collection-grid').children.length, 1);
    assert.equal(p.elements.get('collection-grid').children[0].href, 'ticket-detail.php?id=ticket-4');
    assert.equal(p.elements.get('collection-total').textContent, '05');
    p.elements.get('collection-search').value = 'no such ticket'; p.elements.get('collection-search').listeners.input();
    assert.equal(p.elements.get('collection-empty').hidden, false);
    assert.equal(p.elements.get('collection-browse').hidden, true);
});
test('other owners and duplicate responses cannot appear as extra collectibles', async () => {
    const mine = { id: 'mine', ownerUid: 'buyer-1', eventId: 'event-a', status: 'VALID' };
    const p = page({ records: [mine, { ...mine }, { ...mine, id: 'someone-else', ownerUid: 'buyer-2' }] }); await p.auth(buyer);
    assert.equal(p.elements.get('collection-grid').children.length, 1);
    assert.deepEqual(p.eventReads, ['event-a']);
});
test('missing event details do not prevent a ticket from receiving collectible artwork', async () => {
    const p = page({ eventError: true, records: [{ id: 'legacy', ownerUid: 'buyer-1', eventId: 'missing', status: 'USED' }] }); await p.auth(buyer);
    assert.equal(p.elements.get('collection-grid').children.length, 1);
    assert.equal(p.elements.get('collection-error').hidden, true);
});
test('empty and failed collections show honest states and refreshing recovers', async () => {
    const empty = page({ records: [] }); await empty.auth(buyer);
    assert.equal(empty.elements.get('collection-total').textContent, '00'); assert.equal(empty.elements.get('collection-empty').hidden, false);
    const p = page({ fail: true }); await p.auth(buyer);
    assert.equal(p.elements.get('collection-error').hidden, false); assert.equal(p.elements.get('collection-refresh').disabled, false);
    p.recover(); await p.elements.get('collection-refresh').click();
    assert.equal(p.elements.get('collection-grid').children.length, 5); assert.equal(p.elements.get('collection-error').hidden, true);
});
test('late account responses cannot reveal the previous buyer collection and non-buyers make no reads', async () => {
    let resolve;
    const p = page({ getTickets: () => new Promise(done => { resolve = done; }) });
    await p.auth({ uid: 'staff', role: 'organizer' }); assert.equal(p.reads(), 0);
    await p.auth(buyer); await p.auth(null); resolve(p.records); await flush();
    assert.equal(p.elements.get('collection-grid').children.length, 0);
    assert.equal(p.elements.get('collection-status').textContent, 'Sign in to view your collection.');
    await p.timers[0](); assert.equal(p.reads(), 1);
});
