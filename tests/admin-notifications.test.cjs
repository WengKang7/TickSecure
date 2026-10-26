const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const rootPath = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(rootPath, 'assets/js/admin-notifications.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');

function fixture(profile = { uid: 'admin-1', role: 'admin', status: 'active', emailVerified: false }, uid = 'admin-1') {
    const windowEvents = {}, documentEvents = {}, authEvents = [], subscriptions = [];
    let document;
    class Element {
        constructor() { this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.hidden = false; }
        addEventListener(type, callback) { this.listeners[type] = callback; }
        setAttribute(key, value) { this.attributes[key] = value; }
        getAttribute(key) { return this.attributes[key]; }
        append(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); }
        replaceChildren() { this.children = []; }
        contains(target) { return this === target || this.children.some(child => child.contains(target)); }
        focus() { document.activeElement = this; }
        click() { this.listeners.click?.({ target: this }); }
    }
    const names = ['attention', 'attention-toggle', 'attention-dot', 'attention-panel', 'attention-status', 'attention-list', 'attention-close', 'attention-retry'];
    const elements = Object.fromEntries(names.map(name => [name, new Element()]));
    const get = name => elements['attention' + (name ? '-' + name : '')];
    get('').dataset.reviewBase = '../admin/';
    get('').append(get('toggle'), get('panel'));
    get('panel').append(get('status'), get('list'), get('close'), get('retry'));
    get('panel').hidden = get('dot').hidden = get('retry').hidden = true;
    document = {
        activeElement: null,
        getElementById: id => elements[id.replace(/^admin-/, '')],
        createElement: () => new Element(),
        addEventListener: (type, callback) => { documentEvents[type] = callback; }
    };
    const window = { tsCurrentUser: profile, addEventListener: (type, callback) => { windowEvents[type] = callback; } };
    const auth = { currentUser: uid ? { uid } : null, onAuthStateChanged: callback => { authEvents.push(callback); } };
    vm.runInNewContext(source, {
        window, document, auth, db: {}, encodeURIComponent,
        collection: (_db, name) => name,
        where: (field, op, value) => ({ field, op, value }),
        query: (name, ...filters) => ({ name, filters }),
        onSnapshot: (q, next, error) => {
            const subscription = { ...q, next, error, stopped: 0 };
            subscriptions.push(subscription);
            return () => subscription.stopped++;
        }
    });
    const emit = (name, records, offset = 0) => subscriptions.slice(offset).find(s => s.name === name).next({
        docs: records.map(([id, data]) => ({ id, data: () => data }))
    });
    const empty = (offset = 0) => ['Events', 'Users', 'Complaints'].forEach(name => emit(name, [], offset));
    const changeAuth = (nextProfile, nextUid) => {
        window.tsCurrentUser = nextProfile;
        auth.currentUser = nextUid ? { uid: nextUid } : null;
        authEvents.forEach(callback => callback(auth.currentUser));
        windowEvents['ts-auth-ready']({ detail: nextProfile });
    };
    return { get, window, auth, subscriptions, emit, empty, changeAuth, windowEvents, documentEvents, document,
        links: () => get('list').children.map(li => li.children[0]) };
}

test('admin bell watches pending events, organizer applications and open complaints only', () => {
    const p = fixture();
    assert.deepEqual(JSON.parse(JSON.stringify(p.subscriptions.map(({ name, filters }) => ({ name, filters })))), [
        { name: 'Events', filters: [{ field: 'status', op: '==', value: 'PENDING_REVIEW' }] },
        { name: 'Users', filters: [{ field: 'role', op: '==', value: 'organizer' }, { field: 'status', op: '==', value: 'pending' }] },
        { name: 'Complaints', filters: [{ field: 'status', op: '==', value: 'OPEN' }] }
    ]);
    assert.equal(p.get('dot').hidden, true);
    assert.match(p.get('status').textContent, /Checking/);
    p.empty();
    assert.match(p.get('status').textContent, /No pending actions/);
});

test('a new event raises the red dot; opening it keeps it pending until approval removes it', () => {
    const p = fixture();
    p.empty();
    p.emit('Events', [['event-1', { name: 'Concert' }]]);
    assert.equal(p.get('dot').hidden, false);
    assert.equal(p.get('toggle').getAttribute('aria-label'), 'Notifications: 1 pending action');
    p.get('toggle').click();
    assert.equal(p.get('panel').hidden, false);
    assert.equal(p.get('dot').hidden, false);
    assert.equal(p.links()[0].href, '../admin/event-review.php?id=event-1');
    p.emit('Events', []);
    assert.equal(p.get('dot').hidden, true);
    assert.match(p.get('status').textContent, /No pending actions/);
});

test('all review destinations use document IDs safely and render submitted names as plain text', () => {
    const p = fixture();
    p.emit('Events', [['event&other=1', { name: '<img src=x onerror=alert(1)>', id: 'spoofed', submittedAt: '2026-10-24' }]]);
    p.emit('Users', [['org/1', { organizationName: 'Example Organizer', createdAt: '2026-10-23' }]]);
    p.emit('Complaints', [['complaint#1', { referenceNumber: 'CMP001', createdAt: '2026-10-22' }]]);
    const links = p.links();
    assert.deepEqual(links.map(link => link.href), [
        '../admin/event-review.php?id=event%26other%3D1',
        '../admin/organizer-detail.php?id=org%2F1',
        '../admin/complaint-detail.php?id=complaint%231'
    ]);
    assert.equal(links[0].children[0].textContent, '<img src=x onerror=alert(1)>');
    assert.equal(links[0].children[0].children.length, 0);
    assert.equal(p.get('toggle').getAttribute('aria-label'), 'Notifications: 3 pending actions');
});

test('subscriptions require the active authenticated admin profile, including provisioned admins', () => {
    for (const [profile, uid] of [
        [null, null], [{ uid: 'o', role: 'organizer', status: 'active' }, 'o'],
        [{ uid: 'a', role: 'admin', status: 'suspended' }, 'a'],
        [{ uid: 'a', role: 'admin', status: 'active' }, 'other']
    ]) assert.equal(fixture(profile, uid).subscriptions.length, 0);
    assert.equal(fixture().subscriptions.length, 3, 'admin email verification exception is preserved');
});

test('sign-out clears state, unsubscribes listeners, and ignores delayed callbacks', () => {
    const p = fixture();
    p.emit('Events', [['e1', { name: 'Pending event' }]]);
    p.get('toggle').click();
    p.changeAuth(null, null);
    assert.ok(p.subscriptions.every(s => s.stopped === 1));
    assert.equal(p.get('dot').hidden, true);
    assert.equal(p.get('panel').hidden, true);
    assert.equal(p.links().length, 0);
    p.emit('Events', [['e1', { name: 'Late callback' }]]);
    assert.equal(p.links().length, 0);
    p.changeAuth({ uid: 'admin-2', role: 'admin', status: 'active' }, 'admin-2');
    assert.equal(p.subscriptions.length, 6);
    p.emit('Events', [['e1', { name: 'Stale session' }]]);
    assert.equal(p.links().length, 0);
});

test('partial errors retain known actions, show retry, and do not claim all caught up', () => {
    const p = fixture();
    p.emit('Events', [['e1', { name: 'Review me' }]]);
    p.emit('Users', []);
    p.subscriptions.find(s => s.name === 'Complaints').error(new Error('unavailable'));
    assert.equal(p.get('dot').hidden, false);
    assert.equal(p.get('retry').hidden, false);
    assert.match(p.get('status').textContent, /could not be loaded/);
    p.get('retry').click();
    assert.ok(p.subscriptions.slice(0, 3).every(s => s.stopped === 1));
    assert.equal(p.subscriptions.length, 6);
    p.empty(3);
    assert.equal(p.get('retry').hidden, true);
    assert.equal(p.get('dot').hidden, true);
    assert.match(p.get('status').textContent, /No pending actions/);
});

test('dropdown supports keyboard close, outside click, and stable focus during live updates', () => {
    const p = fixture();
    p.empty();
    p.emit('Events', [['e1', { name: 'First' }]]);
    p.get('toggle').click();
    assert.equal(p.get('toggle').getAttribute('aria-expanded'), 'true');
    assert.equal(p.document.activeElement, p.get('close'));
    p.links()[0].focus();
    p.emit('Events', [['e1', { name: 'Updated' }], ['e2', { name: 'New' }]]);
    assert.equal(p.document.activeElement, p.links()[0]);
    p.emit('Events', [['e2', { name: 'New' }]]);
    assert.equal(p.document.activeElement, p.get('close'));
    let prevented = false;
    p.documentEvents.keydown({ key: 'Escape', preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(p.get('panel').hidden, true);
    assert.equal(p.document.activeElement, p.get('toggle'));
    p.get('toggle').click();
    p.documentEvents.click({ target: p.get('close') });
    assert.equal(p.get('panel').hidden, false);
    p.documentEvents.click({ target: {} });
    assert.equal(p.get('panel').hidden, true);
});

test('leaving a page releases live subscriptions and browser back restores them once', () => {
    const p = fixture();
    p.windowEvents.pagehide();
    assert.ok(p.subscriptions.every(s => s.stopped === 1));
    p.windowEvents.pageshow();
    p.windowEvents.pageshow();
    assert.equal(p.subscriptions.length, 6);
    p.empty(3);
    p.emit('Events', [['e1', { name: 'Back navigation' }]], 3);
    assert.equal(p.get('dot').hidden, false);
});

test('shared PHP layout renders the hidden accessible bell on admin pages only', () => {
    const php = process.env.PHP_BINARY || 'C:/xampp/php/php.exe';
    const render = role => execFileSync(php, ['-r', "require $argv[1]; render_dashboard_page($argv[2], 'Test', 'dashboard', '');", path.join(rootPath, 'shared/ui.php'), role], { encoding: 'utf8' });
    const html = render('admin');
    assert.match(html, /id="admin-attention-toggle"[^>]+aria-expanded="false"[^>]+aria-controls="admin-attention-panel"/);
    assert.match(html, /id="admin-attention-dot"[^>]+hidden/);
    assert.match(html, /id="admin-attention-panel"[^>]+hidden/);
    assert.match(html, /data-review-base="\.\.\/admin\/"/);
    assert.match(html, /admin-notifications\.js\?v=\d+/);
    const organizer = render('organizer');
    assert.doesNotMatch(organizer, /admin-attention|admin-notifications\.js/);
    assert.match(organizer, /href="\.\.\/organizer\/notifications\.php" aria-label="Notifications"/);
});
