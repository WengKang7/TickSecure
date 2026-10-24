// Isolated end-to-end demo test. Creates temporary users/data and removes them in finally.
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
    const credential = JSON.parse(fs.readFileSync(config.serviceAccountPath, 'utf8'));
    const app = initializeApp({ credential: cert(credential), projectId: config.projectId });
    const auth = getAuth(app), db = getFirestore(app);
    const apiKey = fs.readFileSync(path.join(root, 'assets/js/firebase-init.js'), 'utf8').match(/apiKey:\s*"([^"]+)"/)[1];
    const prefix = 'checkout_test_' + require('node:crypto').randomBytes(8).toString('hex');
    const eventId = prefix, venueId = prefix + '_venue';
    const users = [], fixtureRefs = [];
    const tokens = [];
    let assertions = 0;
    async function client(method, suffix, data, index = 0, expected = 200) {
        const response = await fetch('https://firestore.googleapis.com/v1/projects/' + config.projectId + '/databases/(default)/documents' + (suffix.startsWith(':') ? '' : '/') + suffix, {
            method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokens[index] },
            ...(data ? { body: JSON.stringify(data) } : {})
        });
        const body = await response.json();
        assert.equal(response.status, expected, method + ' client ' + suffix + ': ' + JSON.stringify(body));
        assertions++;
        return body;
    }
    async function check(action, data, index = 0, expected = 200) {
        const response = await fetch('http://localhost/ticksecure-ui/api/backend.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...(index === null ? {} : { Authorization: 'Bearer ' + tokens[index] }) },
            body: JSON.stringify({ action, data })
        });
        const body = await response.json();
        assert.equal(response.status, expected, action + ': ' + JSON.stringify(body));
        assertions++;
        return body.data;
    }
    try {
        for (let index = 0; index < 2; index++) {
            const uid = prefix + '_buyer' + index;
            await auth.createUser({ uid, email: uid + '@example.invalid', emailVerified: true });
            users.push(uid);
            const ref = db.collection('Users').doc(uid);
            fixtureRefs.push(ref);
            await ref.set({ fullName: 'Temporary checkout test', email: uid + '@example.invalid', role: 'buyer', status: 'active', emailVerified: true });
            const customToken = await auth.createCustomToken(uid);
            const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + apiKey, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true })
            });
            const body = await response.json();
            if (!response.ok || !body.idToken) throw Error('Test sign-in failed.');
            tokens.push(body.idToken);
        }
        const batch = db.batch();
        const eventRef = db.collection('Events').doc(eventId), venueRef = db.collection('Venues').doc(venueId);
        fixtureRefs.push(eventRef, venueRef);
        batch.set(venueRef, { name: 'Temporary checkout venue', layoutStatus: 'ACTIVE', sections: [{ sectionId: 'A', name: 'Test category', seatCount: 3 }] });
        batch.set(eventRef, { name: 'Temporary checkout test', venueId, status: 'PUBLISHED', organizerUid: users[0], maxTicketsPerBuyer: 2,
            categories: { A: { name: 'Test category', price: 288, quantity: 3 } } });
        for (let index = 1; index <= 3; index++) {
            const ref = db.collection('Seats').doc(prefix + '_A' + index);
            fixtureRefs.push(ref);
            batch.set(ref, { venueId, sectionId: 'A', seatLabel: 'A0' + index, status: 'AVAILABLE' });
        }
        await batch.commit();
        await client('GET', 'Events/' + eventId);
        await client('GET', 'Venues/' + venueId);
        await client('GET', 'Users/' + users[0]);
        const initialAvailability = await check('getEventAvailability', { eventId }, null);
        assert.deepEqual(initialAvailability.categories, [{ sectionId: 'A', allocated: 3, remaining: 3 }]);
        assert.equal((await db.collection('EventSeats').where('eventId', '==', eventId).get()).size, 0, 'Reading availability never creates inventory.');
        await eventRef.update({ status: 'DRAFT' });
        await check('getEventAvailability', { eventId }, null, 404);
        await eventRef.update({ status: 'PUBLISHED' });
        await check('getEventAvailability', { eventId: '../invalid' }, null, 400);
        const request = { eventId, venueId, sectionId: 'A', quantity: 2 };
        await check('reserveSeats', request, null, 401);
        await check('transferTicket', {}, 0, 410);
        await check('reserveSeats', { ...request, quantity: 3 }, 0, 400);
        const reserved = await check('reserveSeats', request);
        assert.equal(reserved.seats.length, 2);
        const heldAvailability = await check('getEventAvailability', { eventId }, null);
        assert.equal(heldAvailability.remaining, 1);
        assert.deepEqual(Object.keys(heldAvailability).sort(), ['categories', 'checkedAt', 'eventId', 'remaining']);
        assert.equal(JSON.stringify(heldAvailability).includes(users[0]), false);
        const retry = await check('reserveSeats', request);
        assert.deepEqual(retry.seats, reserved.seats);
        const seatDocIds = reserved.seats.map(seat => seat.id);
        await check('reserveSeats', request, 1, 412);
        const checkout = { eventId, sectionId: 'A', seatDocIds, totalAmount: 1, serviceCharge: 0, paymentMethod: 'simulated' };
        await check('checkout', checkout, 0, 412); // Wallet is required.
        for (const [index, uid] of users.entries()) await client('PATCH', 'Users/' + uid + '?updateMask.fieldPaths=walletAddress&updateMask.fieldPaths=updatedAt', {
            fields: { walletAddress: { stringValue: '0x1111111111111111111111111111111111111111' }, updatedAt: { stringValue: new Date().toISOString() } }
        }, index);
        await check('checkout', checkout, 1, 412); // Another buyer cannot use the reservation.
        await db.collection('EventSeats').doc(seatDocIds[0]).update({ reservationExpiry: new Date(Date.now() - 1000).toISOString() });
        await check('checkout', checkout, 0, 412);
        assert.equal((await check('getEventAvailability', { eventId }, null)).remaining, 2, 'Expired holds become available.');
        await check('reserveSeats', request);
        await check('releaseSeatReservation', { eventId, seatDocIds });
        assert.equal((await check('getEventAvailability', { eventId }, null)).remaining, 3, 'Released holds become available.');
        const finalReservation = await check('reserveSeats', request);
        checkout.seatDocIds = finalReservation.seats.map(seat => seat.id);
        const booking = await check('checkout', checkout);
        assert.equal(booking.paymentStatus, 'SIMULATED_PAID');
        assert.equal((await check('getEventAvailability', { eventId }, null)).remaining, 1, 'Sold tickets remain unavailable.');
        assert.equal(booking.totalAmount, 596, 'Server must ignore supplied prices/fees.');
        const repeated = await check('checkout', checkout);
        assert.equal(repeated.id, booking.id, 'Retry must not create another booking.');
        const stored = await db.collection('Bookings').doc(booking.id).get();
        assert.equal(stored.data().quantity, 2);
        assert.equal(stored.data().paymentMethod, 'simulated');
        const tickets = await db.collection('NFTTickets').where('bookingId', '==', booking.id).get();
        assert.equal(tickets.size, 2);
        await client('GET', 'Bookings/' + booking.id);
        await client('GET', 'NFTTickets/' + tickets.docs[0].id);
        await client('POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'NFTTickets' }], where: { compositeFilter: {
            op: 'AND', filters: [
                { fieldFilter: { field: { fieldPath: 'ownerUid' }, op: 'EQUAL', value: { stringValue: users[0] } } },
                { fieldFilter: { field: { fieldPath: 'bookingId' }, op: 'EQUAL', value: { stringValue: booking.id } } }
            ]
        } } } });
        const seats = await db.collection('EventSeats').where('eventId', '==', eventId).get();
        assert.equal(seats.docs.filter(seat => seat.data().status === 'SOLD').length, 2);
        await check('reserveSeats', { ...request, quantity: 1 }, 0, 412);
        console.log('PASS: ' + assertions + ' live HTTP checks; reservation, retries, release, wallet requirement, ownership, expiry, authoritative total, simulated payment, booking, tickets and public availability.');
    } finally {
        const refs = new Map(fixtureRefs.map(ref => [ref.path, ref]));
        const bookings = await db.collection('Bookings').where('eventId', '==', eventId).get();
        const queries = ['EventSeats', 'NFTTickets'].map(name => db.collection(name).where('eventId', '==', eventId).get());
        queries.push(Promise.resolve(bookings));
        for (const uid of users) {
            queries.push(db.collection('Notifications').where('recipientUid', '==', uid).get());
            queries.push(db.collection('AuditLogs').where('actorUid', '==', uid).get());
        }
        for (const booking of bookings.docs) queries.push(db.collection('BlockchainTransactions').where('relatedEntityId', '==', booking.id).get());
        for (const snapshot of await Promise.all(queries)) for (const doc of snapshot.docs) refs.set(doc.ref.path, doc.ref);
        const cleanup = db.batch();
        for (const ref of refs.values()) cleanup.delete(ref);
        await cleanup.commit();
        for (const uid of users) await auth.deleteUser(uid);
        console.log('Removed the temporary test users and fixture records.');
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
