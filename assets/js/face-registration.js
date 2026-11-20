(function () {
    const el = id => document.getElementById(id), id = new URLSearchParams(location.search).get('ticketId') || '';
    const camera = window.tsFace.camera(el('face-video'));
    let state = null, busy = false, starting = false, cameraReady = false, version = 0, retryAfter = 0;
    const pendingKey = () => `ts-face-pending:${window.tsCurrentUser?.uid || ''}:${id}`;
    function pending(until) {
        retryAfter = until;
        try { if(until)window.sessionStorage?.setItem(pendingKey(),String(until));else window.sessionStorage?.removeItem(pendingKey()); } catch (_) {}
    }
    function loading(active) {
        el('face-loading').hidden = !active;
        el('face-status').setAttribute('aria-busy', String(active));
    }
    function status(message, active = false) {
        el('face-progress').textContent = message || '';
        loading(active);
    }
    function buttons() {
        el('face-save').disabled = Date.now() < retryAfter || busy || starting || !cameraReady || !el('face-consent').checked || !state?.eligible || state?.registered;
        el('face-save').hidden = !!state?.registered;
        el('face-remove').disabled = busy;
        el('face-recheck').hidden = !retryAfter || !!state?.registered;
        el('face-recheck').disabled = busy || starting;
        el('face-retry').disabled = busy || starting;
    }
    function error(e) { loading(false); el('face-error').textContent = e.message || 'Face registration is unavailable.'; el('face-error').hidden = false; }
    async function startCamera(current = version) {
        if (Date.now() < retryAfter || current !== version || busy || starting || cameraReady || document.hidden || !state?.eligible || state.registered) return;
        starting = true; buttons(); status('Starting camera. Allow camera access if your browser asks.', true);
        try {
            await camera.start(); if (current !== version) return;
            cameraReady = true; status('Look straight at the camera. Agree below, then select Register my face.');
        } catch (e) {
            if (current === version) { cameraReady = false; error(e); status('Allow camera access in your browser, then reload this page to try again.'); }
        } finally { if (current === version) { starting = false; buttons(); } }
    }
    let pendingOwnerKey = '';
    async function load() {
        if (pendingOwnerKey !== pendingKey()) { retryAfter = 0; pendingOwnerKey = pendingKey(); }
        try { retryAfter = Number(window.sessionStorage?.getItem(pendingKey()) || retryAfter || 0); } catch (_) {}
        const current = ++version; state = null; busy = starting = cameraReady = false; camera.stop(); buttons();
        el('face-ticket').hidden = el('face-remove').hidden = true;
        el('face-duplicate').hidden = true; el('face-error').hidden = true;
        if (!window.tsCurrentUser?.uid) { status('Sign in to register your face.'); return; }
        status('Checking your ticket and registration status…', true);
        try {
            const result = await window.tsFace.request('status', { ticketId: id });
            if (version !== current) return;
            state = result;
            if (state.registered || retryAfter && Date.now() >= retryAfter) pending(0);
            status(Date.now() < retryAfter ? 'The previous registration result is not confirmed yet. Use Check registration status before starting another scan.' : state.message);
            el('face-ticket').href = 'ticket-detail.php?id=' + encodeURIComponent(id);
            el('face-transfer').href = 'ticket-transfer.php?ticketId=' + encodeURIComponent(id);
            el('face-ticket').hidden = !state.registered; el('face-remove').hidden = !state.registered;
            await startCamera(current);
        } catch (e) { if (version === current) { error(e); status('Could not check registration status. Please refresh to try again.'); } }
        if (version === current) buttons();
    }
    el('face-consent').addEventListener('change', buttons);
    el('face-retry').addEventListener('click', load);
    el('face-recheck').addEventListener('click', load);
    el('face-save').addEventListener('click', async () => {
        if (busy || el('face-save').disabled) return;
        const current = version;
        busy = true; buttons(); el('face-error').hidden = true; el('face-duplicate').hidden = true;
        status('Capturing and checking your face…', true);
        try {
            const challenge = await window.tsFace.request('beginEnrollment', { ticketId: id });
            if (current !== version) return;
            if (!challenge.movements) throw Error('Refresh the page to start a guided registration.');
            const frames = await camera.frames((count, total, instruction) => {
                if (current === version) status(`Step ${count} of ${total}: ${instruction}`, true);
            }, challenge.movements);
            if (current !== version) return;
            camera.stop(); cameraReady = false;
            status('Checking and saving your face registration. Please keep this page open.', true);
            pending(Date.now() + Math.max(240, challenge.expiresIn || 0) * 1000);
            await window.tsFace.request('enroll', { ticketId: id, challengeId: challenge.challengeId, frames, consent: el('face-consent').checked });
            if (current !== version) return;
            pending(0); await load();
        } catch (e) {
            if (current === version) {
                if (!e.uncertain) pending(0);
                error(e); status(e.uncertain ? 'Registration has not been confirmed. Select Check registration status; do not start another scan yet.' : 'Registration was not completed. Please try again.');
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
        const current = version; busy = true; buttons(); status('Removing your face registration…', true);
        try { await window.tsFace.request('remove', { ticketId: id }); if (current === version) await load(); }
        catch (e) { if (current === version) error(e); }
        finally { if (current === version) { busy = false; buttons(); } }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { camera.stop(); cameraReady = false; buttons(); }
        else if (el('face-duplicate').hidden) startCamera();
    });
    window.addEventListener('pagehide', () => { version++; state = null; camera.stop(); cameraReady = false; loading(false); });
    window.addEventListener('pageshow', event => { if (event.persisted) load(); });
    window.addEventListener('ts-auth-ready', load);
    if (window.tsCurrentUser?.uid) load();
})();
