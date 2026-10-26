import { auth } from './firebase-init.js';

export function useLocalPosterUpload() {
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname)
        && window.tsFirebase?.emulator?.enabled !== true;
}

export async function uploadLocalPoster(eventId, file, onStatus = () => {}) {
    if (!auth.currentUser) throw new Error('Sign in before uploading a poster.');
    const root = window.tsFirebase?.backend?.projectUrl;
    if (!root || new URL(root).origin !== window.location.origin) throw new Error('The local poster service is not configured for this site.');
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new Error('The local poster upload timed out. Check XAMPP and your Firebase connection, then retry.'));
        }, 60000);
    });
    const upload = async () => {
        onStatus('Checking your organizer session...');
        const token = await auth.currentUser.getIdToken();
        if (controller.signal.aborted) return;
        const body = new FormData();
        body.append('eventId', eventId);
        body.append('file', file, file.name);
        onStatus('Uploading the event poster...');
        const response = await fetch(new URL('api/event-poster.php', root).href, {
            method: 'POST', credentials: 'same-origin', headers: { Authorization: `Bearer ${token}` },
            body, signal: controller.signal
        });
        let payload;
        try { payload = await response.json(); }
        catch (_) { throw new Error('The local poster service returned an invalid response. Check the XAMPP PHP error log.'); }
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'The event poster could not be saved.');
        if (!/^uploads\/posters\/[a-f0-9]{40}\.(jpg|png)$/.test(String(payload.path || ''))) throw new Error('The poster service returned an invalid file path.');
        return new URL(payload.path, root).href;
    };
    try { return await Promise.race([timeout, upload()]); }
    finally { clearTimeout(timer); }
}
