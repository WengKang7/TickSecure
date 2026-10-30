// Live local integration test: only temporary users, venue, and blueprints are created.
// Credentials and Firebase ID tokens never reach the output.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const firebaseRequire = require('node:module').createRequire(path.join(root, 'functions/package.json'));
const { initializeApp, cert } = firebaseRequire('firebase-admin/app');
const { getAuth } = firebaseRequire('firebase-admin/auth');
const { getFirestore } = firebaseRequire('firebase-admin/firestore');

async function main() {
    const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
    const config = JSON.parse(execFileSync(php, ['-r', '$c = require $argv[1]; echo json_encode($c);', path.join(root, 'api/firebase-config.local.php')], { encoding: 'utf8' }));
    const app = initializeApp({ credential: cert(JSON.parse(fs.readFileSync(config.serviceAccountPath, 'utf8'))), projectId: config.projectId });
    const auth = getAuth(app), db = getFirestore(app);
    const apiKey = fs.readFileSync(path.join(root, 'assets/js/firebase-init.js'), 'utf8').match(/apiKey:\s*"([^"]+)"/)[1];
    const prefix = 'blueprint_test_' + randomBytes(8).toString('hex');
    const venueId = prefix + '_venue';
    const venueRef = db.collection('Venues').doc(venueId);
    const users = [], refs = [], localFiles = new Set();
    const tokens = {};
    const base = 'http://localhost/ticksecure-ui/';
    let assertions = 0;
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
    const endpoint = base + 'api/venue-blueprint.php';
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=', 'base64');
    async function upload(token, content = pdf, type = 'application/pdf', expected = 201) {
        const form = new FormData();
        form.append('venueId', venueId);
        form.append('file', new Blob([content], { type }), type === 'image/png' ? 'layout.png' : 'layout.pdf');
        const response = await fetch(endpoint, { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: form, signal: AbortSignal.timeout(60000) });
        const body = await response.json();
        assert.equal(response.status, expected, JSON.stringify(body));
        assertions++;
        return body;
    }
    try {
        await upload(null, pdf, 'application/pdf', 401);
        for (const role of ['admin', 'buyer']) {
            const uid = prefix + '_' + role;
            // Reproduce a provisioned administrator: no verified Auth email or
            // profile projection, just the trusted active administrator role.
            await auth.createUser({ uid, email: uid + '@example.invalid', emailVerified: role !== 'admin' });
            users.push(uid);
            const ref = db.collection('Users').doc(uid);
            refs.push(ref);
            await ref.set({ role, status: 'active', ...(role === 'admin' ? {} : { emailVerified: true }), fullName: 'Temporary blueprint test' });
            const customToken = await auth.createCustomToken(uid);
            const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + apiKey, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: customToken, returnSecureToken: true }), signal: AbortSignal.timeout(30000)
            });
            const body = await response.json();
            assert.ok(response.ok && body.idToken, 'Temporary test account sign-in must succeed');
            tokens[role] = body.idToken;
        }
        refs.push(venueRef);
        await venueRef.set({ name: 'Temporary blueprint upload test', layoutStatus: 'DRAFT', capacity: 10, sections: [] });
        await upload(tokens.buyer, pdf, 'application/pdf', 403);
        const adminRef = db.collection('Users').doc(prefix + '_admin');
        await adminRef.update({ status: 'suspended' });
        await upload(tokens.admin, pdf, 'application/pdf', 403);
        await adminRef.update({ status: 'active' });
        await upload(tokens.admin, Buffer.from('<?php echo "not a PDF";'), 'application/pdf', 415);
        const result = await upload(tokens.admin);
        const venue = (await venueRef.get()).data();
        localFiles.add(venue.blueprintLocalFile);
        assert.equal(venue.blueprintName, 'layout.pdf');
        assert.equal(venue.blueprintSize, pdf.length);
        assert.equal(venue.blueprintUrl, result.url);
        assert.equal(venue.layoutStatus, 'DRAFT');
        assertions += 4;
        const privateFile = base + 'storage/blueprints/' + venue.blueprintLocalFile;
        assert.equal((await fetch(privateFile)).status, 403, 'PDF must never be served as a public static file');
        assertions++;
        const url = new URL(result.url, base);
        assert.equal((await fetch(url)).status, 401);
        assert.equal((await fetch(url, { headers: { Authorization: 'Bearer ' + tokens.buyer } })).status, 403);
        const download = await fetch(url, { headers: { Authorization: 'Bearer ' + tokens.admin } });
        assert.equal(download.status, 200);
        assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);
        assertions += 4;
        await upload(tokens.admin, png, 'image/png');
        const pngVenue = (await venueRef.get()).data();
        localFiles.add(pngVenue.blueprintLocalFile);
        assert.equal(pngVenue.blueprintName, 'layout.png');
        assert.equal(pngVenue.blueprintMimeType, 'image/png');
        assert.match(pngVenue.blueprintLocalFile, /^[a-f0-9]{40}\.png$/);
        const pngDownload = await fetch(url, { headers: { Authorization: 'Bearer ' + tokens.admin } });
        assert.equal(pngDownload.status, 200);
        assert.equal(pngDownload.headers.get('content-type'), 'image/png');
        assert.deepEqual(Buffer.from(await pngDownload.arrayBuffer()), png);
        assert.equal((await fetch(base + 'storage/blueprints/' + pngVenue.blueprintLocalFile)).status, 403);
        assertions += 7;
        console.log('PASS: ' + assertions + ' live checks; provisioned-admin PNG/PDF uploads, Firestore metadata, matching download types, and denied suspended/guest/buyer/public access.');
    } finally {
        // Only fixture paths generated in this run can be removed.
        const current = await venueRef.get();
        if (current.exists && current.data().blueprintLocalFile) localFiles.add(current.data().blueprintLocalFile);
        for (const name of localFiles) {
            if (!/^[a-f0-9]{40}\.(pdf|png)$/.test(name)) throw Error('Invalid fixture filename during cleanup');
            const file = path.resolve(root, 'storage/blueprints', name);
            assert.equal(path.dirname(file), path.resolve(root, 'storage/blueprints'));
            if (fs.existsSync(file)) fs.unlinkSync(file);
        }
        for (const ref of refs) await ref.delete();
        for (const uid of users) await auth.deleteUser(uid);
        console.log('Removed the temporary test users, venue, and PNG/PDF files.');
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
