// Isolated PHP/Firebase integration. Uses temporary accounts and simulated checkout only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const firebaseRequire = require('node:module').createRequire(path.join(root, 'functions/package.json'));
const { initializeApp, cert } = firebaseRequire('firebase-admin/app');
const { getAuth } = firebaseRequire('firebase-admin/auth');
const { getFirestore } = firebaseRequire('firebase-admin/firestore');
async function main() {
    const config = JSON.parse(execFileSync('C:/xampp/php/php.exe', ['-r', '$c = require $argv[1]; echo json_encode($c);', path.join(root, 'api/firebase-config.local.php')], { encoding: 'utf8' }));
    const app = initializeApp({ credential: cert(JSON.parse(fs.readFileSync(config.serviceAccountPath, 'utf8'))), projectId: config.projectId });
    const auth = getAuth(app), db = getFirestore(app), tokens = [], users = [], refs = new Map();
    const prefix = 'picker_test_' + require('node:crypto').randomBytes(8).toString('hex'), eventId = prefix, venueId = prefix + '_venue';
    const apiKey = fs.readFileSync(path.join(root, 'assets/js/firebase-init.js'), 'utf8').match(/apiKey:\s*"([^"]+)"/)[1];
    const remember = ref => { refs.set(ref.path, ref); return ref; };
    let checks = 0;
    async function request(action, data, buyer = 0) {
        const response = await fetch('http://localhost/ticksecure-ui/api/backend.php', { method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(buyer === null ? {} : { Authorization: 'Bearer ' + tokens[buyer] }) }, body: JSON.stringify({ action, data }) });
        return { status: response.status, body: await response.json() };
    }
    async function check(action, data, buyer = 0, expected = 200) {
        const result = await request(action, data, buyer); assert.equal(result.status, expected, action + ': ' + JSON.stringify(result.body)); checks++; return result.body.data;
    }
    const choose = ids => ({ eventId, sectionId: 'Main', seatDocIds: ids });
    try {
        for (let i = 0; i < 2; i++) {
            const uid = prefix + '_buyer' + i;
            await auth.createUser({ uid, email: uid + '@example.invalid', emailVerified: true }); users.push(uid);
            await remember(db.collection('Users').doc(uid)).set({ fullName: 'Temporary seat picker test', email: uid + '@example.invalid', role: 'buyer', status: 'active', emailVerified: true, walletAddress: '0x' + String(i + 1).repeat(40) });
            const token = await auth.createCustomToken(uid);
            const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, returnSecureToken: true }) });
            const body = await response.json(); if (!response.ok || !body.idToken) throw Error('Temporary buyer sign-in failed.'); tokens.push(body.idToken);
        }
        const batch = db.batch();
        batch.set(remember(db.collection('Venues').doc(venueId)), { name: 'Temporary seat picker hall', layoutStatus: 'ACTIVE', sections: [{ sectionId: 'Main', name: 'Main', seatCount: 5,
            geometry: { type: 'polygon', layout: 'ocr', source: 'shape-detection', page: 1, imageWidth: 800, imageHeight: 600, reviewed: true,
                seatMarkers: Array.from({ length: 5 }, (_, i) => ({ label: 'A' + (i + 1), x: 10 + 5 * i, y: 30, width: 2, height: 2, shape: 'circle', row: 'A', number: String(i + 1) })), decorations: [] } }] });
        batch.set(remember(db.collection('Events').doc(eventId)), { name: 'Temporary seat picker event', venueId, status: 'PUBLISHED', organizerUid: users[0], maxTicketsPerBuyer: 2, categories: { Main: { name: 'Standard', price: 100, quantity: 5 } } });
        for (let i = 1; i <= 5; i++) batch.set(remember(db.collection('Seats').doc(venueId + '_Main-A' + i)), { venueId, sectionId: 'Main', seatLabel: 'Main-A' + i, rowLabel: 'A', seatNumber: String(i), status: 'AVAILABLE', position: { x: 5 + 5 * i, y: 30, page: 1, width: 2, height: 2, shape: 'circle' } });
        await batch.commit();
        await check('getSeatMap', { eventId, sectionId: 'Main' }, null, 401);
        const map = await check('getSeatMap', { eventId, sectionId: 'Main' }); assert.equal(map.seats.length, 5); assert.equal(map.unitPrice, 100);
        const ids = map.seats.sort((a,b) => a.seatLabel.localeCompare(b.seatLabel)).map(s => s.id);
        assert.equal(map.seats[0].row, 'A'); assert.ok(map.seats[0].position.width > 0);
        const race = await Promise.all([request('holdSelectedSeats', choose([ids[0]]), 0), request('holdSelectedSeats', choose([ids[0]]), 1)]);
        assert.deepEqual(race.map(r => r.status).sort(), [200,409], JSON.stringify(race)); checks += 2;
        const winner = race[0].status === 200 ? 0 : 1, other = 1 - winner;
        const mine = await check('getSeatMap', { eventId, sectionId: 'Main' }, winner), theirs = await check('getSeatMap', { eventId, sectionId: 'Main' }, other);
        assert.equal(mine.seats.find(s => s.id === ids[0]).status, 'MINE'); assert.equal(theirs.seats.find(s => s.id === ids[0]).status, 'HELD');
        assert.equal(theirs.seats.some(s => 'reservedBy' in s || 'bookingId' in s || 'reservationExpiry' in s), false, 'No other buyer ownership or hold expiry is disclosed');
        const notReleased = await check('releaseSeatReservation', { eventId, seatDocIds: [ids[0]] }, other); assert.equal(notReleased.released, 0);
        await check('holdSelectedSeats', choose([ids[1],ids[0]]), other, 409);
        assert.equal((await db.collection('EventSeats').doc(ids[1]).get()).data().status, 'AVAILABLE', 'A conflict never partially reserves a selection');
        await db.collection('EventSeats').doc(ids[0]).update({ reservationExpiry: new Date(Date.now() - 1000).toISOString() });
        await check('holdSelectedSeats', choose([ids[0],ids[1]]), other);
        const retried = await check('holdSelectedSeats', choose([ids[0],ids[1]]), other); assert.equal(retried.seats.length, 2);
        await check('holdSelectedSeats', choose([ids[1],ids[2]]), other);
        assert.equal((await db.collection('EventSeats').doc(ids[0]).get()).data().status, 'AVAILABLE', 'Replacing the selection releases prior seats atomically');
        await check('holdSelectedSeats', choose([ids[1],ids[2],ids[3]]), other, 412);
        await check('holdSelectedSeats', choose([ids[1],ids[1]]), other, 400);
        const foreign = remember(db.collection('EventSeats').doc(prefix + '_foreign'));
        await foreign.set({ eventId: prefix + '_other', venueId, sectionId: 'Main', seatLabel: 'Main-X1', status: 'AVAILABLE' });
        await check('holdSelectedSeats', choose([foreign.id]), other, 400);
        const booking = await check('checkout', { ...choose([ids[1],ids[2]]), quantity: 2, totalAmount: 1, paymentMethod: 'simulated' }, other);
        assert.equal(booking.totalAmount, 220); assert.equal(booking.paymentStatus, 'SIMULATED_PAID');
        const soldMap = await check('getSeatMap', { eventId, sectionId: 'Main' }, winner);
        assert.equal(soldMap.seats.filter(s => s.status === 'SOLD').length, 2);
        await check('holdSelectedSeats', choose([ids[1]]), winner, 409);
        console.log('PASS: ' + checks + ' live HTTP checks: private availability, simultaneous exact-seat claims, atomic conflicts, expiry, replacement, limits, cross-event IDs and simulated checkout.');
    } finally {
        const queries = ['EventSeats', 'Bookings', 'NFTTickets', 'ReservationLocks'].map(name => db.collection(name).where('eventId', '==', eventId).get());
        for (const uid of users) { queries.push(db.collection('AuditLogs').where('actorUid', '==', uid).get()); queries.push(db.collection('Notifications').where('recipientUid', '==', uid).get()); }
        for (const snapshot of await Promise.all(queries)) for (const doc of snapshot.docs) remember(doc.ref);
        const bookingRefs = [...refs.values()].filter(ref => ref.parent.id === 'Bookings');
        for (const ref of bookingRefs) for (const doc of (await db.collection('BlockchainTransactions').where('relatedEntityId', '==', ref.id).get()).docs) remember(doc.ref);
        const cleanup = db.batch(); for (const ref of refs.values()) cleanup.delete(ref); if (refs.size) await cleanup.commit();
        for (const uid of users) await auth.deleteUser(uid);
        console.log('Removed temporary picker accounts and fixture records.');
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
