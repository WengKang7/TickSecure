const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Run the real guard with Firebase and DOM boundaries stubbed. No credentials,
// network calls, or changes to the configured Firebase project are needed.
const source = fs.readFileSync(path.join(__dirname, '../assets/js/auth-guard.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '');

async function visit(route, options = {}) {
    const base = options.base ?? '/ticksecure-ui';
    const attributes = new Map();
    const events = [];
    const redirects = [];
    const failures = [];
    let profileReads = 0;
    const authOnly = [{ hidden: true }, { hidden: true }];
    const elements = {
        'public-guest-actions': { style: {} },
        'public-user-actions': { style: {} }
    };
    let authChanged;
    let signOuts = 0;
    const context = {
        URL,
        console: { error() {}, warn() {} },
        auth: {}, db: {},
        doc: (...args) => args,
        getDoc: async () => {
            profileReads++;
            if (options.profileError) throw new Error('Profile unavailable');
            return { exists: () => !options.missingProfile, data: () => options.profile };
        },
        signOut: async () => { signOuts++; },
        onAuthStateChanged: (_, callback) => { authChanged = callback; },
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
        document: {
            getElementById: id => elements[id] || null,
            querySelectorAll: () => authOnly,
            documentElement: {
                removeAttribute: key => attributes.delete(key),
                setAttribute: (key, value) => attributes.set(key, value)
            }
        },
        window: {
            tsLoginInProgress: options.loginInProgress || false,
            tsAccessStatus: { fail: message => failures.push(message) },
            location: { pathname: base + route, replace: url => redirects.push(url) },
            dispatchEvent: event => events.push(event)
        }
    };
    const moduleUrl = JSON.stringify('http://localhost' + base + '/assets/js/auth-guard.js');
    vm.runInNewContext(source.replaceAll('import.meta.url', moduleUrl), context);
    await authChanged(options.user || null);
    return { context, attributes, events, redirects, authOnly, elements, signOuts, authChanged, failures, profileReads };
}

const user = { uid: 'buyer-1', email: 'buyer@example.com', emailVerified: true, reload: async () => {} };
const buyer = { role: 'buyer', status: 'active', fullName: 'Test Buyer' };

test('guests can browse home, events, and event details at either deployment base', async () => {
    for (const base of ['', '/ticksecure-ui', '/another-folder']) {
        for (const route of ['/', '/index.php', '/public/events.php', '/public/event-detail.php']) {
            const result = await visit(route, { base });
            assert.deepEqual(result.redirects, []);
            assert.equal(result.events.length, 1, 'publish guest readiness once');
            assert.equal(result.events[0].detail, null);
            assert.ok(result.authOnly.every(element => element.hidden));
        }
    }
});

test('direct guest links to every restricted area redirect without granting access', async () => {
    for (const route of ['/buyer/booking-category.php', '/buyer/checkout.php', '/buyer/tickets.php',
        '/buyer/wallet.php', '/buyer/complaints.php', '/admin/dashboard.php', '/organizer/dashboard.php',
        '/verification/scanner.php', '/verification/valid.php', '/verification/invalid.php',
        '/public/resale.php', '/public/resale-detail.php', '/BUYER/TICKETS.PHP']) {
        const result = await visit(route);
        assert.deepEqual(result.redirects, ['/ticksecure-ui/auth/login.php']);
        assert.equal(result.attributes.has('data-ts-access'), false);
        assert.equal(result.events.length, 0);
    }
});

test('login, registration, and password recovery remain available to guests', async () => {
    for (const route of ['/auth/login.php', '/auth/register.php', '/auth/verify-email.php',
        '/auth/forgot-password.php', '/auth/reset-password.php']) {
        assert.deepEqual((await visit(route)).redirects, []);
    }
});

test('verified active buyer can enter booking and resale and see account features', async () => {
    for (const route of ['/buyer/booking-category.php', '/buyer/checkout.php', '/public/resale.php', '/public/resale-detail.php']) {
        const result = await visit(route, { user, profile: { ...buyer, uid: 'untrusted-profile-uid' } });
        assert.deepEqual(result.redirects, []);
        assert.equal(result.attributes.get('data-ts-access'), 'granted');
        assert.equal(result.events[0].detail.uid, user.uid);
        assert.ok(result.authOnly.every(element => !element.hidden));
    }
});

test('role restrictions keep buyers out of organizer, admin, and scanner pages', async () => {
    for (const route of ['/admin/dashboard.php', '/organizer/dashboard.php', '/verification/scanner.php']) {
        const result = await visit(route, { user, profile: buyer });
        assert.deepEqual(result.redirects, ['/ticksecure-ui/public/events.php']);
        assert.equal(result.attributes.has('data-ts-access'), false);
    }
    for (const role of ['organizer', 'admin']) {
        const options = { user, profile: { ...buyer, role } };
        assert.equal((await visit('/' + role + '/dashboard.php', options)).attributes.get('data-ts-access'), 'granted');
        assert.equal((await visit('/verification/scanner.php', options)).attributes.get('data-ts-access'), 'granted');
    }
});

test('unverified or inactive users and unavailable profiles never unlock protected pages', async () => {
    const unverified = await visit('/buyer/checkout.php', { user: { ...user, emailVerified: false }, profile: buyer });
    assert.deepEqual(unverified.redirects, ['/ticksecure-ui/auth/verify-email.php']);
    for (const options of [{ missingProfile: true },
        { profile: { ...buyer, status: 'suspended' } }, { profile: { ...buyer, role: 'unknown' } }]) {
        const result = await visit('/buyer/checkout.php', { user, ...options });
        assert.deepEqual(result.redirects, ['/ticksecure-ui/auth/login.php']);
        assert.equal(result.attributes.has('data-ts-access'), false);
        assert.equal(result.events.length, 0);
    }
    const publicFallback = await visit('/public/events.php', { user, profileError: true });
    assert.deepEqual(publicFallback.redirects, []);
    assert.equal(publicFallback.events.length, 1);
    assert.equal(publicFallback.events[0].detail, null);
});

test('signing out on an already open protected page removes access immediately', async () => {
    const result = await visit('/buyer/tickets.php', { user, profile: buyer });
    await result.authChanged(null);
    assert.equal(result.attributes.has('data-ts-access'), false);
    assert.equal(result.context.window.tsCurrentUser, null);
    assert.ok(result.authOnly.every(element => element.hidden));
    assert.deepEqual(result.redirects, ['/ticksecure-ui/auth/login.php']);
});

test('profile failures show recovery without exposing content or redirecting in a loop', async () => {
    const result = await visit('/admin/dashboard.php', { user, profileError: true });
    assert.deepEqual(result.redirects, []);
    assert.equal(result.attributes.has('data-ts-access'), false);
    assert.equal(result.events.length, 0);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0], /could not verify/);
});

test('the guard leaves in-progress sign-in redirects to the form', async () => {
    const result = await visit('/auth/login.php', { user, profile: buyer, loginInProgress: true });
    assert.deepEqual(result.redirects, []);
    assert.equal(result.profileReads, 0);
});

test('administrator sign-in reaches the dashboard and dashboard authentication grants visibility', async () => {
    const profile = { ...buyer, role: 'admin' };
    const login = await visit('/auth/login.php', { user, profile });
    assert.deepEqual(login.redirects, ['/ticksecure-ui/admin/dashboard.php']);
    const dashboard = await visit('/admin/dashboard.php', { user, profile });
    assert.equal(dashboard.attributes.get('data-ts-access'), 'granted');
    assert.equal(dashboard.events[0].detail.role, 'admin');
});
