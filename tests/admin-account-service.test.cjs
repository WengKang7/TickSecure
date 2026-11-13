const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createAdminAccountService } = require('../functions/admin-accounts');

function fixture(overrides = {}) {
    const records = new Map(Object.entries({
        'Users/admin': { role: 'admin', status: 'active', email: 'admin@example.com' },
        'Users/buyer': { fullName: 'Buyer One', role: 'buyer', status: 'active', email: 'buyer@example.com', emailVerified: true, walletAddress: 'retained' },
        'Bookings/booking': { buyerUid: 'buyer' }, 'NFTTickets/ticket': { ownerUid: 'buyer' },
        ...overrides
    }));
    let serial = 0, failCommit = false, failAuth = false, pause;
    const calls = [], history = [];
    const ref = (collection, id) => ({ path: `${collection}/${id || ++serial}` });
    const db = {
        collection: collection => ({ doc: id => ref(collection, id) }),
        runTransaction: async callback => {
            const writes = [];
            const result = await callback({
                get: async ref => ({ exists: records.has(ref.path), data: () => structuredClone(records.get(ref.path)) }),
                set: (ref, data, options) => writes.push({ path: ref.path, data: structuredClone(data), merge: options?.merge }),
                update: (ref, data) => writes.push({ path: ref.path, data: structuredClone(data), merge: true })
            });
            if (failCommit && writes.some(w => w.path.startsWith('AuditLogs/'))) throw Error('Firestore unavailable');
            for (const w of writes) { records.set(w.path, w.merge ? { ...records.get(w.path), ...w.data } : w.data); history.push(w); }
            return result;
        }
    };
    const login = { uid: 'buyer', email: 'buyer@example.com', emailVerified: true, password: 'Original!123', disabled: false };
    const auth = {
        getUser: async () => ({ ...login }),
        updateUser: async (id, fields) => {
            calls.push({ id, fields: { ...fields } });
            if (pause) { const wait = pause; pause = null; await wait; }
            if (failAuth) throw Object.assign(Error('Email taken'), { code: 'auth/email-already-exists' });
            Object.assign(login, fields); return { ...login };
        },
        revokeRefreshTokens: async id => calls.push({ revoke: id })
    };
    const service = createAdminAccountService(db, auth, { fail: (code, message) => { throw Object.assign(Error(message), { code }); } });
    return { records, calls, history, login, manage: (data, uid = 'admin') => service.manage(uid, { userId: 'buyer', ...data }),
        failAuth: value => { failAuth = value; }, failCommit: value => { failCommit = value; }, pause: promise => { pause = promise; } };
}
const edit = { action: 'edit', fullName: 'New Buyer', email: 'new@example.com', role: 'buyer', password: 'New!Password123' };
const org = { role: 'organizer', organizationName: 'Event Company', organizationPhone: '+60123456789', organizationAddress: 'Address', organizationDescription: 'Organizer description' };

test('editing updates Firebase login credentials and safe profile fields without storing a password', async () => {
    const f = fixture();
    const result = await f.manage({ ...edit, ...org });
    assert.equal(result.emailChanged, true);
    assert.equal(f.login.email, edit.email); assert.equal(f.login.password, edit.password); assert.equal(f.login.disabled, false);
    assert.equal(f.login.emailVerified, false);
    assert.equal(f.records.get('Users/buyer').role, 'organizer'); assert.equal(f.records.get('Users/buyer').emailVerified, false);
    assert.equal(f.records.get('Users/buyer').walletAddress, 'retained');
    assert.equal(f.records.get('OrganizerProfiles/buyer').organizationName, 'Event Company');
    assert.deepEqual(f.records.get('Bookings/booking'), { buyerUid: 'buyer' });
    assert.deepEqual(f.records.get('NFTTickets/ticket'), { ownerUid: 'buyer' });
    assert.ok(f.calls.find(c => c.revoke === 'buyer'));
    assert.doesNotMatch(JSON.stringify([...f.records]) + JSON.stringify(f.history) + JSON.stringify(result), /New!Password123|Original!123/);
});

test('blank password leaves the old password intact, and role changes retain organizer history', async () => {
    const f = fixture({ 'OrganizerProfiles/buyer': { organizationName: 'Prior organization', original: true } });
    await f.manage({ ...edit, email: 'buyer@example.com', password: '' });
    assert.equal(f.login.password, 'Original!123'); assert.equal(f.login.emailVerified, true);
    assert.equal(f.records.get('OrganizerProfiles/buyer').original, true);
    assert.ok(f.calls.every(call => !call.fields || !('password' in call.fields)));
});

test('inactivation disables sign-in and reactivation restores the prior status without approving pending organizers', async () => {
    for (const status of ['active', 'pending', 'rejected']) {
        const f = fixture({ 'Users/buyer': { role: 'organizer', status, email: 'buyer@example.com' } });
        await f.manage({ action: 'inactivate' });
        assert.equal(f.login.disabled, true); assert.equal(f.records.get('Users/buyer').status, 'inactive');
        await f.manage({ action: 'reactivate' });
        assert.equal(f.login.disabled, false); assert.equal(f.records.get('Users/buyer').status, status);
    }
});

test('delete disables login and retains all records; deleted users cannot be edited or reactivated', async () => {
    const f = fixture(); await f.manage({ action: 'delete' });
    assert.equal(f.records.get('Users/buyer').status, 'deleted'); assert.equal(f.login.disabled, true);
    assert.ok(f.records.has('Bookings/booking')); assert.ok(f.records.has('NFTTickets/ticket'));
    for (const data of [{ action: 'reactivate' }, edit, { action: 'delete' }]) await assert.rejects(f.manage(data), { code: 'failed-precondition' });
});

test('only active administrators can manage other buyer/organizer accounts', async () => {
    for (const [override, uid, data] of [
        [{}, 'buyer', edit],
        [{ 'Users/admin': { role: 'buyer', status: 'active' } }, 'admin', edit],
        [{ 'Users/admin': { role: 'admin', status: 'inactive' } }, 'admin', edit],
        [{ 'Users/buyer': { role: 'admin', status: 'active' } }, 'admin', edit],
        [{}, 'admin', { ...edit, role: 'admin' }],
        [{}, 'admin', { ...edit, password: 'weak' }],
        [{}, 'admin', { ...edit, ...org, organizationPhone: 'wrong' }]
    ]) {
        const f = fixture(override); await assert.rejects(f.manage(data, uid));
        assert.deepEqual(f.calls, []); assert.deepEqual(f.history, []);
    }
});

test('Auth failure stays inactive, exposes a safe error and supports retry without losing the prior status', async () => {
    const f = fixture(); f.failAuth(true);
    await assert.rejects(f.manage(edit), /email is already used.*Access remains inactive/);
    assert.equal(f.records.get('Users/buyer').status, 'inactive');
    await assert.rejects(f.manage({ action: 'reactivate' }), /Save the account details/);
    f.failAuth(false); await f.manage(edit);
    assert.equal(f.records.get('Users/buyer').status, 'active'); assert.equal(f.login.disabled, false);
});

test('Firestore failure after Auth change cannot enable login; retry completes the same account safely', async () => {
    const f = fixture(); f.failCommit(true);
    await assert.rejects(f.manage(edit), /Access remains inactive/);
    assert.equal(f.login.disabled, true); assert.equal(f.records.get('Users/buyer').status, 'inactive');
    f.failCommit(false); await f.manage(edit);
    assert.equal(f.records.get('Users/buyer').status, 'active'); assert.equal(f.login.disabled, false);
    assert.equal(f.records.get('Users/buyer').emailVerified, false);
});

test('overlapping account operations cannot both run Auth changes', async () => {
    const f = fixture(); let release;
    f.pause(new Promise(resolve => { release = resolve; }));
    const first = f.manage(edit);
    while (!f.calls.length) await new Promise(resolve => setImmediate(resolve));
    await assert.rejects(f.manage({ action: 'delete' }), /already running/);
    release(); await first;
    assert.equal(f.records.get('Users/buyer').status, 'active');
});

test('local and callable routes share the trusted service and local account actions have a separate opt-in', () => {
    const read = file => fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8');
    assert.match(read('functions/index.js'), /adminAccounts\.manage\(requireAuth\(request\), requireDataObject\(request\)\)/);
    assert.match(read('functions/admin-accounts-php-bridge.js'), /createAdminAccountService\(db, getAuth\(\), \{ fail \}\)\.manage/);
    assert.match(read('api/backend.php'), /backend_accounts_is_enabled\(\) && \$action === 'manageAdminAccount'/);
    assert.match(read('.htaccess'), /SetEnv TICKSECURE_PHP_ACCOUNTS 1/);
    const routedActions = read('assets/js/backend-client.js').match(/&&\s*\[([\s\S]*?)\]\.includes\(config\.name\)/)?.[1] || '';
    for (const action of ['manageAdminAccount', 'getEventAvailability']) assert.ok(routedActions.includes(`'${action}'`), action + ' uses the local trusted route');
    assert.match(read('firestore.rules'), /request\.auth\.token\.email == resource\.data\.email/);
});
