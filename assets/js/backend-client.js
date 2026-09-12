import { app, auth } from './firebase-init.js';
import {
    getFunctions, httpsCallable
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-functions.js";

/**
 * Invokes the same trusted workflow contract in either supported local mode:
 * the normal Firebase callable Functions path (including Emulator Suite), or
 * the explicitly selected XAMPP/PHP bridge. Browser code never receives a
 * service-account credential in either case.
 */
export function usingLocalPhpBackend() {
    return window.tsFirebase?.backend?.mode === 'php';
}

function backendError(payload, fallbackMessage, status) {
    const error = new Error(payload?.error?.message || fallbackMessage);
    error.code = payload?.error?.code || 'backend_error';
    error.status = status;
    return error;
}

async function invokeLocalPhpBackend(request, config) {
    const backend = window.tsFirebase?.backend;
    if (!backend?.compatible) {
        throw new Error(
            'PHP backend mode cannot be used with Firebase Emulator mode. Use either ?firebaseEmulator=1 or ?firebaseBackend=php, not both.'
        );
    }
    if (!auth.currentUser) {
        throw new Error('You must be signed in.');
    }
    if (!backend.endpoint) {
        throw new Error('The local PHP backend endpoint is not configured.');
    }

    const idToken = await auth.currentUser.getIdToken();
    let response;
    try {
        response = await fetch(backend.endpoint, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ action: config.name, data: request })
        });
    } catch (_) {
        throw new Error('The local PHP backend could not be reached. Check that XAMPP Apache is running.');
    }

    let payload = null;
    try {
        payload = await response.json();
    } catch (_) {
        throw new Error('The local PHP backend returned an invalid response.');
    }
    if (!response.ok || payload?.error) {
        throw backendError(payload, 'The local PHP backend rejected this request.', response.status);
    }
    return payload?.data || {};
}

/** @param {{name: string, region?: string}} config */
export async function invokeTrustedBackend(request, config) {
    if (!config?.name) {
        throw new Error('The secure backend action is not configured.');
    }
    if (usingLocalPhpBackend()) {
        return invokeLocalPhpBackend(request, config);
    }

    const functions = config.region ? getFunctions(app, config.region) : getFunctions(app);
    const invoke = httpsCallable(functions, config.name);
    const result = await invoke(request);
    return result?.data || {};
}
