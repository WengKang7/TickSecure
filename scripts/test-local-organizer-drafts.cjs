// Exercises the actual EventService against Firestore with one temporary
// organizer and one temporary event. No existing events are edited.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const firebaseRequire = require('node:module').createRequire(path.join(root, 'functions/package.json'));
const { initializeApp, cert } = firebaseRequire('firebase-admin/app');
const { getAuth } = firebaseRequire('firebase-admin/auth');
const { getFirestore } = firebaseRequire('firebase-admin/firestore');
const encode = value => typeof value === 'string' ? { stringValue: value } : typeof value === 'number' ? { doubleValue: value }
    : typeof value === 'boolean' ? { booleanValue: value } : Array.isArray(value) ? { arrayValue: { values: value.map(encode) } }
        : { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } };

async function main() {
    const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
    const config = JSON.parse(execFileSync(php, ['-r', '$c=require $argv[1];echo json_encode($c);', path.join(root, 'api/firebase-config.local.php')], { encoding: 'utf8' }));
    const app = initializeApp({ credential: cert(JSON.parse(fs.readFileSync(config.serviceAccountPath, 'utf8'))), projectId: config.projectId });
    const db = getFirestore(app), auth = getAuth(app);
    const prefix = 'draft_test_' + require('node:crypto').randomBytes(8).toString('hex');
    const userId = prefix + '_organizer', eventId = prefix + '_event';
    const eventRef = db.collection('Events').doc(eventId), profileRef = db.collection('Users').doc(userId);
    let createdUser = false, createdProfile = false;
    try {
        await auth.createUser({ uid: userId, email: userId + '@example.invalid', emailVerified: true });
        createdUser = true;
        await profileRef.set({ role: 'organizer', status: 'active', emailVerified: true, fullName: 'Temporary draft test' });
        createdProfile = true;
        const apiKey = fs.readFileSync(path.join(root, 'assets/js/firebase-init.js'), 'utf8').match(/apiKey:\s*"([^"]+)"/)[1];
        const tokenResponse = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + apiKey, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: await auth.createCustomToken(userId), returnSecureToken: true }), signal: AbortSignal.timeout(30000)
        });
        const token = await tokenResponse.json();
        assert.ok(tokenResponse.ok && token.idToken, 'Temporary organizer sign-in failed');
        async function write(method, suffix, data) {
            const response = await fetch('https://firestore.googleapis.com/v1/projects/' + config.projectId + '/databases/(default)/documents/' + suffix, {
                method, headers: { Authorization: 'Bearer ' + token.idToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).filter(([, item]) => !item?.__delete).map(([key, item]) => [key, encode(item)])) }),
                signal: AbortSignal.timeout(30000)
            });
            assert.ok(response.ok, 'Firestore fixture write failed: ' + response.status);
        }
        const code = fs.readFileSync(path.join(root, 'assets/js/firestore-crud.js'), 'utf8');
        const normalize = code.slice(code.indexOf('export function normalizeEventCategories'), code.indexOf('// Read-time aliases')).replace('export ', '');
        const eventService = code.slice(code.indexOf('export const EventService'), code.indexOf('// SEAT SERVICE')).replace('export const EventService =', 'globalThis.EventService =');
        const context = vm.createContext({
            db: {}, profile: async () => ({ id: userId, fullName: 'Temporary draft test' }), uid: () => userId,
            iso: () => new Date().toISOString(), AuditService: { log: async () => {} },
            asAmount: value => Number(value) || 0, deleteField: () => ({ __delete: true }), arrayUnion: item => ({ __union: item }),
            collection: (_, name) => name, doc: (_, name, id) => ({ name, id }),
            getDoc: async ref => { const snapshot = await db.collection(ref.name).doc(ref.id).get(); return { exists: () => snapshot.exists, id: snapshot.id, data: () => snapshot.data() }; },
            addDoc: async (name, data) => { await write('POST', name + '?documentId=' + eventId, data); return { id: eventId }; },
            updateDoc: async (ref, data) => {
                const current = (await db.collection(ref.name).doc(ref.id).get()).data();
                for (const [key, value] of Object.entries(data)) if (value?.__union) data[key] = [...(current[key] || []), value.__union];
                const mask = Object.keys(data).map(key => 'updateMask.fieldPaths=' + encodeURIComponent(key)).join('&');
                await write('PATCH', ref.name + '/' + ref.id + '?' + mask, data);
            }
        });
        vm.runInContext(normalize + '\n' + eventService, context);
        const service = context.EventService;
        await service.createEvent({ name: 'Work in progress', description: '', eventCategory: '', date: '', time: '', venueId: '' });
        let saved = await service.getEvent(eventId);
        assert.equal(saved.status, 'DRAFT');
        assert.equal(saved.date, '');
        assert.equal(saved.venueId, '');
        assert.equal(saved.eventCategory, '');
        const rules = { salesStartDate: '', salesEndDate: '', maxTicketsPerBuyer: '', maxResaleMarkup: '', maxResalePrice: '', resaleStartDate: '', resaleDeadline: '', transferEnabled: false, resaleEnabled: false };
        await service.saveConfigurationDraft(eventId, { categories: [], rules, category: { name: 'Unfinished category', price: '', quantity: '', sectionId: '' } });
        saved = await service.getEvent(eventId);
        assert.equal(saved.configurationDraft.category.name, 'Unfinished category');
        assert.equal(saved.configurationDraft.rules.maxTicketsPerBuyer, '');
        assert.equal(saved.status, 'DRAFT');
        await service.updateEvent(eventId, { name: 'Renamed draft', venueId: prefix + '_venue' });
        saved = await service.getEvent(eventId);
        assert.equal(saved.name, 'Renamed draft');
        assert.equal(saved.configurationDraft.category.name, 'Unfinished category');
        await service.saveCompletedConfiguration(eventId, [{ sectionId: 'A', name: 'VIP', price: 100, quantity: 10 }], { ...rules, maxTicketsPerBuyer: 4, maxResaleMarkup: 5, maxResalePrice: 0 });
        saved = await service.getEvent(eventId);
        assert.equal(saved.configurationDraft, undefined);
        assert.deepEqual(saved.categories, { A: { name: 'VIP', price: 100, quantity: 10 } });
        assert.equal(saved.status, 'DRAFT');
        await service.submitForApproval(eventId);
        assert.equal((await service.getEvent(eventId)).status, 'PENDING_REVIEW');
        console.log('PASS: actual EventService creates partial drafts, saves/reloads unfinished inputs, preserves edits, clears form state on completion, and submits only through the final action.');
    } finally {
        await eventRef.delete();
        if (createdProfile) await profileRef.delete();
        if (createdUser) await auth.deleteUser(userId);
        console.log('Removed the temporary organizer and event.');
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
