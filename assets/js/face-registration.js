(function () {
    const el = id => document.getElementById(id), id = new URLSearchParams(location.search).get('ticketId') || '';
    const camera = window.tsFace.camera(el('face-video'));
    let state = null, busy = false, starting = false, cameraReady = false, version = 0;
    function buttons() {
        el('face-save').disabled = busy || starting || !cameraReady || !el('face-consent').checked || !state?.eligible || state?.registered;
        el('face-save').hidden = !!state?.registered;
        el('face-remove').disabled = busy;
        el('face-retry').disabled = busy || starting;
    }
    function error(e) { el('face-error').textContent = e.message || 'Face registration is unavailable.'; el('face-error').hidden = false; }
    async function startCamera(current = version) {
        if (current !== version || busy || starting || cameraReady || document.hidden || !state?.eligible || state.registered) return;
        starting = true; buttons(); el('face-status').textContent = 'Starting camera. Allow camera access if your browser asks.';
        try {
            await camera.start(); if (current !== version) return;
            cameraReady = true; el('face-status').textContent = 'Look straight at the camera. Agree below, then select Register my face.';
        } catch (e) {
            if (current === version) { cameraReady = false; error(e); el('face-status').textContent = 'Allow camera access in your browser, then reload this page to try again.'; }
        } finally { if (current === version) { starting = false; buttons(); } }
    }
    async function load() {
        const current = ++version; state = null; busy = starting = cameraReady = false; camera.stop(); buttons();
        el('face-ticket').hidden = el('face-remove').hidden = true;
        el('face-duplicate').hidden = true; el('face-error').hidden = true;
        if (!window.tsCurrentUser?.uid) return;
        try {
            const result = await window.tsFace.request('status', { ticketId: id });
            if (version !== current) return;
            state = result; el('face-status').textContent = state.message;
            el('face-ticket').href = 'ticket-detail.php?id=' + encodeURIComponent(id);
            el('face-transfer').href = 'ticket-transfer.php?ticketId=' + encodeURIComponent(id);
            el('face-ticket').hidden = !state.registered; el('face-remove').hidden = !state.registered;
            await startCamera(current);
        } catch (e) { if (version === current) error(e); }
        if (version === current) buttons();
    }
    el('face-consent').addEventListener('change', buttons);
    el('face-retry').addEventListener('click', load);
    el('face-save').addEventListener('click', async () => {
        if (busy || el('face-save').disabled) return;
        const current = version;
        busy = true; buttons(); el('face-error').hidden = true; el('face-duplicate').hidden = true;
        el('face-status').textContent = 'Capturing and checking your face…';
        try {
            const challenge = await window.tsFace.request('beginEnrollment', { ticketId: id });
            if (current !== version) return;
            if (!challenge.movements) throw Error('Refresh the page to start a guided registration.');
            const frames = await camera.frames((count, total, instruction) => {
                if (current === version) el('face-status').textContent = `Step ${count} of ${total}: ${instruction}`;
            }, challenge.movements);
            if (current !== version) return;
            camera.stop(); cameraReady = false;
            el('face-status').textContent = 'Saving your face registration…';
            await window.tsFace.request('enroll', { ticketId: id, challengeId: challenge.challengeId, frames, consent: el('face-consent').checked });
            if (current !== version) return;
            await load();
        } catch (e) {
            if (current === version) {
                error(e); el('face-status').textContent = 'Registration was not completed. Please try again.';
                if (e.code === 'face-already-linked') {
                    el('face-duplicate').hidden = false;
                    el('face-duplicate').scrollIntoView?.({block:'center', behavior:'smooth'});
                    el('face-retry').focus();
                }
            }
        } finally {
            if (current === version) {
                camera.stop(); cameraReady = false; busy = false; buttons();
                if (el('face-duplicate').hidden) await startCamera(current);
            }
        }
    });
    el('face-remove').addEventListener('click', async () => {
        if (busy || !confirm('Remove your stored face template? Entry will require a new registration.')) return;
        const current = version; busy = true; buttons();
        try { await window.tsFace.request('remove', { ticketId: id }); if (current === version) await load(); }
        catch (e) { if (current === version) error(e); }
        finally { if (current === version) { busy = false; buttons(); } }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { camera.stop(); cameraReady = false; buttons(); }
        else if (el('face-duplicate').hidden) startCamera();
    });
    window.addEventListener('pagehide', () => { version++; state = null; camera.stop(); cameraReady = false; });
    window.addEventListener('pageshow', event => { if (event.persisted) load(); });
    window.addEventListener('ts-auth-ready', load);
    if (window.tsCurrentUser?.uid) load();
})();
