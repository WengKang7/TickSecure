import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// TODO: Replace this object with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDFKJ4FxXqBNtuTCbZ1ayhuidZYwVMGdJU",
  authDomain: "tick-c12a1.firebaseapp.com",
  projectId: "tick-c12a1",
  storageBucket: "tick-c12a1.firebasestorage.app",
  messagingSenderId: "687361335301",
  appId: "1:687361335301:web:0a49161fd06ee236627c6c",
  measurementId: "G-2CTJG8KE06"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Make Firebase services globally available to other scripts
window.tsFirebase = {
    app,
    auth,
    db,
    storage
};

console.log("Firebase initialized successfully.");

export { app, auth, db, storage };
