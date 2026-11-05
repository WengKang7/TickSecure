const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the actual shared bootstrap. Firebase/storage boundaries are isolated;
// these checks never sign in or modify the live Firebase project.
function bootstrap(options = {}) {
    const calls = [], auth = {}, session = Symbol('browser session'), settings = new Map();
    const window = {
        location: { search: options.search || '', hostname: 'localhost' },
        localStorage: { getItem: key => settings.get(key), setItem: (key, value) => settings.set(key, value) }
    };
    const context = {
        window, URL, URLSearchParams, console: { log() {} },
        initializeApp: () => ({}), getAuth: () => auth,
        getFirestore: () => ({}), getStorage: () => ({}), getFunctions: () => ({}),
        browserSessionPersistence: session,
        setPersistence: async (instance, persistence) => {
            calls.push(['persistence', instance, persistence]);
            if (options.persistence) await options.persistence();
        }
    };
    for (const service of ['Auth', 'Firestore', 'Storage', 'Functions'])
        context['connect' + service + 'Emulator'] = () => calls.push(['emulator', service]);
    const source = fs.readFileSync('assets/js/firebase-init.js', 'utf8')
        .replace(/^import .*;\r?\n/gm, '')
        .replace(/^export \{.*\};\r?\n?/gm, '')
        .replaceAll('import.meta.url', JSON.stringify('http://localhost/ticksecure-ui/assets/js/firebase-init.js'));
    const ready = vm.runInNewContext('(async () => {\n' + source + '\n})()', context);
    return { ready, window, calls, auth, session };
}

test('all shared authentication waits for tab-session persistence before exposing Firebase', async () => {
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const state = bootstrap({ persistence: () => pending });
    assert.equal(state.window.tsFirebase, undefined);
    assert.equal(state.calls.length, 1);
    assert.equal(state.calls[0][1], state.auth);
    assert.equal(state.calls[0][2], state.session);
    finish(); await state.ready;
    assert.equal(state.window.tsFirebase.auth, state.auth);
});

test('local emulator connection happens before persistence and preserves backend configuration', async () => {
    const state = bootstrap({ search: '?firebaseEmulator=1' });
    await state.ready;
    assert.deepEqual(state.calls.map(call => call[0]), ['emulator', 'emulator', 'emulator', 'emulator', 'persistence']);
    assert.equal(state.window.tsFirebase.emulator.enabled, true);
    assert.equal(state.window.tsFirebase.backend.mode, 'firebase');
    assert.equal(state.window.tsFirebase.backend.endpoint, 'http://localhost/ticksecure-ui/api/backend.php');
});

test('unavailable session storage never silently falls back to a permanent login', async () => {
    const state = bootstrap({ persistence: async () => { throw Error('Session storage unavailable'); } });
    await assert.rejects(state.ready, /Session storage unavailable/);
    assert.equal(state.window.tsFirebase, undefined);
    assert.equal(state.calls.filter(call => call[0] === 'persistence').length, 1);
});
