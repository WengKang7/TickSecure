'use strict';
const { randomUUID } = require('node:crypto');

// Shared by the local PHP bridge and Firebase callable. No password is ever
// written to Firestore, an audit record, or the response.
function createAdminAccountService(db, auth, { fail }) {
    const reject = (code, message) => fail(code, message);
    const text = (value, label, min, max) => {
        if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) reject('invalid-argument', `${label} is invalid.`);
        return value.trim();
    };
    async function manage(uid, data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) reject('invalid-argument', 'Account details are required.');
        const id = text(data.userId, 'Account ID', 1, 128);
        if (!/^[A-Za-z0-9_-]+$/.test(id) || id === uid) reject('permission-denied', 'You cannot change your own account here.');
        const action = data.action;
        if (!['edit', 'inactivate', 'reactivate', 'delete'].includes(action)) reject('invalid-argument', 'Choose a valid account action.');
        const fields = {}, organization = {};
        if (action === 'edit') {
            fields.fullName = text(data.fullName, 'Full name', 3, 100);
            fields.email = text(data.email, 'Email', 3, 254).toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) reject('invalid-argument', 'Enter a valid email address.');
            if (!['buyer', 'organizer'].includes(data.role)) reject('invalid-argument', 'Choose Buyer or Event Organizer.');
            fields.role = data.role;
            if (data.password !== undefined && data.password !== '') {
                const p = data.password, symbols = "^$*.[]{}()?\"!@#%&/\\,><':;|_~`-";
                if (typeof p !== 'string' || p.length < 8 || p.length > 4096 || !/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p) || !Array.from(p).some(c => symbols.includes(c))) reject('invalid-argument', 'Use 8–4096 password characters with uppercase, lowercase, a number and a special character.');
            }
            if (fields.role === 'organizer') {
                for (const [key, max] of Object.entries({ organizationName: 120, organizationPhone: 50, organizationAddress: 1000, organizationDescription: 5000 })) organization[key] = text(data[key], key, 1, max);
                if (!/^\+?[0-9]{8,15}$/.test(organization.organizationPhone)) reject('invalid-argument', 'Enter a valid organization phone number.');
            }
        }
        const userRef = db.collection('Users').doc(id), lockRef = db.collection('AdminAccountMutations').doc(id);
        const token = randomUUID(), timestamp = new Date().toISOString();
        // Temporarily block protected access while Auth and Firestore are updated.
        // A failed operation stays inactive and can be retried without losing history.
        const operation = await db.runTransaction(async tx => {
            const [actorSnap, targetSnap, lockSnap] = await Promise.all([tx.get(db.collection('Users').doc(uid)), tx.get(userRef), tx.get(lockRef)]);
            const actor = actorSnap.data(), user = targetSnap.data(), previous = lockSnap.data();
            if (!actor || actor.role !== 'admin' || actor.status !== 'active') reject('permission-denied', 'An active administrator account is required.');
            if (!user || !['buyer', 'organizer'].includes(user.role)) reject('permission-denied', 'Only buyer and organizer accounts can be managed here.');
            if (user.status === 'deleted') reject('failed-precondition', 'This account has been deleted. Its history is retained.');
            if (previous?.busy && Date.now() - previous.startedAt < 120000) reject('failed-precondition', 'An account update is already running. Please wait before retrying.');
            if (previous?.failed && action === 'reactivate') reject('failed-precondition', 'Save the account details successfully before reactivating it.');
            const currentStatus = previous?.failed || previous?.busy ? previous.restoreStatus : user.status;
            let status = currentStatus;
            if (action === 'delete') status = 'deleted';
            if (action === 'inactivate') status = 'inactive';
            if (action === 'reactivate') {
                if (!['inactive', 'suspended'].includes(currentStatus)) reject('failed-precondition', 'Only inactive accounts can be reactivated.');
                status = user.inactivePreviousStatus || 'active';
                if (!['active', 'pending', 'rejected'].includes(status)) status = 'active';
            }
            tx.set(lockRef, { busy: true, failed: false, token, startedAt: Date.now(), restoreStatus: currentStatus });
            tx.update(userRef, { status: 'inactive', updatedAt: timestamp });
            return { user, actor, status, currentStatus };
        });
        let emailChanged = false;
        try {
            // Disable first so a partial failure never leaves a changed login usable.
            await auth.updateUser(id, { disabled: true });
            const changes = {};
            if (action === 'edit') {
                const existing = await auth.getUser(id);
                emailChanged = fields.email !== String(operation.user.email || '').toLowerCase();
                changes.email = fields.email;
                changes.displayName = fields.fullName;
                if (emailChanged || fields.email !== String(existing.email || '').toLowerCase()) changes.emailVerified = false;
                if (data.password) changes.password = data.password;
                await auth.updateUser(id, changes);
            }
            await auth.revokeRefreshTokens(id);
            await db.runTransaction(async tx => {
                const lock = (await tx.get(lockRef)).data();
                if (lock?.token !== token) reject('failed-precondition', 'A newer account update is running.');
                const update = { ...fields, status: operation.status, updatedAt: timestamp };
                if (emailChanged) update.emailVerified = false;
                if (action === 'inactivate' && operation.currentStatus !== 'inactive') update.inactivePreviousStatus = operation.currentStatus;
                if (action === 'delete') update.deletedAt = timestamp;
                if (Object.keys(organization).length) tx.set(db.collection('OrganizerProfiles').doc(id), organization, { merge: true });
                tx.update(userRef, update);
                tx.set(db.collection('AuditLogs').doc(), { action: `account_${action}`, entityType: 'user', entityId: id, actorUid: uid, actorEmail: operation.actor.email || '', actorRole: 'admin', result: 'success', timestamp,
                    details: { role: fields.role || operation.user.role, emailChanged, passwordChanged: Boolean(action === 'edit' && data.password) } });
                // Keep the lock until Auth is enabled as well.
            });
            if (!['inactive', 'suspended', 'deleted'].includes(operation.status)) await auth.updateUser(id, { disabled: false });
            await db.runTransaction(async tx => {
                if ((await tx.get(lockRef)).data()?.token === token) tx.set(lockRef, { busy: false, failed: false });
            });
            return { id, status: operation.status, emailChanged };
        } catch (error) {
            await db.runTransaction(async tx => {
                if ((await tx.get(lockRef)).data()?.token !== token) return;
                tx.update(userRef, { status: 'inactive', updatedAt: new Date().toISOString() });
                tx.set(lockRef, { busy: false, failed: true, restoreStatus: operation.currentStatus });
            }).catch(() => {});
            const message = error.code === 'auth/email-already-exists' ? 'That email is already used by another account.' : 'The account update could not finish.';
            reject('failed-precondition', `${message} Access remains inactive. Correct the details and save again.`);
        }
    }
    return { manage };
}
module.exports = { createAdminAccountService };
