(function () {
    const el = id => document.getElementById(id), id = new URLSearchParams(location.search).get('ticketId') || '';
    const camera = window.tsFace.camera(el('face-video'));
    let state = null, busy = false, cameraReady = false, version = 0;
    function buttons() {
        el('face-start').disabled = busy || !state?.eligible || state?.registered;
        el('face-save').disabled = busy || !cameraReady || !el('face-consent').checked || !state?.eligible || state?.registered;
        el('face-remove').disabled = busy;
    }
    function error(e) { el('face-error').textContent = e.message || 'Face registration is unavailable.'; el('face-error').hidden = false; }
    async function load() {
        const current = ++version; state = null; cameraReady = false; camera.stop(); buttons();
        el('face-ticket').hidden = el('face-remove').hidden = true;
        if (!window.tsCurrentUser?.uid) return;
        try {
            const result = await window.tsFace.request('status', { ticketId: id });
            if (version !== current) return;
            state = result; el('face-status').textContent = state.message;
            el('face-ticket').href = 'ticket-detail.php?id=' + encodeURIComponent(id);
            el('face-ticket').hidden = !state.registered; el('face-remove').hidden = !state.registered;
        } catch (e) { if (version === current) error(e); }
        buttons();
    }
    el('face-start').addEventListener('click', async () => {
        busy = true; buttons(); el('face-error').hidden = true;
        try { await camera.start(); cameraReady = true; } catch (e) { cameraReady = false; error(e); }
        finally { busy = false; buttons(); }
    });
    el('face-stop').addEventListener('click', () => { camera.stop(); cameraReady = false; buttons(); });
    el('face-consent').addEventListener('change', buttons);
    el('face-save').addEventListener('click', async () => {
        if (busy || el('face-save').disabled) return;
        const current = version;
        busy = true; buttons(); el('face-error').hidden = true; el('face-status').textContent = 'Capturing and checking your face…';
        try {
            const frames = await camera.frames((count, total) => { el('face-status').textContent = `Capturing image ${count} of ${total}. Hold still…`; }); camera.stop(); cameraReady = false;
            if (current !== version) return;
            el('face-status').textContent = 'Checking image quality and securely saving your face registration…';
            await window.tsFace.request('enroll', { ticketId: id, frames, consent: el('face-consent').checked });
            if (current !== version) return;
            await load();
        } catch (e) { if (current === version) { error(e); el('face-status').textContent = 'Registration was not completed. Start the camera to try again.'; } }
        finally { camera.stop(); cameraReady = false; busy = false; buttons(); }
    });
    el('face-remove').addEventListener('click', async () => {
        if (busy || !confirm('Remove your stored face template? Entry will require a new registration.')) return;
        busy = true; buttons();
        try { await window.tsFace.request('remove', { ticketId: id }); await load(); } catch (e) { error(e); }
        finally { busy = false; buttons(); }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { cameraReady = false; buttons(); } });
    window.addEventListener('ts-auth-ready', load);
    if (window.tsCurrentUser?.uid) load();
})();
