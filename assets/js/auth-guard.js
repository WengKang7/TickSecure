/**
 * TickSecure — Auth Guard
 * Protects routes based on authentication state and user role.
 * Loaded as a module on every page via shared/ui.php.
 */
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Resolve the app root from this module so root and XAMPP deployments work.
const base = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const path = window.location.pathname.replace(/\\/g, '/');
const appPath = path.slice(base.length).toLowerCase();
const section = appPath.split('/')[1] || 'public';
const publicRoutes = new Set(['', '/', '/index.php', '/public/events.php', '/public/event-detail.php']);
const requiresAuthentication = section !== 'auth' && !publicRoutes.has(appPath);
const loginUrl = base + '/auth/login.php';

// ============================================================
// SESSION CLEANUP
// ============================================================

function clearTickSecureSession() {

    // Remove current in-memory user
    window.tsCurrentUser = null;


    // Clear temporary session values
    try {
        sessionStorage.clear();
    } catch (error) {
        console.warn(
            'Unable to clear sessionStorage:',
            error
        );
    }


    // Remove only TickSecure-specific local values.
    // Do NOT clear the entire localStorage because other
    // applications/extensions may also store information there.
    try {

        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {

            const key = localStorage.key(i);

            if (
                key
                && (
                    key.startsWith('ticksecure.')
                    || key.startsWith('ts.')
                )
            ) {
                keysToRemove.push(key);
            }
        }


        keysToRemove.forEach(
            key => localStorage.removeItem(key)
        );


    } catch (error) {

        console.warn(
            'Unable to clear TickSecure localStorage:',
            error
        );

    }

}

async function logoutTickSecure() {

    const logoutButton =
        document.getElementById(
            'public-logout-btn'
        );


    if (logoutButton) {

        logoutButton.disabled = true;

        logoutButton.innerHTML =
            '<span>Signing out...</span>';

    }


    try {

        // Properly terminate Firebase Auth session
        await signOut(auth);


    } catch (error) {

        console.error(
            'Firebase logout error:',
            error
        );

    } finally {

        // Always remove local TickSecure session data
        clearTickSecureSession();


        // Replace prevents Back button from returning
        // directly to the previous authenticated page.
        window.location.replace(
            base + '/auth/login.php'
        );

    }

}

const publicLogoutButton =
    document.getElementById(
        'public-logout-btn'
    );


if (publicLogoutButton) {

    publicLogoutButton.addEventListener(
        'click',
        logoutTickSecure
    );

}

function updatePublicHeader(user, profile = null) {
    document.querySelectorAll('[data-ts-auth-only]').forEach(element => {
        element.hidden = !user;
    });

    const guestActions =
        document.getElementById('public-guest-actions');

    const userActions =
        document.getElementById('public-user-actions');


    // ==========================================
    // NOT LOGGED IN
    // ==========================================

    if (!user) {

        if (guestActions) {
            guestActions.style.display = 'flex';
        }

        if (userActions) {
            userActions.style.display = 'none';
        }

        return;
    }


    // ==========================================
    // LOGGED IN
    // ==========================================

    if (guestActions) {
        guestActions.style.display = 'none';
    }

    if (userActions) {
        userActions.style.display = 'flex';
    }


    // ------------------------------------------
    // Display name
    // ------------------------------------------

    const displayName =
        profile?.fullName ||
        profile?.organizationName ||
        user.displayName ||
        user.email?.split('@')[0] ||
        'User';


    const nameEl =
        document.getElementById('public-user-name');

    if (nameEl) {
        nameEl.textContent = displayName;
    }


    // ------------------------------------------
    // Initials
    // ------------------------------------------

    const initials = displayName
        .split(' ')
        .filter(Boolean)
        .map(part => part[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();


    const initialsEl =
        document.getElementById('header-avatar-initials');

    if (initialsEl) {
        initialsEl.textContent = initials || 'U';
    }


    // ------------------------------------------
    // Profile picture
    // ------------------------------------------

    const photoUrl =
        profile?.profilePhotoUrl ||
        profile?.photoURL ||
        user.photoURL ||
        '';


    const avatarImg =
        document.getElementById('header-avatar-img');


    if (avatarImg) {

        if (photoUrl) {

            avatarImg.src = photoUrl;
            avatarImg.style.display = 'block';

            if (initialsEl) {
                initialsEl.style.display = 'none';
            }

        } else {

            avatarImg.removeAttribute('src');
            avatarImg.style.display = 'none';

            if (initialsEl) {
                initialsEl.style.display = '';
            }

        }

    }


    // ------------------------------------------
    // Correct profile page based on role
    // ------------------------------------------

    const profileLink =
        document.getElementById('public-user-link');


    if (profileLink) {

        if (profile?.role === 'admin') {

            profileLink.href =
                base + '/admin/profile.php';

        } else if (profile?.role === 'organizer') {

            profileLink.href =
                base + '/organizer/profile.php';

        } else {

            profileLink.href =
                base + '/buyer/profile.php';

        }

    }


    // ------------------------------------------
    // Wallet display
    // ------------------------------------------

    const walletMini =
        document.getElementById('public-wallet-mini');

    const walletText =
        document.getElementById('public-wallet-text');


    const walletAddress =
        profile?.walletAddress || '';


    if (walletMini) {

        if (walletAddress) {

            walletMini.style.display = 'flex';

            if (walletText) {

                walletText.textContent =
                    walletAddress.substring(0, 6)
                    + '…'
                    + walletAddress.slice(-4);

            }

        } else {

            walletMini.style.display = 'none';

        }

    }

}

function publishAuthState(user, profile) {
    window.tsCurrentUser = user && profile ? {
        ...profile,
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified === true
    } : null;
    updatePublicHeader(window.tsCurrentUser ? user : null, profile);
    window.dispatchEvent(new CustomEvent('ts-auth-ready', { detail: window.tsCurrentUser }));
}

onAuthStateChanged(auth, async (user) => {
    // Re-lock on sign-out or account changes, including on already open pages.
    document.documentElement.removeAttribute('data-ts-access');
    window.tsCurrentUser = null;
    updatePublicHeader(null);

    if (!user) {
        if (requiresAuthentication) {
            window.location.replace(loginUrl);
        } else {
            publishAuthState(null, null);
        }
        return;
    }

    // The sign-in form owns verification and redirect while it is submitting.
    // Avoid two competing reload/profile requests and navigation decisions.
    if (section === 'auth' && window.tsLoginInProgress) return;

    // Account creation and email verification manage their own onboarding.
    if (section === 'auth' && ['/auth/register.php', '/auth/verify-email.php'].includes(appPath)) return;

    try {
        if (section === 'auth') await user.reload();
        const snap = await getDoc(doc(db, 'Users', user.uid));
        if (!snap.exists()) {
            if (requiresAuthentication) window.location.replace(loginUrl);
            else publishAuthState(null, null);
            return;
        }
        const profile = snap.data();
        const { role, status } = profile;

        if (requiresAuthentication || section === 'auth') {
            // Retain the existing administrator verification exception.
            if (role !== 'admin' && !user.emailVerified) {
                window.location.replace(base + '/auth/verify-email.php');
                return;
            }
            if (!['buyer', 'organizer', 'admin'].includes(role) || status !== 'active') {
                await signOut(auth);
                window.location.replace(loginUrl);
                return;
            }
            if ((section === 'admin' && role !== 'admin')
                || (section === 'organizer' && role !== 'organizer')
                || (section === 'verification' && !['admin', 'organizer'].includes(role))) {
                window.location.replace(base + (role === 'buyer' ? '/public/events.php' : '/' + role + '/dashboard.php'));
                return;
            }
            if (section === 'auth') {
                window.location.replace(base + (role === 'buyer' ? '/public/events.php' : '/' + role + '/dashboard.php'));
                return;
            }
        }

        const displayName = profile.organizationName || profile.fullName || user.email?.split('@')[0] || 'User';
        const initials = displayName.split(' ').filter(Boolean).map(name => name[0]).join('').substring(0, 2).toUpperCase();
        const sidebarAvatar = document.getElementById('sidebar-avatar');
        if (sidebarAvatar) sidebarAvatar.textContent = initials;
        const sidebarName = document.getElementById('sidebar-name');
        if (sidebarName) sidebarName.textContent = displayName;
        const headerAvatar = document.getElementById('header-avatar');
        if (headerAvatar && !document.getElementById('header-avatar-initials')) headerAvatar.textContent = initials;

        document.documentElement.setAttribute('data-ts-access', 'granted');
        publishAuthState(user, profile);
    } catch (error) {
        console.error('Auth guard error:', error);
        // Protected pages stay hidden if identity/profile validation fails.
        if (requiresAuthentication) {
            window.tsAccessStatus?.fail('TickSecure could not verify your account. Check your connection and retry, or return to sign in.');
        } else {
            publishAuthState(null, null);
        }
    }
});
