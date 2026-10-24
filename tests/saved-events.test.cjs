const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createPage(options = {}) {
    const elements = new Map();
    const createElement = () => ({
        value: '', children: [], attributes: {}, listeners: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, callback) { this.listeners[name] = callback; },
        appendChild(child) { this.children.push(child); },
        replaceChildren(...children) { this.children = children; this.innerHTML = ''; },
        querySelectorAll() { return []; }
    });
    ['event-search', 'events-grid', 'events-count', 'all-events-btn', 'saved-events-btn', 'events-results-title'].forEach(id => elements.set(id, createElement()));
    let ready;
    let favoriteReads = 0;
    const window = {
        location: { href: 'http://localhost/ticksecure-ui/public/events.php?view=saved', search: '?view=saved' },
        history: { replaceState(_state, _title, url) { window.location.href = String(url); } },
        tsCurrentUser: options.guest ? null : { uid: 'buyer-1' },
        tsEvents: { getPublishedEvents: async () => [
            { id: 'favorite', name: 'Saved concert', venueName: 'The Hall' },
            { id: 'other', name: 'Other concert', venueName: 'The Arena' }
        ] },
        tsUsers: { getFavoriteEventIds: async () => {
            favoriteReads++;
            if (options.error) throw Error('Unavailable');
            return options.getFavorites ? options.getFavorites() : ['favorite', 'unpublished'];
        } },
        addEventListener(type, callback) { if (type === 'ts-auth-ready') ready = callback; }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/events.js'), 'utf8'), {
        window, document: { getElementById: id => elements.get(id), createElement }, URL, URLSearchParams
    });
    return { elements, window, ready: () => ready(), favoriteReads: () => favoriteReads };
}

test('saved view lists only published favorites and search stays within favorites', async () => {
    const page = createPage();
    await page.ready();
    const grid = page.elements.get('events-grid');
    assert.match(grid.innerHTML, /Saved concert/);
    assert.doesNotMatch(grid.innerHTML, /Other concert|unpublished/);
    assert.equal(page.elements.get('events-count').textContent, '1 saved event');
    const search = page.elements.get('event-search');
    search.value = 'Arena';
    search.listeners.input();
    assert.equal(grid.children[0].textContent, 'No events match your search.');
    page.elements.get('all-events-btn').listeners.click();
    assert.match(grid.innerHTML, /Other concert/);
    assert.doesNotMatch(page.window.location.href, /view=saved/);
});

test('guests cannot read favorites and receive a sign-in link for the saved view', async () => {
    const page = createPage({ guest: true });
    await page.ready();
    assert.equal(page.favoriteReads(), 0);
    const message = page.elements.get('events-grid').children[0];
    assert.match(message.textContent, /Sign in/);
    assert.equal(message.children[0].href, '../auth/login.php');
});

test('a favorites lookup failure shows a retry message while all events remains usable', async () => {
    const page = createPage({ error: true });
    await page.ready();
    assert.match(page.elements.get('events-grid').children[0].textContent, /could not be loaded/);
    page.elements.get('all-events-btn').listeners.click();
    assert.match(page.elements.get('events-grid').innerHTML, /Other concert/);
});

test('sign-out during a favorites read cannot restore the previous user saved list', async () => {
    let resolveFavorites;
    const page = createPage({ getFavorites: () => new Promise(resolve => { resolveFavorites = resolve; }) });
    const initial = page.ready();
    page.window.tsCurrentUser = null;
    await page.ready();
    resolveFavorites(['favorite']);
    await initial;
    assert.match(page.elements.get('events-grid').children[0].textContent, /Sign in/);
});
