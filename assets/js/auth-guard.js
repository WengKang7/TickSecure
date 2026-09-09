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
        // Skip auto-redirects on register page to avoid race conditions during sign-up
        if (window.location.pathname.includes('register.php')) return;

        try {
            const snap = await getDoc(doc(db, 'Users', user.uid));
            if (snap.exists()) {
                const profile = snap.data();
                const role = profile.role;
                const status = profile.status;
                
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

            // Store profile in window for page scripts to use
            window.tsCurrentUser = {
                uid: user.uid,
                email: user.email,
                ...profile
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
                    ...snap.data()
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

