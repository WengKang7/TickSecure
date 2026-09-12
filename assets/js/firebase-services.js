import { auth, db } from './firebase-init.js';
import { invokeTrustedBackend } from './backend-client.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendEmailVerification,
    reload
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    doc, setDoc, getDoc, collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// AUTHENTICATION SERVICES
// ==========================================
export const AuthService = {
    registerUser: async (email, password, role, profileData) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 1. Create base user document
        await setDoc(doc(db, "Users", user.uid), {
            email: user.email,
            fullName: profileData.fullName,
            role: role,
            status: role === 'organizer' ? 'pending' : 'active',
            emailVerified: false,
            createdAt: new Date().toISOString()
        });

        // 2. If organizer, create organizer profile details
        if (role === 'organizer') {
            await setDoc(doc(db, "OrganizerProfiles", user.uid), {
                organizationName: profileData.organizationName,
                organizationDescription: profileData.organizationDescription,
                organizationPhone: profileData.organizationPhone,
                organizationAddress: profileData.organizationAddress
            });
        }
        try {
            await sendEmailVerification(user);
        } catch (error) {
            // The account/profile was created successfully. Surface a resend
            // option instead of leaving an orphaned registration if Firebase
            // email-action settings are incomplete in development.
            console.warn('Unable to send verification email:', error);
        }
        return user;
    },

    login: async (email, password) => {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await reload(credential.user);
        return credential;
    },

    resendVerificationEmail: async () => {
        if (!auth.currentUser) throw new Error('Sign in before requesting another verification email.');
        await sendEmailVerification(auth.currentUser);
    },

    syncEmailVerification: async () => {
        if (!auth.currentUser) return false;
        await reload(auth.currentUser);
        if (!auth.currentUser.emailVerified) return false;
        await auth.currentUser.getIdToken(true);
        const config = window.tsSyncEmailVerificationFunction || { name: 'syncEmailVerification' };
        try {
            await invokeTrustedBackend({}, typeof config === 'string' ? { name: config } : config);
        } catch (backendError) {
            // Spark-plan demos may use Firebase Auth + Firestore without a
            // deployed callable backend. The Firestore policy permits this
            // narrow self-service projection only after a freshly verified
            // Firebase Auth token proves the email claim. Keep the callable
            // path first so production deployments retain their audit record.
            try {
                await setDoc(doc(db, 'Users', auth.currentUser.uid), {
                    emailVerified: true,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            } catch (profileError) {
                const message = profileError?.message || backendError?.message || 'Unable to update verification status.';
                throw new Error(
                    `Your email is verified, but TickSecure could not update your profile. ${message}`
                );
            }
        }
        return true;
    },
    
    logout: () => signOut(auth),
    
    onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback)
};

// ==========================================
// DATABASE (FIRESTORE) SERVICES
// ==========================================
export const DbService = {
    getUserProfile: async (uid) => {
        const docSnap = await getDoc(doc(db, "Users", uid));
        return docSnap.exists() ? docSnap.data() : null;
    },

    getVenues: async () => {
        const q = query(collection(db, "Venues"), where("layoutStatus", "==", "ACTIVE"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    getEvents: async () => {
        // Public/browser callers can only enumerate published events under
        // Firestore Rules. Admin and organizer screens use EventService,
        // which scopes their protected queries to the signed-in profile.
        const querySnapshot = await getDocs(query(
            collection(db, "Events"),
            where("status", "==", "PUBLISHED")
        ));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
};

// Expose globally for UI scripts
window.tsAuth = AuthService;
window.tsDb = DbService;
