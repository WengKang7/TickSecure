'use strict';
const { HttpsError } = require('firebase-functions/v2/https');

// Only return eligibility. Never return user IDs, profile data, or reset links.
async function checkPasswordResetEmail(data, { findAuthUser, findProfile }) {
    const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpsError('invalid-argument', 'Enter a valid email address.');
    }
    let user;
    try {
        user = await findAuthUser(email);
    } catch (error) {
        if (error.code === 'auth/user-not-found') return { registered: false };
        throw error;
    }
    if (!user?.uid || String(user.email || '').trim().toLowerCase() !== email) {
        return { registered: false };
    }
    const profile = await findProfile(user.uid);
    return { registered: Boolean(profile
        && ['buyer', 'organizer', 'admin'].includes(profile.role)
        && typeof profile.email === 'string'
        && profile.email.trim().toLowerCase() === email) };
}

module.exports = { checkPasswordResetEmail };
