const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function services() {
    const records = new Map([
        ['Users/admin', { role: 'admin', status: 'active' }],
        ['Users/buyer', { role: 'buyer', status: 'active' }],
        ['Users/organizer', { role: 'organizer', status: 'active' }],
        ['Complaints/case', { complainantUid: 'buyer', category: 'Other', description: 'Original description', status: 'OPEN', evidenceUrls: ['protected'] }],
        ['Events/rejected', { organizerUid: 'organizer', status: 'REJECTED', name: 'Existing event', categories: { A: { price: 100 } } }]
    ]);
    const calls = [], auth = { currentUser: { uid: 'admin' } };
    let failProfile = false;
    const snapshot = ref => ({ exists: () => records.has(ref), data: () => structuredClone(records.get(ref)) });
    const context = {
        app: { options: { projectId: 'test' } }, db: {}, auth,
        window: { tsFirebase: { emulator: { enabled: false } } },
        initializeApp: (_options, name) => { calls.push(['initialize', name]); return { secondary: true }; },
        deleteApp: async () => { calls.push(['dispose']); }, getAuth: app => app,
        getFirestore: app => app, connectAuthEmulator() {}, connectFirestoreEmulator() {},
        inMemoryPersistence: 'memory', setPersistence: async (_, persistence) => { calls.push(['persistence', persistence]); },
        createUserWithEmailAndPassword: async (_, email) => { calls.push(['create-auth']); return { user: { uid: 'new-user', email } }; },
        sendEmailVerification: async user => { calls.push(['verify', user.uid]); },
        deleteUser: async user => { calls.push(['delete-auth', user.uid]); },
        doc: (_db, collection, id) => `${collection}/${id}`, getDoc: async ref => snapshot(ref),
        setDoc: async (ref, data) => { if (failProfile && ref.startsWith('OrganizerProfiles/')) throw Error('Profile failed'); records.set(ref, structuredClone(data)); },
        deleteDoc: async ref => { records.delete(ref); },
        arrayUnion: value => [value],
        runTransaction: async (_db, action) => {
            const writes = [];
            await action({ get: async ref => snapshot(ref), update: (ref, fields) => writes.push(() => records.set(ref, { ...records.get(ref), ...structuredClone(fields) })), delete: ref => writes.push(() => records.delete(ref)) });
            writes.forEach(write => write());
        }
    };
    const source = fs.readFileSync(path.join(__dirname, '../assets/js/role-crud.js'), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
    vm.runInNewContext(source + '\nglobalThis.services = { AccountCrud, ComplaintCrud, reviseRejectedEvent };', context);
    return { ...context.services, records, calls, auth, failProfile: () => { failProfile = true; } };
}
test('admin provisions a buyer without replacing the administrator session or granting verification', async () => {
    const s = services();
    const result = await s.AccountCrud.create({ role: 'buyer', fullName: 'New buyer', email: 'new@example.com', password: 'Test123!' });
    assert.equal(result.id, 'new-user');
    assert.equal(s.auth.currentUser.uid, 'admin');
    assert.equal(s.records.get('Users/new-user').emailVerified, false);
    assert.equal(s.records.get('Users/new-user').role, 'buyer');
    assert.ok(s.calls.some(call => call[0] === 'persistence' && call[1] === 'memory'));
    assert.equal(s.calls.at(-1)[0], 'dispose');
});
test('organizer provisioning remains pending and partial failure rolls back only the new account', async () => {
    const data = { role: 'organizer', fullName: 'New organizer', email: 'new@example.com', password: 'Test123!', organizationName: 'Org', organizationPhone: '+60123456789', organizationAddress: 'Address', organizationDescription: 'Description' };
    const success = services();
    await success.AccountCrud.create(data);
    assert.equal(success.records.get('Users/new-user').status, 'pending');
    assert.equal(success.records.get('OrganizerProfiles/new-user').organizationName, 'Org');
    const failure = services(); failure.failProfile();
    await assert.rejects(failure.AccountCrud.create(data), /Profile failed/);
    assert.equal(failure.records.has('Users/new-user'), false);
    assert.equal(failure.records.has('Users/admin'), true);
    assert.deepEqual(failure.calls.slice(-2).map(call => call[0]), ['delete-auth', 'dispose']);
});
test('account management denies non-admins, administrator creation, and self/admin archiving', async () => {
    const s = services();
    await assert.rejects(s.AccountCrud.create({ role: 'admin' }), /Choose Buyer/);
    await assert.rejects(s.AccountCrud.archive('admin'), /own account/);
    s.auth.currentUser.uid = 'buyer';
    await assert.rejects(s.AccountCrud.archive('organizer'), /administrator/);
    s.auth.currentUser.uid = 'admin';
    await s.AccountCrud.archive('buyer');
    assert.equal(s.records.get('Users/buyer').status, 'deleted');
    assert.equal(s.records.has('Complaints/case'), true);
});
test('complaint owner can edit/delete only open cases and cannot alter protected fields', async () => {
    const s = services(); s.auth.currentUser.uid = 'buyer';
    await s.ComplaintCrud.update('case', { category: 'Ticket', description: 'Corrected description', status: 'RESOLVED', evidenceUrls: [] });
    assert.equal(s.records.get('Complaints/case').status, 'OPEN');
    assert.deepEqual(s.records.get('Complaints/case').evidenceUrls, ['protected']);
    s.auth.currentUser.uid = 'organizer';
    await assert.rejects(s.ComplaintCrud.delete('case'), /own open/);
    s.auth.currentUser.uid = 'buyer';
    s.records.get('Complaints/case').status = 'UNDER_INVESTIGATION';
    await assert.rejects(s.ComplaintCrud.update('case', { category: 'Other', description: 'Valid description' }), /own open/);
    await assert.rejects(s.ComplaintCrud.delete('case'), /own open/);
    s.records.get('Complaints/case').status = 'OPEN';
    await s.ComplaintCrud.delete('case');
    assert.equal(s.records.has('Complaints/case'), false);
});
test('only the owning organizer can return a rejected event to draft, preserving its details', async () => {
    const s = services();
    await assert.rejects(s.reviseRejectedEvent('rejected'), /own rejected/);
    s.auth.currentUser.uid = 'organizer';
    await s.reviseRejectedEvent('rejected');
    const event = s.records.get('Events/rejected');
    assert.equal(event.status, 'DRAFT'); assert.equal(event.name, 'Existing event');
    assert.deepEqual(event.categories, { A: { price: 100 } });
    assert.equal(event.statusHistory[0].from, 'REJECTED');
    event.status = 'PUBLISHED';
    await assert.rejects(s.reviseRejectedEvent('rejected'), /own rejected/);
});
