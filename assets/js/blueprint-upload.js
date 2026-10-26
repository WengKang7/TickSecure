import { auth } from './firebase-init.js';

export function useLocalBlueprintUpload() {
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname)
        && window.tsFirebase?.emulator?.enabled !== true;
}

export async function uploadLocalBlueprint(venueId, file, onStatus = () => {}) {
    if (!auth.currentUser) throw new Error('Sign in before uploading a blueprint.');
    const root = window.tsFirebase?.backend?.projectUrl;
    if (!root) throw new Error('The local blueprint service is not configured.');
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new Error('The local blueprint upload timed out. Check that XAMPP and Firebase Authentication/Firestore are reachable.'));
        }, 60000);
    });
    const upload = async () => {
        onStatus('Verifying your administrator session...');
        const token = await auth.currentUser.getIdToken();
        if (controller.signal.aborted) return;
        const body = new FormData();
        body.append('venueId', venueId);
        body.append('file', file, file.name);
        onStatus('Saving blueprint to local storage...');
        const response = await fetch(new URL('api/venue-blueprint.php', root).href, {
            method: 'POST', credentials: 'same-origin',
            headers: { Authorization: `Bearer ${token}` },
            body, signal: controller.signal
        });
        let payload;
        try { payload = await response.json(); }
        catch (_) { throw new Error('The local blueprint service returned an invalid response. Check the XAMPP PHP error log.'); }
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'The blueprint could not be saved.');
        const expected = `api/venue-blueprint.php?venueId=${encodeURIComponent(venueId)}`;
        if (payload.url !== expected) throw new Error('The blueprint service returned an invalid file URL.');
        return new URL(payload.url, root).href;
    };
    try { return await Promise.race([timeout, upload()]); }
    finally { clearTimeout(timer); }
}
