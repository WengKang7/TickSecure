import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-functions.js";

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

const EMULATOR_MODE_STORAGE_KEY = 'ticksecure.firebase.useEmulators';
const EMULATOR_HOST_STORAGE_KEY = 'ticksecure.firebase.emulatorHost';
const BACKEND_MODE_STORAGE_KEY = 'ticksecure.firebase.backendMode';
const EMULATOR_PORTS = Object.freeze({
  auth: 9099,
  firestore: 8080,
  functions: 5001,
  storage: 9199
});

function localSetting(key, value) {
  try {
    if (value === undefined) return window.localStorage.getItem(key);
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing or restrictive browser policies can deny localStorage.
  }
  return null;
}

function parseBoolean(value) {
  if (typeof value !== 'string') return null;
  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
  return null;
}

function validEmulatorHost(value) {
  const host = String(value || '').trim();
  // A hostname only: ports, paths, and protocols do not belong in an emulator host.
  return /^[A-Za-z0-9.-]+$/.test(host) ? host : '';
}

function normalizeBackendMode(value) {
  if (typeof value !== 'string') return null;
  const mode = value.trim().toLowerCase();
  return ['firebase', 'php'].includes(mode) ? mode : null;
}

const pageParameters = new URLSearchParams(window.location.search);
const requestedEmulatorMode = parseBoolean(pageParameters.get('firebaseEmulator'));
if (requestedEmulatorMode !== null) {
  localSetting(EMULATOR_MODE_STORAGE_KEY, String(requestedEmulatorMode));
}

const useEmulators = requestedEmulatorMode
  ?? parseBoolean(localSetting(EMULATOR_MODE_STORAGE_KEY))
  ?? false;

// `firebaseBackend=php` is an explicit, local XAMPP-only alternative to
// deployed Functions. It is remembered just like the emulator switch. The
// PHP bridge talks to the real Firebase Auth/Firestore services, so it cannot
// be combined with an Auth/Firestore emulator session.
const requestedBackendMode = normalizeBackendMode(pageParameters.get('firebaseBackend'));
if (requestedBackendMode !== null) {
  localSetting(BACKEND_MODE_STORAGE_KEY, requestedBackendMode);
}
const backendMode = requestedBackendMode
  ?? normalizeBackendMode(localSetting(BACKEND_MODE_STORAGE_KEY))
  ?? 'firebase';
const projectUrl = new URL('../../', import.meta.url).href;
const phpBackendEndpoint = new URL('api/backend.php', projectUrl).href;
const localUploadEndpoint = new URL('api/upload.php?mode=local-dev', projectUrl).href;

const requestedEmulatorHost = validEmulatorHost(pageParameters.get('firebaseEmulatorHost'));
if (requestedEmulatorHost) {
  localSetting(EMULATOR_HOST_STORAGE_KEY, requestedEmulatorHost);
}

const emulatorHost = requestedEmulatorHost
  || validEmulatorHost(localSetting(EMULATOR_HOST_STORAGE_KEY))
  || validEmulatorHost(window.location.hostname)
  || '127.0.0.1';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, "asia-southeast1");

// Local-only opt-in. Production Firebase stays the default unless the browser
// receives ?firebaseEmulator=1 (which is then remembered in localStorage) or
// localStorage contains ticksecure.firebase.useEmulators=true.
if (useEmulators) {
  connectAuthEmulator(auth, `http://${emulatorHost}:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, EMULATOR_PORTS.firestore);
  connectStorageEmulator(storage, emulatorHost, EMULATOR_PORTS.storage);
  connectFunctionsEmulator(functions, emulatorHost, EMULATOR_PORTS.functions);
}

// Make Firebase services globally available to other scripts
window.tsFirebase = {
    app,
    auth,
    db,
    storage,
    functions,
    emulator: Object.freeze({
      enabled: useEmulators,
      host: useEmulators ? emulatorHost : null,
      ports: EMULATOR_PORTS
    }),
    backend: Object.freeze({
      mode: backendMode,
      compatible: backendMode !== 'php' || !useEmulators,
      endpoint: phpBackendEndpoint,
      uploadEndpoint: localUploadEndpoint,
      projectUrl
    })
};
window.tsBackendMode = backendMode;

// Sensitive writes are callable Functions in production. These globals are
// intentionally configurable before a page-specific action executes, which
// also makes Emulator Suite/local development possible without changing code.
window.tsCheckoutFunction ??= { name: 'checkout', region: 'asia-southeast1' };
window.tsSeatReservationFunction ??= { name: 'reserveSeats', region: 'asia-southeast1' };
window.tsSeatReleaseFunction ??= { name: 'releaseSeatReservation', region: 'asia-southeast1' };
window.tsTransferTicketFunction ??= { name: 'transferTicket', region: 'asia-southeast1' };
window.tsScanTicketFunction ??= { name: 'scanTicket', region: 'asia-southeast1' };
window.tsCreateResaleListingFunction ??= { name: 'createResaleListing', region: 'asia-southeast1' };
window.tsUpdateResalePriceFunction ??= { name: 'updateResalePrice', region: 'asia-southeast1' };
window.tsCancelResaleListingFunction ??= { name: 'cancelResaleListing', region: 'asia-southeast1' };
window.tsSuspendResaleListingFunction ??= { name: 'suspendResaleListing', region: 'asia-southeast1' };
window.tsPurchaseResaleFunction ??= { name: 'purchaseResale', region: 'asia-southeast1' };
window.tsSyncEmailVerificationFunction ??= { name: 'syncEmailVerification', region: 'asia-southeast1' };

console.log(
  `Firebase initialized successfully${useEmulators ? ` (Emulator Suite: ${emulatorHost})` : ''}`
  + `${backendMode === 'php' ? ' (local PHP backend selected)' : ''}.`
);

export { app, auth, db, storage, functions };
