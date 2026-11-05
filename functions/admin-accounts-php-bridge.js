'use strict';
// Server-only stdin bridge; never log the request (it may contain a new password).
const fs = require('node:fs');
const path = require('node:path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { createAdminAccountService } = require('./admin-accounts');
let input = '', db;
process.stdin.on('data', chunk => { input += chunk; if (input.length > 150000) process.exit(1); });
process.stdin.on('end', async () => {
    try {
        const request = JSON.parse(input);
        if (typeof request.uid !== 'string') throw Error('Invalid caller.');
        const credentials = path.resolve(request.serviceAccountPath), webroot = path.resolve(__dirname, '../..');
        if (credentials.toLowerCase().startsWith(webroot.toLowerCase() + path.sep)) throw Error('Credentials must remain outside the web root.');
        initializeApp({ projectId: request.projectId, credential: cert(JSON.parse(fs.readFileSync(credentials, 'utf8'))) });
        db = getFirestore();
        const fail = (code, message) => { throw Object.assign(Error(message), { code }); };
        const result = await createAdminAccountService(db, getAuth(), { fail }).manage(request.uid, request.data);
        process.stdout.write(JSON.stringify({ data: result }));
    } catch (error) {
        const known = ['permission-denied', 'not-found', 'invalid-argument', 'failed-precondition'];
        process.stdout.write(JSON.stringify({ error: { code: known.includes(error.code) ? error.code : 'unavailable', message: known.includes(error.code) ? error.message : 'Account management is unavailable. Check the local server setup.' } }));
        process.exitCode = 1;
    } finally { if (db) await db.terminate(); }
});
