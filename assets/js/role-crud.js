// Additional role CRUD. Existing ticket, booking and venue services stay intact.
import { app, auth, db } from './firebase-init.js';
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, connectAuthEmulator, setPersistence, inMemoryPersistence, createUserWithEmailAndPassword, sendEmailVerification, deleteUser } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, deleteDoc, runTransaction, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

const text = (value, label, min = 1, max = 120) => {
    const result = String(value ?? '').trim();
    if (result.length < min || result.length > max) throw new Error(`${label} must contain ${min}–${max} characters.`);
    return result;
};
async function admin() {
    if (!auth.currentUser) throw new Error('Sign in first.');
    const snap = await getDoc(doc(db, 'Users', auth.currentUser.uid));
    if (!snap.exists() || snap.data().role !== 'admin' || snap.data().status !== 'active') throw new Error('An active administrator account is required.');
}
export const AccountCrud = {
    async create(data) {
        await admin();
        if (!['buyer', 'organizer'].includes(data.role)) throw new Error('Choose Buyer or Event Organizer.');
        const fullName = text(data.fullName, 'Full name');
        const email = text(data.email, 'Email', 3, 254);
        const organization = data.role === 'organizer' ? {
            organizationName: text(data.organizationName, 'Organization name'),
            organizationPhone: text(data.organizationPhone, 'Organization phone', 1, 50),
            organizationAddress: text(data.organizationAddress, 'Organization address', 1, 1000),
            organizationDescription: text(data.organizationDescription, 'Organization description', 1, 5000)
        } : null;
        // A separate, memory-only Auth instance keeps the admin signed in.
        // Firebase's existing registration/password policy remains authoritative.
        const secondary = initializeApp(app.options, `account-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const accountAuth = getAuth(secondary);
        const accountDb = getFirestore(secondary);
        let created = null;
        try {
            if (window.tsFirebase?.emulator?.enabled) {
                const host = window.tsFirebase.emulator.host;
                connectAuthEmulator(accountAuth, `http://${host}:9099`, { disableWarnings: true });
                connectFirestoreEmulator(accountDb, host, 8080);
            }
            await setPersistence(accountAuth, inMemoryPersistence);
            created = (await createUserWithEmailAndPassword(accountAuth, email, data.password)).user;
            await setDoc(doc(accountDb, 'Users', created.uid), {
                fullName, email: created.email, role: data.role,
                status: data.role === 'organizer' ? 'pending' : 'active',
                emailVerified: false, createdAt: new Date().toISOString()
            });
            if (organization) await setDoc(doc(accountDb, 'OrganizerProfiles', created.uid), organization);
            let verificationSent = true;
            try { await sendEmailVerification(created); }
            catch (_) { verificationSent = false; }
            return { id: created.uid, verificationSent };
        } catch (error) {
            if (created) {
                // Roll back only this newly provisioned account, never another UID.
                await deleteDoc(doc(db, 'OrganizerProfiles', created.uid)).catch(() => {});
                await deleteDoc(doc(db, 'Users', created.uid)).catch(() => {});
                await deleteUser(created).catch(() => {});
            }
            throw error;
        } finally {
            await deleteApp(secondary);
        }
    },
    async archive(userId) {
        await admin();
        if (userId === auth.currentUser.uid) throw new Error('You cannot archive your own account.');
        await runTransaction(db, async tx => {
            const target = doc(db, 'Users', userId);
            const snap = await tx.get(target);
            if (!snap.exists() || !['buyer', 'organizer'].includes(snap.data().role)) throw new Error('Only buyer and organizer accounts can be archived.');
            tx.update(target, { status: 'deleted', deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        });
    }
};

export const ComplaintCrud = {
    async update(id, data) {
        const category = text(data.category, 'Category');
        const description = text(data.description, 'Description', 10, 5000);
        await runTransaction(db, async tx => {
            const ref = doc(db, 'Complaints', id), snap = await tx.get(ref);
            if (!snap.exists() || snap.data().complainantUid !== auth.currentUser?.uid || snap.data().status !== 'OPEN') throw new Error('Only your own open complaint can be edited.');
            tx.update(ref, { category, description, updatedAt: new Date().toISOString() });
        });
    },
    async delete(id) {
        await runTransaction(db, async tx => {
            const ref = doc(db, 'Complaints', id), snap = await tx.get(ref);
            if (!snap.exists() || snap.data().complainantUid !== auth.currentUser?.uid || snap.data().status !== 'OPEN') throw new Error('Only your own open complaint can be deleted.');
            tx.delete(ref);
        });
    }
};

export async function reviseRejectedEvent(id) {
    await runTransaction(db, async tx => {
        const ref = doc(db, 'Events', id), snap = await tx.get(ref);
        if (!snap.exists() || snap.data().organizerUid !== auth.currentUser?.uid || snap.data().status !== 'REJECTED') throw new Error('Only your own rejected event can be revised.');
        const timestamp = new Date().toISOString();
        tx.update(ref, { status: 'DRAFT', updatedAt: timestamp,
            statusHistory: arrayUnion({ from: 'REJECTED', to: 'DRAFT', changedBy: auth.currentUser.uid, timestamp }) });
    });
}
