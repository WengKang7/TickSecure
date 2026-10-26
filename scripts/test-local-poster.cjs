// Live integration test; uses disposable accounts, one draft, and tiny image fixtures.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const firebaseRequire = require('node:module').createRequire(path.join(root, 'functions/package.json'));
const { initializeApp, cert } = firebaseRequire('firebase-admin/app');
const { getAuth } = firebaseRequire('firebase-admin/auth');
const { getFirestore } = firebaseRequire('firebase-admin/firestore');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGP88OEDAwMDEwMYAAAh6gLUQUR+wQAAAABJRU5ErkJggg==', 'base64');
const jpg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3CiiigD//2Q==', 'base64');

async function main() {
    const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
    const config = JSON.parse(execFileSync(php, ['-r', '$c=require $argv[1];echo json_encode($c);', path.join(root, 'api/firebase-config.local.php')], { encoding: 'utf8' }));
    const app = initializeApp({ credential: cert(JSON.parse(fs.readFileSync(config.serviceAccountPath, 'utf8'))), projectId: config.projectId });
    const auth = getAuth(app), db = getFirestore(app);
    const apiKey = fs.readFileSync(path.join(root, 'assets/js/firebase-init.js'), 'utf8').match(/apiKey:\s*"([^"]+)"/)[1];
    const prefix = 'poster_test_' + require('node:crypto').randomBytes(8).toString('hex');
    const eventRef = db.collection('Events').doc(prefix + '_event');
    const users = [], refs = [], files = new Set(), tokens = {};
    const base = 'http://localhost/ticksecure-ui/';
    let count = 0;
    async function upload(who, data = png, type = 'image/png', expected = 201) {
        const body = new FormData();
        body.append('eventId', eventRef.id);
        body.append('file', new Blob([data], { type }), type === 'image/jpeg' ? 'images.jpg' : 'poster.png');
        const response = await fetch(base + 'api/event-poster.php', { method: 'POST', headers: who ? { Authorization: 'Bearer ' + tokens[who] } : {}, body, signal: AbortSignal.timeout(60000) });
        const result = await response.json();
        assert.equal(response.status, expected, JSON.stringify(result));
        count++;
        if (result.path) files.add(result.path);
        return result;
    }
    try {
        await upload(null, png, 'image/png', 401);
        for (const [label, role] of [['owner','organizer'], ['other','organizer'], ['buyer','buyer']]) {
            const uid = prefix + '_' + label;
            await auth.createUser({ uid, email: uid + '@example.invalid', emailVerified: true });
            users.push(uid);
            const ref = db.collection('Users').doc(uid);
            refs.push(ref);
            await ref.set({ role, status: 'active', emailVerified: true, fullName: 'Temporary poster test' });
            const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + apiKey, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: await auth.createCustomToken(uid), returnSecureToken: true }), signal: AbortSignal.timeout(30000)
            });
            const result = await response.json();
            assert.ok(response.ok && result.idToken, 'Test account sign-in failed');
            tokens[label] = result.idToken;
        }
        refs.push(eventRef);
        await eventRef.set({ name: 'Temporary poster upload test', description: 'Preserve these event details', organizerUid: prefix + '_owner', status: 'DRAFT', posterUrl: '' });
        await upload('buyer', png, 'image/png', 403);
        await upload('other', png, 'image/png', 403);
        await upload('owner', Buffer.from('<?php echo "not an image";'), 'image/jpeg', 415);
        await upload('owner', Buffer.alloc(5 * 1024 * 1024 + 1), 'image/jpeg', 413);
        for (const [data, type, extension] of [[png,'image/png','.png'], [jpg,'image/jpeg','.jpg']]) {
            const result = await upload('owner', data, type);
            assert.ok(result.path.endsWith(extension));
            const saved = (await eventRef.get()).data();
            assert.equal(saved.posterUrl, '/ticksecure-ui/' + result.path);
            assert.equal(saved.name, 'Temporary poster upload test');
            assert.equal(saved.description, 'Preserve these event details');
            assert.equal(saved.status, 'DRAFT');
            const image = await fetch(new URL(result.path, base));
            assert.equal(image.status, 200, 'The saved poster must display without an authorization header');
            assert.equal(image.headers.get('content-type'), type);
            assert.deepEqual(Buffer.from(await image.arrayBuffer()), data);
            count += 8;
        }
        await eventRef.update({ status: 'PUBLISHED' });
        await upload('owner', png, 'image/png', 409);
        assert.equal((await fetch(base + 'uploads/posters/.htaccess')).status, 403);
        count++;
        console.log('PASS: ' + count + ' live checks; JPG/PNG uploads, Firestore poster URL, public image rendering, preserved draft details, and rejected unauthorized/invalid/oversized/locked-event uploads.');
    } finally {
        const current = await eventRef.get();
        if (current.exists && current.data().posterUrl) files.add(current.data().posterUrl.replace(/^\/ticksecure-ui\//, ''));
        for (const relative of files) {
            if (!/^uploads\/posters\/[a-f0-9]{40}\.(jpg|png)$/.test(relative)) throw Error('Unsafe fixture cleanup path');
            const file = path.resolve(root, relative);
            assert.equal(path.dirname(file), path.resolve(root, 'uploads/posters'));
            if (fs.existsSync(file)) fs.unlinkSync(file);
        }
        for (const ref of refs) await ref.delete();
        for (const uid of users) await auth.deleteUser(uid);
        console.log('Removed temporary accounts, event, and images.');
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
