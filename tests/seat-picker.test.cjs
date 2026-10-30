const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
    constructor() { this.children = []; this.attributes = {}; this.style = {}; this.listeners = {}; this.value = ''; }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    removeAttribute(key) { delete this.attributes[key]; }
    addEventListener(key, action) { this.listeners[key] = action; }
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function page(options = {}) {
    const html = fs.readFileSync('buyer/seat-picker.php', 'utf8');
    const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element()]));
    const listeners = {}, timers = [], writes = [], views = [], previews = [], updates3D = [], visibility3D = [];
    let controls3D, disposals = 0;
    let now = Date.now();
    const seats = ['AVAILABLE','AVAILABLE','HELD','SOLD'].map((status, index) => ({ id: 'seat' + index, seatLabel: 'Main-A' + (index + 1), sectionId: 'Main', row: 'A', number: String(index + 1), status,
        position: { x: 10 + 5 * index, y: 30, width: 2, height: 2, shape: 'circle', page: 1 } }));
    const data = { seats, unitPrice: 100, maxPerBuyer: 4, categoryName: 'Standard', eventName: 'Concert', venueName: 'Hall', geometry: { imageWidth: 800, imageHeight: 600, page: 1, decorations: [] } };
    const window = { location: { search: options.search || '?eventId=event1&sectionId=Main&qty=2', href: '' },
        tsDecision: async () => options.cancelDecision ? null : {},
        tsCurrentUser: { uid: 'buyer', walletAddress: options.wallet ? '0x' + '1'.repeat(40) : '' },
        addEventListener: (key, action) => { listeners[key] = action; },
        tsVenueRenderer: { renderBoard: (id, sections, config) => views.push({ sections, config }) },
        tsSeats: {
            getSeatMap: async () => options.getMap ? options.getMap() : structuredClone(data),
            holdSelectedSeats: async (event, section, ids) => { writes.push({ event, section, ids: [...ids] }); return options.hold ? options.hold(ids) : {
                seats: ids.map(id => ({ id, seatLabel: seats.find(s => s.id === id).seatLabel, sectionId: section })), reservationExpiry: new Date(now + 600000).toISOString()
            }; },
            releaseSeats: async (ids, context) => { writes.push({ release: [...ids], context }); if (options.failRelease) throw Error('Release unavailable'); }
        }
    };
    if (options.threeD) window.tsSeatView3D = { mount: (container, controls) => {
        controls3D = controls; if (options.fail3D) return null;
        const info = {pages:[1],page:1,viewSeatId:null,peopleAvailable:true,showPeople:false,peopleMotion:!options.reducedMotion,reducedMotion:!!options.reducedMotion};
        const notify = () => controls.onViewChange({...info});
        return {
            update(model, selected) { updates3D.push({ model, selected: [...selected] }); notify(); },
            viewFrom(id) { previews.push(id); controls.onFocus(id); info.viewSeatId=id; notify(); },
            overview() { info.viewSeatId=null; notify(); },
            setPeople(value) { info.showPeople=value; notify(); },
            setPeopleMotion(value) { info.peopleMotion=value; notify(); },
            setVisible(value) { visibility3D.push(value); },
            dispose() { disposals++; }, zoom() {}, reset() {}, setPage() {}
        };
    } };
    const context = vm.createContext({ window, document: { getElementById: id => elements.get(id), createElement: () => new Element(), hidden: false }, URLSearchParams,
        Date: class extends Date { static now() { return now; } }, setInterval: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearInterval() {} });
    vm.runInContext(fs.readFileSync('assets/js/seat-picker.js', 'utf8'), context);
    return { elements, window, views, writes, data, previews, updates3D, visibility3D, disposals:()=>disposals, select3D:id=>controls3D.onSeatSelect(id), ready: flush, auth: () => listeners['ts-auth-ready'](), advance: ms => { now += ms; timers.filter(t => t.ms === 1000).forEach(t => t.fn()); },
        people(value) { elements.get('picker-people').checked=value; elements.get('picker-people').listeners.change(); },
        select: id => views.at(-1).config.onSeatSelect('Main', '', {}, id), click: id => elements.get(id).listeners.click({ preventDefault() {} }) };
}
test('buyer selects only available exact IDs and reserves before wallet continuation', async () => {
    const p = page(); await p.ready();
    assert.equal(p.elements.get('picker-seat-list').children[2].disabled, true);
    assert.equal(p.elements.get('picker-seat-list').children[3].disabled, true);
    p.select('seat2'); assert.equal(p.elements.get('picker-count').textContent, '0 of 2 seats selected');
    p.select('seat0'); p.select('seat1');
    assert.equal(p.elements.get('picker-total').textContent, 'RM220.00');
    assert.equal(p.elements.get('picker-continue').attributes['aria-disabled'], 'true');
    await p.click('picker-reserve');
    assert.deepEqual(p.writes[0], { event: 'event1', section: 'Main', ids: ['seat0','seat1'] });
    const url = new URL(p.elements.get('picker-continue').href, 'http://localhost/buyer/');
    assert.equal(url.pathname, '/buyer/wallet.php');
    const checkout = new URL(url.searchParams.get('redirect'), 'http://localhost/buyer/');
    assert.equal(checkout.searchParams.get('seatIds'), 'seat0,seat1');
    assert.equal(checkout.searchParams.get('qty'), '2');
    p.advance(601000); assert.equal(p.elements.get('picker-continue').attributes['aria-disabled'], 'true');
    assert.equal(p.writes.length, 1, 'local expiry never releases a potentially renewed server hold');
});
test('a failed release retains the hold and blocks navigation', async () => {
    const p = page({ failRelease: true, wallet: true }); await p.ready(); p.select('seat0'); p.select('seat1'); await p.click('picker-reserve');
    assert.ok(p.elements.get('picker-continue').href.startsWith('checkout.php?'));
    await p.click('picker-auto');
    assert.equal(p.window.location.href, ''); assert.equal(p.elements.get('picker-error').textContent, 'Release unavailable');
    assert.equal(p.elements.get('picker-continue').attributes['aria-disabled'], 'false');
});
test('auth changes discard late reservation responses', async () => {
    let resolve;
    const p = page({ hold: () => new Promise(done => { resolve = done; }) }); await p.ready(); p.select('seat0'); p.select('seat1');
    const pending = p.click('picker-reserve');
    p.window.tsCurrentUser = null; await p.auth();
    resolve({ seats: [{ id: 'seat0', seatLabel: 'A1' },{ id: 'seat1', seatLabel: 'A2' }], reservationExpiry: new Date(Date.now() + 600000).toISOString() }); await pending;
    assert.equal(p.elements.get('picker-continue').attributes['aria-disabled'], 'true');
    assert.equal(p.elements.get('picker-seat-list').children.length, 0);
});
test('malformed quantity and stale availability cannot bypass the selection contract', async () => {
    const invalid = page({ search: '?eventId=event1&sectionId=Main&qty=1.5' }); await invalid.ready();
    assert.match(invalid.elements.get('picker-error').textContent, /valid category and quantity/);
    const p = page({ hold: async () => { throw Error('A seat was taken'); } }); await p.ready(); p.select('seat0'); p.select('seat1'); await p.click('picker-reserve');
    assert.equal(p.elements.get('picker-continue').attributes['aria-disabled'], 'true');
    assert.equal(p.elements.get('picker-error').textContent, 'A seat was taken');
});

test('3D is the buyer default, previews do not reserve, and switching to 2D preserves the exact selection', async () => {
    const p = page({threeD:true}); await p.ready();
    assert.equal(p.elements.get('buyer-seat-map').hidden,true);
    assert.equal(p.elements.get('buyer-seat-3d').hidden,false);
    p.select3D('seat2'); p.select3D('seat3'); assert.equal(p.elements.get('picker-count').textContent,'0 of 2 seats selected');
    p.select3D('seat0'); await p.click('picker-view-seat');
    assert.deepEqual(p.previews,['seat0']); assert.equal(p.writes.length,0);
    assert.equal(p.elements.get('picker-view-status').textContent,'View from Main-A1');
    await p.click('picker-overview'); assert.equal(p.elements.get('picker-view-status').textContent,'Venue overview');
    await p.click('picker-mode-2d'); assert.equal(p.elements.get('buyer-seat-map').hidden,false);
    assert.deepEqual([...p.views.at(-1).config.selectedSeatIds],['seat0']);
    p.select('seat1'); await p.click('picker-mode-3d');
    assert.deepEqual(p.updates3D.at(-1).selected,['seat0','seat1']);
    await p.click('picker-reserve'); assert.deepEqual(p.writes[0].ids,['seat0','seat1']);
    p.window.tsCurrentUser=null; await p.auth(); assert.equal(p.disposals(),1);
});

test('3D availability refresh removes seats taken elsewhere and missing canvas falls back to a working 2D picker', async () => {
    const p = page({threeD:true}); await p.ready(); p.select3D('seat0');
    p.data.seats[0].status='SOLD'; await p.click('picker-refresh');
    assert.deepEqual(p.updates3D.at(-1).selected,[]);
    assert.equal(p.elements.get('picker-reserve').disabled,true);
    const fallback = page({threeD:true,fail3D:true}); await fallback.ready();
    assert.equal(fallback.elements.get('picker-3d-fallback').hidden,false);
    assert.equal(fallback.elements.get('picker-mode-3d').disabled,true);
    assert.equal(fallback.elements.get('buyer-seat-map').hidden,false);
    fallback.select('seat0'); fallback.select('seat1'); await fallback.click('picker-reserve');
    assert.deepEqual(fallback.writes[0].ids,['seat0','seat1']);
});


test('cancelling seat release keeps the hold and prevents leaving the picker', async () => {
    const p = page({ cancelDecision: true }); await p.ready();
    p.select('seat0'); p.select('seat1'); await p.click('picker-reserve');
    const writesBefore = p.writes.length;
    await p.click('picker-back');
    assert.equal(p.writes.length, writesBefore);
    assert.equal(p.window.location.href, '');
    assert.equal(p.elements.get('picker-continue').attributes['aria-disabled'], 'false');
});

test('audience controls stay visual and preserve their choice across 2D, preview and availability refresh', async () => {
    const p=page({threeD:true}); await p.ready();
    assert.equal(p.elements.get('picker-people').checked,false);
    assert.equal(p.elements.get('picker-people').disabled,false);
    p.select3D('seat0'); p.people(true);
    assert.equal(p.elements.get('picker-people-motion').disabled,false);
    await p.click('picker-people-motion');
    assert.equal(p.elements.get('picker-people-motion').textContent,'Play animation');
    await p.click('picker-view-seat');
    assert.equal(p.elements.get('picker-people').checked,true);
    await p.click('picker-mode-2d');
    assert.equal(p.elements.get('picker-people-controls').hidden,true);
    assert.equal(p.visibility3D.at(-1),false);
    p.select('seat1'); await p.click('picker-mode-3d'); await p.click('picker-refresh');
    assert.equal(p.visibility3D.at(-1),true);
    assert.equal(p.elements.get('picker-people').checked,true);
    assert.equal(p.elements.get('picker-people-motion').textContent,'Play animation');
    assert.deepEqual(p.updates3D.at(-1).selected,['seat0','seat1']);
    assert.deepEqual(p.writes,[]);
    p.people(false);
    assert.equal(p.elements.get('picker-people-motion').disabled,true);
    await p.click('picker-reserve'); assert.deepEqual(p.writes[0].ids,['seat0','seat1']);
});

test('reduced motion shows static people and disables the animation button', async () => {
    const p=page({threeD:true,reducedMotion:true}); await p.ready(); p.people(true);
    assert.equal(p.elements.get('picker-people').checked,true);
    assert.equal(p.elements.get('picker-people-motion').disabled,true);
    assert.equal(p.elements.get('picker-people-motion').textContent,'Reduced motion');
    assert.equal(p.elements.get('picker-people-motion').attributes['aria-pressed'],'false');
    assert.deepEqual(p.writes,[]);
});
