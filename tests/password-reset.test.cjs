const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { checkPasswordResetEmail } = require('../functions/password-reset');
const root = path.join(__dirname, '..');
const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
const user = { uid: 'account-1', email: 'member@example.com' };
const profile = { email: 'member@example.com', role: 'buyer', status: 'active' };
const cases = [
    { name: 'registered buyer', data: { email: user.email }, user, profile, expected: true },
    { name: 'registered organizer', data: { email: user.email }, user, profile: { ...profile, role: 'organizer', status: 'pending', emailVerified: false }, expected: true },
    { name: 'existing admin recovery', data: { email: user.email }, user, profile: { ...profile, role: 'admin' }, expected: true },
    { name: 'case and whitespace', data: { email: '  MEMBER@EXAMPLE.COM  ' }, user, profile, expected: true },
    { name: 'unknown auth email', data: { email: user.email }, profile, expected: false },
    { name: 'auth account without database profile', data: { email: user.email }, user, expected: false },
    { name: 'mismatched profile email', data: { email: user.email }, user, profile: { ...profile, email: 'other@example.com' }, expected: false },
    { name: 'mismatched auth email', data: { email: user.email }, user: { ...user, email: 'other@example.com' }, profile, expected: false },
    { name: 'invalid application role', data: { email: user.email }, user, profile: { ...profile, role: 'unknown' }, expected: false },
    { name: 'unavailable profile database', data: { email: user.email }, user, profileError: true, error: 'unavailable' },
    { name: 'invalid email', data: { email: 'invalid' }, error: 'invalid-argument' },
    { name: 'missing email', data: {}, error: 'invalid-argument' },
    { name: 'non-string email', data: { email: ['member@example.com'] }, error: 'invalid-argument' },
    { name: 'oversized email', data: { email: 'x'.repeat(250) + '@example.com' }, error: 'invalid-argument' }
];

test('Firebase and PHP policies agree on registered, missing, mismatched, and invalid accounts', async () => {
    const phpResults = JSON.parse(execFileSync(php, [path.join(__dirname, 'password-reset-policy.php')], {
        input: JSON.stringify(cases), encoding: 'utf8'
    }));
    for (const [index, scenario] of cases.entries()) {
        let result;
        try {
            result = await checkPasswordResetEmail(scenario.data, {
                findAuthUser: async email => {
                    assert.equal(email, 'member@example.com');
                    return scenario.user || null;
                },
                findProfile: async uid => {
                    assert.equal(uid, scenario.user.uid);
                    if (scenario.profileError) throw new Error('unavailable');
                    return scenario.profile || null;
                }
            });
        } catch (error) { result = { error: error.code || 'unavailable' }; }
        const expected = scenario.error ? { error: scenario.error } : { registered: scenario.expected };
        assert.deepEqual(result, expected, scenario.name);
        assert.deepEqual(phpResults[index], expected, 'PHP: ' + scenario.name);
    }
});

test('Firebase user-not-found is a negative result, while service failures propagate', async () => {
    const absent = await checkPasswordResetEmail({ email: user.email }, {
        findAuthUser: async () => { throw Object.assign(new Error('Absent'), { code: 'auth/user-not-found' }); }
    });
    assert.deepEqual(absent, { registered: false });
    await assert.rejects(checkPasswordResetEmail({ email: user.email }, {
        findAuthUser: async () => { throw new Error('Authentication unavailable'); }
    }), /Authentication unavailable/);
});

function loadForm(options = {}) {
    const source = fs.readFileSync(path.join(root, 'auth/forgot-password.php'), 'utf8')
        .match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\r?\n/gm, '');
    let click;
    let email = options.email || 'member@example.com';
    let eligibility = options.eligibility || (async () => ({ registered: options.registered ?? false }));
    const button = { disabled: false, addEventListener: (_, callback) => { click = callback; } };
    const success = { style: { display: 'none' } };
    const form = { querySelector: () => success };
    const feedback = [];
    const requests = [];
    const sends = [];
    const timers = new Map();
    let timerId = 0;
    const context = {
        setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; },
        clearTimeout: id => timers.delete(id),
        document: {
            getElementById: id => id === 'reset-btn' ? button : form,
            addEventListener: (_, callback) => callback()
        },
        invokeTrustedBackend: async (data, config) => { requests.push({ data, config }); return eligibility(); },
        sendPasswordResetEmail: async (_, address) => {
            sends.push(address);
            if (options.sendError) throw options.sendError;
        },
        window: {
            location: { hostname: options.hostname || 'localhost' },
            tsFirebase: { auth: {} },
            tsValidation: {
                el: () => ({}), val: () => email, clearFieldErrors() {}, runAll: () => options.valid !== false,
                showFieldError: (_, message) => feedback.push({ type: 'field', message }),
                showGlobalError: (_, title, message) => feedback.push({ type: 'error', message }),
                showGlobalSuccess: () => { success.style.display = 'block'; feedback.push({ type: 'success' }); }
            }
        }
    };
    vm.runInNewContext(source, context);
    return {
        button, success, feedback, requests, sends, timers,
        click: () => click({ preventDefault() {} }),
        change: (value, registered) => { email = value; eligibility = async () => ({ registered }); }
    };
}

test('unknown emails cannot trigger a reset or show a success message', async () => {
    for (const registered of [false, undefined, 'true']) {
        const form = loadForm({ eligibility: async () => ({ registered }) });
        await form.click();
        assert.equal(form.sends.length, 0);
        assert.equal(form.feedback[0].type, 'field');
        assert.match(form.feedback[0].message, /not registered/);
        assert.equal(form.button.disabled, false);
        assert.equal(form.timers.size, 0);
    }
});

test('eligible email is normalized and checked before the reset request', async () => {
    const form = loadForm({ email: '  MEMBER@EXAMPLE.COM  ', registered: true });
    await form.click();
    assert.equal(form.requests[0].data.email, user.email);
    assert.equal(form.requests[0].config.name, 'checkPasswordResetEmail');
    assert.deepEqual(form.sends, [user.email]);
    assert.equal(form.feedback[0].type, 'success');
    form.change('missing@example.com', false);
    await form.click();
    assert.equal(form.success.style.display, 'none', 'an old success must disappear on an unknown-email attempt');
    assert.equal(form.sends.length, 1);
    assert.equal(form.feedback[1].type, 'field');
});

test('backend errors and timeouts never fall back to sending a reset email', async () => {
    const unavailable = loadForm({ eligibility: async () => { throw Object.assign(new Error('Missing backend'), { code: 'functions/not-found' }); } });
    await unavailable.click();
    assert.equal(unavailable.sends.length, 0);
    assert.match(unavailable.feedback[0].message, /not been configured/);
    const stalled = loadForm({ eligibility: () => new Promise(() => {}) });
    const pending = stalled.click();
    [...stalled.timers.values()][0]();
    await pending;
    assert.equal(stalled.sends.length, 0);
    assert.match(stalled.feedback[0].message, /timed out/);
    assert.equal(stalled.button.disabled, false);
});

test('invalid input does not reach the backend and a send failure cannot show success', async () => {
    const invalid = loadForm({ valid: false });
    await invalid.click();
    assert.equal(invalid.requests.length, 0);
    const failed = loadForm({ registered: true, sendError: new Error('Mail unavailable') });
    await failed.click();
    assert.equal(failed.feedback[0].type, 'error');
    assert.equal(failed.success.style.display, 'none');
});

function loadPhpClient(currentUser = null, mode = 'php') {
    const source = fs.readFileSync(path.join(root, 'assets/js/backend-client.js'), 'utf8')
        .replace(/^import \{ app, auth \}.*;\r?\n/m, '')
        .replace(/^import \{[\s\S]*?\} from [^;]+;\r?\n/m, '')
        .replace(/export /g, '');
    const requests = [];
    const callableRequests = [];
    const context = {
        app: {}, auth: { currentUser },
        window: { location: { hostname: 'tickets.example.com' }, tsFirebase: { backend: { mode, compatible: true, endpoint: '/api/backend.php' } } },
        getFunctions: () => ({}),
        httpsCallable: (_functions, name) => async data => { callableRequests.push({ name, data }); return { data: { ok: true } }; },
        fetch: async (_, init) => { requests.push(init); return { ok: true, json: async () => ({ data: { registered: true } }) }; }
    };
    vm.runInNewContext(source, context);
    return { invoke: context.invokeTrustedBackend, requests, callableRequests, context };
}

test('PHP client allows public recovery/counts without a token and retains token requirements for mutations', async () => {
    const guest = loadPhpClient();
    await guest.invoke({ email: user.email }, { name: 'checkPasswordResetEmail' });
    assert.equal(guest.requests.length, 1);
    assert.equal(guest.requests[0].headers.Authorization, undefined);
    await guest.invoke({ eventId: 'published-event' }, { name: 'getEventAvailability' });
    assert.equal(guest.requests[1].headers.Authorization, undefined);
    for (const name of ['checkout', 'reserveSeats', 'syncEmailVerification', 'moderateEvent']) {
        await assert.rejects(guest.invoke({}, { name }), /signed in/);
    }
    assert.equal(guest.requests.length, 2);
    const signedIn = loadPhpClient({ getIdToken: async () => 'verified-token' });
    await signedIn.invoke({}, { name: 'checkout' });
    assert.equal(signedIn.requests[0].headers.Authorization, 'Bearer verified-token');
});


test('PHP endpoint keeps mutations authenticated and reports missing recovery configuration without success', async t => {
    for (const recoveryOnly of [false, true]) {
    const net = require('node:net');
    const { spawn } = require('node:child_process');
    const probe = net.createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const server = spawn(php, ['-S', '127.0.0.1:' + port, '-t', root], {
        windowsHide: true, env: { ...process.env, TICKSECURE_PHP_BACKEND: recoveryOnly ? '0' : '1', TICKSECURE_PHP_PASSWORD_RESET: '1' }, stdio: ['ignore', 'ignore', 'pipe']
    });
    t.after(() => server.kill());
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('PHP test server did not start')), 5000);
        server.once('error', error => { clearTimeout(timeout); reject(error); });
        server.stderr.on('data', chunk => {
            if (chunk.toString().includes('started')) { clearTimeout(timeout); resolve(); }
        });
    });
    const post = async action => {
        const response = await fetch('http://127.0.0.1:' + port + '/api/backend.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, data: { email: 'missing@example.com' } })
        });
        return { status: response.status, body: await response.json() };
    };
    for (const action of ['checkout', 'reserveSeats', 'syncEmailVerification', 'CheckPasswordResetEmail']) {
        const response = await post(action);
        assert.equal(response.status, recoveryOnly ? 410 : 401, action);
        assert.equal(response.body.error.code, recoveryOnly ? 'php_backend_disabled' : 'unauthenticated');
    }
    if (!fs.existsSync(path.join(root, 'api/firebase-config.local.php'))) {
        const response = await post('checkPasswordResetEmail');
        assert.equal(response.status, 503);
        assert.equal(response.body.error.code, 'backend_not_configured');
        assert.equal(response.body.data, undefined);
    }
    }
});


test('localhost recovery uses PHP without switching other application workflows', async () => {
    const form = loadForm({ registered: true });
    await form.click();
    assert.equal(form.requests[0].config.backend, 'php');
    const local = loadPhpClient(null, 'firebase');
    await local.invoke({ email: user.email }, { name: 'checkPasswordResetEmail', backend: 'php' });
    assert.equal(local.requests.length, 1);
    assert.equal(local.context.window.tsFirebase.backend.mode, 'firebase');
    const remote = loadForm({ hostname: 'tickets.example.com', registered: true });
    await remote.click();
    assert.equal(remote.requests[0].config.backend, undefined);
});

test('an explicitly selected PHP lookup cannot use an Auth emulator session', async () => {
    const local = loadPhpClient(null, 'firebase');
    local.context.window.tsFirebase.emulator = { enabled: true };
    await assert.rejects(local.invoke({ email: user.email }, { name: 'checkPasswordResetEmail', backend: 'php' }), /cannot be used/);
    assert.equal(local.requests.length, 0);
});

test('checkout and aggregate availability use PHP on loopback; remote and emulator sessions keep callable Functions', async () => {
    const client = loadPhpClient({ getIdToken: async () => 'verified-token' }, 'firebase');
    client.context.window.location.hostname = 'localhost';
    for (const name of ['getEventAvailability', 'reserveSeats', 'releaseSeatReservation', 'checkout']) await client.invoke({}, { name });
    assert.equal(client.requests.length, 4);
    await client.invoke({}, { name: 'transferTicket' });
    assert.equal(client.callableRequests.length, 1);
    client.context.window.tsFirebase.emulator = { enabled: true };
    await client.invoke({}, { name: 'reserveSeats' });
    client.context.window.tsFirebase.emulator.enabled = false;
    client.context.window.location.hostname = 'tickets.example.com';
    await client.invoke({}, { name: 'checkout' });
    assert.equal(client.requests.length, 4);
    assert.equal(client.callableRequests.length, 3);
});
