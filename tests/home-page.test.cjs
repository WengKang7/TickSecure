const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/home-page.js'), 'utf8');
const api = vm.runInNewContext(source.replace(/export function /g, 'function ') +
    ';({ updateHomeAccountActions, selectUpcomingEvents, homeEventPrice, safeHomePoster, initHomeSlideshow })', { URL, Intl, Date });

test('homepage account links are shown only for guests, across sign-in and sign-out', () => {
    const links = [{ hidden: true }, { hidden: true }];
    const root = { querySelectorAll: () => links };
    api.updateHomeAccountActions(null, root);
    assert.ok(links.every(link => !link.hidden));
    for (const role of ['buyer', 'organizer', 'admin']) {
        api.updateHomeAccountActions({ uid: 'user', role }, root);
        assert.ok(links.every(link => link.hidden));
    }
    api.updateHomeAccountActions(null, root);
    assert.ok(links.every(link => !link.hidden));
});

test('upcoming events use the Malaysian date, exclude past dates and select the nearest three', () => {
    const events = [
        { id: 'past', date: '2026-10-31' }, { id: 'later', date: '2026-11-20' },
        { id: 'tba' }, { id: 'today', date: '2026-11-01' },
        { id: 'soon', date: '2026-11-02' }, { id: 'bad', date: 'not-a-date' }
    ];
    const selected = api.selectUpcomingEvents(events, new Date('2026-10-31T17:00:00Z'));
    assert.deepEqual(Array.from(selected, event => event.id), ['today', 'soon', 'later']);
    assert.equal(events[0].id, 'past');
    assert.equal(api.selectUpcomingEvents([], new Date()).length, 0);
});

test('prices use the lowest category price, preserve free entry, and fall back when prices are missing', () => {
    assert.equal(api.homeEventPrice({ categories: { a: { price: 200 }, b: { price: 49.5 } } }), 'RM49.50');
    assert.equal(api.homeEventPrice({ categories: { a: { price: 0 }, b: { price: 50 } } }), 'Free');
    assert.equal(api.homeEventPrice({ startingPrice: 'RM88' }), 'RM88');
    assert.equal(api.homeEventPrice({ categories: { a: { price: 'invalid' } } }), 'Price TBA');
});

test('poster URLs allow local and HTTPS posters while rejecting executable URLs', () => {
    const base = 'http://localhost/ticksecure-ui/index.php';
    assert.equal(api.safeHomePoster('uploads/poster.jpg', base), 'http://localhost/ticksecure-ui/uploads/poster.jpg');
    assert.equal(api.safeHomePoster('https://example.com/event.jpg', base), 'https://example.com/event.jpg');
    assert.equal(api.safeHomePoster('javascript:alert(1)', base), '');
    assert.equal(api.safeHomePoster('data:text/html,hello', base), '');
});

function carousel(reduced = false) {
    const element = () => ({ attributes: {}, listeners: {}, classList: { toggle() {} },
        setAttribute(key, value) { this.attributes[key] = value; },
        addEventListener(type, handler) { this.listeners[type] = handler; } });
    const slides = [element(), element(), element()], dots = [element(), element(), element()];
    const pause = element(), next = element(), track = element(), showcase = element();
    showcase.querySelectorAll = selector => selector === '.home-slide' ? slides : dots;
    showcase.contains = target => target === pause || target === next || dots.includes(target);
    const root = element();
    root.querySelector = () => showcase;
    root.getElementById = id => ({ 'home-slide-pause': pause, 'home-slide-next': next, 'home-slides': track })[id];
    const timers = new Map();
    let counter = 0, motionListener;
    const browser = element();
    browser.matchMedia = () => ({ matches: reduced, addEventListener(_type, handler) { motionListener = handler; } });
    browser.clearInterval = id => timers.delete(id);
    browser.setInterval = handler => { timers.set(++counter, handler); return counter; };
    api.initHomeSlideshow(root, browser);
    return { slides, dots, pause, next, root, showcase, track, timers, browser,
        tick: () => [...timers.values()][0]?.(), motion: value => motionListener({ matches: value }) };
}

test('slideshow advances, supports next/dots, and updates accessible selected-slide state', () => {
    const c = carousel();
    assert.equal(c.timers.size, 1);
    c.tick();
    assert.equal(c.slides[1].attributes['aria-hidden'], 'false');
    assert.equal(c.dots[1].attributes['aria-pressed'], 'true');
    c.next.listeners.click();
    assert.equal(c.slides[2].attributes['aria-hidden'], 'false');
    c.dots[0].listeners.click();
    assert.equal(c.slides[0].attributes['aria-hidden'], 'false');
    assert.equal(c.slides[2].attributes['aria-hidden'], 'true');
});

test('slideshow pauses for hover, keyboard focus, explicit pause and hidden pages', () => {
    const c = carousel();
    c.showcase.listeners.mouseenter();
    assert.equal(c.timers.size, 0);
    c.showcase.listeners.mouseleave();
    assert.equal(c.timers.size, 1);
    c.showcase.listeners.focusin();
    assert.equal(c.timers.size, 0);
    c.showcase.listeners.focusout({ relatedTarget: null });
    assert.equal(c.timers.size, 1);
    c.pause.listeners.click();
    assert.equal(c.pause.attributes['aria-label'], 'Play slideshow');
    assert.equal(c.timers.size, 0);
    c.pause.listeners.click();
    c.root.hidden = true;
    c.root.listeners.visibilitychange();
    assert.equal(c.timers.size, 0);
    c.root.hidden = false;
    c.root.listeners.visibilitychange();
    assert.equal(c.timers.size, 1);
    c.browser.listeners.pagehide();
    assert.equal(c.timers.size, 0);
});

test('reduced-motion users get a static initial showcase and manual slide controls', () => {
    const c = carousel(true);
    assert.equal(c.timers.size, 0);
    assert.equal(c.pause.attributes['aria-pressed'], 'true');
    c.next.listeners.click();
    assert.equal(c.slides[1].attributes['aria-hidden'], 'false');
    assert.equal(c.timers.size, 0);
    c.motion(false);
    assert.equal(c.timers.size, 1);
});
