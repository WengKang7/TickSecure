import { auth } from './firebase-init.js';

export function useLocalBlueprintUpload() {
    return ['localhost', '127.0.0.1', '[::1]', '::1', 'ticksecure.onrender.com'].includes(window.location.hostname)
        && window.tsFirebase?.emulator?.enabled !== true;
}

export async function uploadLocalBlueprint(venueId, file, onStatus = () => {}) {
    if (!auth.currentUser) throw new Error('Sign in before uploading a blueprint.');
    const root = window.tsFirebase?.backend?.projectUrl;
    if (!root || new URL(root).origin !== window.location.origin) throw new Error('The blueprint service is not configured for this site.');
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new Error('The blueprint upload timed out. Check your connection and retry.'));
        }, 90000);
    });
    const upload = async () => {
        onStatus('Verifying your administrator session...');
        const token = await auth.currentUser.getIdToken();
        if (controller.signal.aborted) return;
        const body = new FormData();
        body.append('venueId', venueId);
        body.append('file', file, file.name);
        onStatus('Saving your blueprint...');
        const response = await fetch(new URL('api/venue-blueprint.php', root).href, {
            method: 'POST', credentials: 'same-origin',
            headers: { Authorization: `Bearer ${token}` },
            body, signal: controller.signal
        });
        let payload;
        try { payload = await response.json(); }
        catch (_) { throw new Error('The blueprint service returned an invalid response. Please retry or contact the administrator.'); }
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'The blueprint could not be saved.');
        const expected = `api/venue-blueprint.php?venueId=${encodeURIComponent(venueId)}`;
        if (payload.url !== expected) {
            const url = new URL(payload.url);
            if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || url.port
                || !/^\/[^/]+\/image\/upload\/(?:v\d+\/)?ticksecure\/venues\//.test(url.pathname)) {
                throw new Error('The blueprint service returned an invalid file URL.');
            }
            return url.href;
        }
        return new URL(payload.url, root).href;
    };
    try { return await Promise.race([timeout, upload()]); }
    finally { clearTimeout(timer); }
}
