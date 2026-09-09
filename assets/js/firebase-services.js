import { auth, db } from './firebase-init.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
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
        return user;
    },

    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    
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
        const querySnapshot = await getDocs(collection(db, "Events"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
};

// Expose globally for UI scripts
window.tsAuth = AuthService;
window.tsDb = DbService;
