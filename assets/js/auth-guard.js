/**
 * TickSecure — Auth Guard
 * Protects routes based on authentication state and user role.
 * Loaded as a module on every page via shared/ui.php.
 */
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const path = window.location.pathname.replace(/\\/g, '/');

function getBase() {
    // Determine the base URL by finding ticksecure-ui in the path
    const idx = path.indexOf('/ticksecure-ui/');
    if (idx !== -1) return path.substring(0, idx + '/ticksecure-ui'.length);
    // Fallback for root deployment
    return '';
}

function getSection() {
    if (path.includes('/admin/'))        return 'admin';
    if (path.includes('/organizer/'))    return 'organizer';
    if (path.includes('/buyer/'))        return 'buyer';
    if (path.includes('/auth/'))         return 'auth';
    if (path.includes('/verification/')) return 'verification';
    if (path.includes('/public/'))       return 'public';
    return 'public'; // index.php, preview.php
}

const base = getBase();
const section = getSection();

// Public and auth sections have different rules
const publicSections = ['public', 'auth'];
const protectedSections = ['admin', 'organizer', 'buyer', 'verification'];

onAuthStateChanged(auth, async (user) => {
    // -------------------------------------------------------
    // 1. Auth pages: redirect authenticated users away
    // -------------------------------------------------------
    if (section === 'auth' && user) {
        // Keep onboarding pages accessible during account creation and while
        // a newly registered user is waiting for an email verification link.
        if (window.location.pathname.includes('register.php')
            || window.location.pathname.includes('verify-email.php')) return;

        try {
            // A verification link changes Firebase Auth outside this tab. A
            // fresh reload prevents the sign-in page from looping back to the
            // verification page with a stale emailVerified value.
            await user.reload();
            const snap = await getDoc(doc(db, 'Users', user.uid));
            if (snap.exists()) {
                const profile = snap.data();
                const role = profile.role;
                const status = profile.status;
                if (!user.emailVerified) {
                    window.location.href = base + '/auth/verify-email.php';
                    return;
                }
                
                if (role === 'admin') {
                    window.location.href = base + '/admin/dashboard.php';
                } else if (role === 'organizer') {
                    if (status === 'pending' || status === 'suspended' || status === 'rejected') {
                        alert(`Your organizer account is ${status}. Please wait for approval.`);
                        await signOut(auth);
                    } else {
                        window.location.href = base + '/organizer/dashboard.php';
                    }
                } else {
                    window.location.href = base + '/public/events.php';
                }
                return;
            }
        } catch (e) { /* allow access to auth pages if profile check fails */ }
    }

    // -------------------------------------------------------
    // 2. Protected pages: require authentication
    // -------------------------------------------------------
    if (protectedSections.includes(section) && !user) {
        window.location.href = base + '/auth/login.php';
        return;
    }

    // -------------------------------------------------------
    // 3. Role-based access control for protected sections
    // -------------------------------------------------------
    if (protectedSections.includes(section) && user) {
        try {
            const snap = await getDoc(doc(db, 'Users', user.uid));
            if (!snap.exists()) {
                window.location.href = base + '/auth/login.php';
                return;
            }

            const profile = snap.data();
            const role = profile.role;
            const status = profile.status;

            // Admin section — only admins
            if (!user.emailVerified) {
                window.location.href = base + '/auth/verify-email.php';
                return;
            }

            if (section === 'admin' && role !== 'admin') {
                window.location.href = base + '/auth/login.php';
                return;
            }

            // Organizer section — only active organizers
            if (section === 'organizer') {
                if (role !== 'organizer') {
                    window.location.href = base + '/auth/login.php';
                    return;
                }
                if (status === 'pending' || status === 'suspended' || status === 'rejected') {
                    alert(`Your organizer account is ${status}. Please wait for approval.`);
                    await signOut(auth);
                    window.location.href = base + '/auth/login.php';
                    return;
                }
            }

            // Buyer section — any authenticated user
            // (organizers and admins can also view buyer pages)

            if (status !== 'active') {
                alert(`Your account is ${status || 'not active'}. Please contact support.`);
                await signOut(auth);
                window.location.href = base + '/auth/login.php';
                return;
            }

            // Entry scanning consumes a ticket, so it is limited to the same
            // active organizer/admin roles enforced by the backend endpoint.
            if (section === 'verification'
                && (!['admin', 'organizer'].includes(role) || status !== 'active')) {
                window.location.href = base + '/auth/login.php';
                return;
            }

            // Store profile in window for page scripts to use
            window.tsCurrentUser = {
                uid: user.uid,
                email: user.email,
                ...profile,
                emailVerified: user.emailVerified === true
            };

            // Update UI Sidebar/Header if elements exist
            const displayName = profile.organizationName || profile.fullName || user.email.split('@')[0];
            const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            
            const sidebarAvatar = document.getElementById('sidebar-avatar');
            if (sidebarAvatar) sidebarAvatar.textContent = initials;
            
            const headerAvatar = document.getElementById('header-avatar');
            if (headerAvatar) headerAvatar.textContent = initials;
            
            const sidebarName = document.getElementById('sidebar-name');
            if (sidebarName) sidebarName.textContent = displayName;

            // Dispatch an event so page scripts know the user is ready
            window.dispatchEvent(new CustomEvent('ts-auth-ready', {
                detail: window.tsCurrentUser
            }));

        } catch (e) {
            console.error('Auth guard error:', e);
        }
    }

    // -------------------------------------------------------
    // 4. Public pages: set user info if logged in (optional)
    // -------------------------------------------------------
    if (!protectedSections.includes(section) && user) {
        try {
            const snap = await getDoc(doc(db, 'Users', user.uid));
            if (snap.exists()) {
                window.tsCurrentUser = {
                    uid: user.uid,
                    email: user.email,
                    ...snap.data(),
                    emailVerified: user.emailVerified === true
                };
                
                const profile = snap.data();
                const displayName = profile.organizationName || profile.fullName || user.email.split('@')[0];
                const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                
                const headerAvatar = document.getElementById('header-avatar');
                if (headerAvatar) headerAvatar.textContent = initials;
                
                window.dispatchEvent(new CustomEvent('ts-auth-ready', {
                    detail: window.tsCurrentUser
                }));
            }
        } catch (e) { /* non-critical for public pages */ }
    }

    // No user on public pages — that's fine
    if (!protectedSections.includes(section) && !user) {
        window.tsCurrentUser = null;
        window.dispatchEvent(new CustomEvent('ts-auth-ready', { detail: null }));
    }
});
