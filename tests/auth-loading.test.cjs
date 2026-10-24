const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');

function loadStatus(granted = false) {
    const attributes = new Map(granted ? [['data-ts-access', 'granted']] : []);
    const elements = new Map();
    const timers = new Map();
    let nextTimer = 0;
    let observer;
    let reloads = 0;
    const status = {
        attributes: new Map(),
        setAttribute(key, value) { this.attributes.set(key, value); },
        querySelector(selector) {
            if (!elements.has(selector)) elements.set(selector, {
                hidden: true, addEventListener(_, callback) { this.click = callback; }
            });
            return elements.get(selector);
        }
    };
    const context = {
        URL,
        setTimeout: (callback, ms) => { const id = ++nextTimer; timers.set(id, { callback, ms }); return id; },
        clearTimeout: id => timers.delete(id),
        MutationObserver: class { constructor(callback) { observer = callback; } observe() {} },
        document: {
            currentScript: { src: 'http://localhost/ticksecure-ui/assets/js/auth-status.js?v=123' },
            createElement: () => status,
            body: { appendChild() {} },
            documentElement: { getAttribute: key => attributes.get(key) }
        },
        window: { location: { reload: () => reloads++ } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/auth-status.js'), 'utf8'), context);
    return { context, status, elements, timers, attributes, observer: () => observer(), reloads: () => reloads };
}

test('a stalled or missing Firebase module presents recovery while the dashboard remains locked', () => {
    const state = loadStatus();
    assert.equal(state.status.hidden, false);
    assert.equal(state.timers.size, 1);
    const timeout = [...state.timers.values()][0];
    assert.equal(timeout.ms, 15000);
    timeout.callback();
    assert.equal(state.status.attributes.get('role'), 'alert');
    assert.equal(state.elements.get('.ts-access-actions').hidden, false);
    assert.match(state.elements.get('#ts-access-message').textContent, /taking longer/);
    assert.equal(state.attributes.has('data-ts-access'), false);
    assert.equal(state.elements.get('#ts-access-login').href, 'http://localhost/ticksecure-ui/auth/login.php');
    state.elements.get('#ts-access-retry').click();
    assert.equal(state.reloads(), 1);
});

test('authorization hides the loading state and clears its timer; signing out restores it', () => {
    const state = loadStatus();
    state.attributes.set('data-ts-access', 'granted');
    state.observer();
    assert.equal(state.status.hidden, true);
    assert.equal(state.timers.size, 0);
    state.attributes.delete('data-ts-access');
    state.observer();
    assert.equal(state.status.hidden, false);
    assert.equal(state.timers.size, 1);
    assert.equal(state.elements.get('.ts-access-actions').hidden, true);
});

test('an already authorized page never waits for a second timeout', () => {
    const state = loadStatus(true);
    assert.equal(state.status.hidden, true);
    assert.equal(state.timers.size, 0);
});

test('PHP pages reference the current version of the guard and protected pages have independent recovery', () => {
    const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
    const version = Math.floor(fs.statSync(path.join(root, 'assets/js/auth-guard.js')).mtimeMs / 1000);
    for (const route of ['index.php', 'auth/login.php', 'public/events.php', 'public/event-detail.php',
        'admin/dashboard.php', 'organizer/dashboard.php', 'buyer/tickets.php', 'public/resale.php',
        'verification/scanner.php', 'verification/valid.php', 'verification/invalid.php']) {
        const html = execFileSync(php, [path.join(root, route)], { encoding: 'utf8' });
        assert.ok(html.includes('assets/js/auth-guard.js?v=' + version), route + ' must bypass the old cached guard');
        if (/^(admin|organizer|buyer|verification)\//.test(route) || route === 'public/resale.php') {
            assert.match(html, /auth-status\.js\?v=\d+/, route + ' must recover even when Firebase cannot load');
            assert.ok(html.includes('html:not([data-ts-access="granted"]) body{visibility:hidden}'));
        }
    }
});

function loadSignIn(options = {}) {
    const php = fs.readFileSync(path.join(root, 'auth/login.php'), 'utf8');
    const source = php.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
    const timers = new Map();
    const errors = [];
    let timerId = 0;
    let click;
    let onPageShow;
    const button = { disabled: false, addEventListener: (_, callback) => { click = callback; } };
    const form = {};
    const context = {
        URL, URLSearchParams,
        console: { warn() {} },
        setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; },
        clearTimeout: id => timers.delete(id),
        document: {
            getElementById: id => id === 'login-submit' ? button : form,
            addEventListener: (_, callback) => callback()
        },
        window: {
            location: { search: '', href: '' },
            addEventListener: (_, callback) => { onPageShow = callback; },
            tsValidation: {
                clearFieldErrors() {}, el: () => ({ value: 'test-password' }), val: () => 'test@example.com',
                runAll: () => true, showGlobalError: (_, title, message) => errors.push(message)
            },
            tsAuth: {
                login: options.login || (async () => ({ user: { uid: 'admin-1', emailVerified: true } })),
                syncEmailVerification: async () => {}, logout: async () => {}
            },
            tsDb: { getUserProfile: options.profile || (async () => ({ role: 'admin', status: 'active' })) }
        }
    };
    vm.runInNewContext(source, context);
    return { context, button, timers, errors, click: () => click({ preventDefault() {}, stopPropagation() {} }), pageShow: () => onPageShow({ persisted: true }) };
}

test('administrator form sign-in navigates and does not remain stuck on Signing In', async () => {
    const state = loadSignIn();
    await state.click();
    assert.equal(state.context.window.location.href, '../admin/dashboard.php');
    assert.equal(state.context.window.tsLoginInProgress, false);
    assert.equal(state.button.disabled, false);
    assert.equal(state.timers.size, 0);
    assert.deepEqual(state.errors, []);
});

test('a stalled sign-in or profile read reports a timeout and re-enables the form', async () => {
    for (const options of [{ login: () => new Promise(() => {}) }, { profile: () => new Promise(() => {}) }]) {
        const state = loadSignIn(options);
        const pending = state.click();
        if (options.profile) {
            // Let the completed credential request advance to the profile read.
            for (let i = 0; i < 10; i++) await Promise.resolve();
        }
        assert.equal(state.button.disabled, true);
        [...state.timers.values()][0]();
        await pending;
        assert.equal(state.button.disabled, false);
        assert.equal(state.context.window.tsLoginInProgress, false);
        assert.match(state.errors[0], /timed out/);
        assert.equal(state.context.window.location.href, '');
    }
});

test('returning through browser Back resets the cached disabled sign-in button', () => {
    const state = loadSignIn();
    state.button.disabled = true;
    state.button.textContent = 'Signing In...';
    state.pageShow();
    assert.equal(state.button.disabled, false);
    assert.equal(state.button.textContent, 'Sign In');
});
