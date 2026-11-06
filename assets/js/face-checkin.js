(function () {
    const el = id => document.getElementById(id), video = el('checkin-video'), camera = window.tsFace.camera(video);
    let challenge = null, busy = false, faceReady = false, scanVersion = 0, session = 0;
    const authorized = () => ['organizer', 'admin'].includes(window.tsCurrentUser?.role) && window.tsCurrentUser.status === 'active';
    function buttons() {
        el('checkin-qr').disabled = el('verify-btn').disabled = busy || !authorized() || !!challenge;
        el('checkin-face').hidden = el('checkin-supervision').hidden = !challenge;
        el('checkin-face').disabled = busy;
        el('checkin-present').disabled = busy;
        el('checkin-reset').disabled = busy;
        el('checkin-hint').hidden = !challenge;
        el('checkin-hint').textContent = busy ? 'Please wait while the camera or verification finishes.'
            : !faceReady ? 'Step 1: Click Start face camera.'
            : !el('checkin-present').checked ? 'Step 2: Confirm consent above. This starts face verification and checks in the attendee if matched.'
            : 'Face verification starts automatically. Hold still and look at the camera.';
    }
    function error(e) { el('checkin-error').textContent = e.message || 'Check-in could not complete.'; el('checkin-error').hidden = false; }
    function reveal(id) {
        el(id).scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        el(id).focus?.({ preventScroll: true });
    }
    function reset() {
        session++;
        scanVersion++; camera.stop(); challenge = null; faceReady = false; el('checkin-present').checked = false;
        el('qr-input').value = ''; el('checkin-error').hidden = el('checkin-success').hidden = true;
        el('checkin-step').textContent = '1. Scan ticket QR';
        el('checkin-status').textContent = authorized() ? 'Ready to scan the next attendee’s QR.' : 'Sign in as the event organizer or an administrator.';
        buttons();
    }
    async function begin(qr) {
        if (busy || !authorized() || challenge) return;
        const current = session;
        busy = true; scanVersion++; camera.stop(); buttons(); el('checkin-error').hidden = el('checkin-success').hidden = true;
        try {
            const result = await window.tsFace.request('beginCheckIn', { qr });
            if (current !== session) return;
            challenge = result;
            el('checkin-present').checked = false;
            el('checkin-step').textContent = '2. Verify attendee face';
            el('checkin-status').textContent = `${challenge.eventName} · Seat ${challenge.seat}. QR accepted. Complete the face check within 90 seconds.`;
        } catch (e) { if (current === session) error(e); }
        finally { busy = false; buttons(); }
    }
    el('verify-btn').addEventListener('click', () => begin(el('qr-input').value.trim()));
    el('checkin-qr').addEventListener('click', async () => {
        if (busy || challenge || !authorized()) return;
        el('checkin-error').hidden = true;
        const current = ++scanVersion;
        try {
            await camera.start('environment');
            el('checkin-status').textContent = 'Hold the ticket QR inside the camera view.';
            const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { willReadFrequently: true });
            const scan = () => {
                if (current !== scanVersion || document.hidden || challenge || !authorized()) return;
                if (video.readyState >= 2) {
                    const scale = Math.min(1, 800 / video.videoWidth);
                    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
                    const code = window.jsQR(frame.data, frame.width, frame.height);
                    if (code) { begin(code.data); return; }
                }
                setTimeout(scan, 200);
            };
            scan();
        } catch (e) { camera.stop(); error(e); }
    });
    el('checkin-face').addEventListener('click', async () => {
        if (busy || !challenge || !authorized()) return;
        const current = session;
        busy = true; faceReady = false; buttons(); el('checkin-error').hidden = true;
        try {
            await camera.start('user');
            if (current !== session) return;
            faceReady = true;
            el('checkin-status').textContent = 'Camera ready. Look straight ahead with your whole face visible and evenly lit. Confirm consent to start automatic face verification and check-in.';
        } catch (e) { error(e); reveal('checkin-error'); }
        finally { busy = false; buttons(); }
        if (current === session) await verifyFace();
    });
    el('checkin-present').addEventListener('change', async () => { buttons(); await verifyFace(); });
    async function verifyFace() {
        if (busy || !faceReady || !el('checkin-present').checked || !authorized() || !challenge || document.hidden) return;
        const current = session, challengeId = challenge.challengeId;
        busy = true; buttons(); el('checkin-error').hidden = el('checkin-success').hidden = true;
        el('checkin-status').textContent = 'Scanning three camera images and comparing your face. Please wait…';
        try {
            const frames = await camera.frames((count, total) => { el('checkin-status').textContent = `Capturing image ${count} of ${total}. Hold still…`; }); camera.stop(); faceReady = false;
            if (current !== session) return;
            el('checkin-status').textContent = 'Checking image quality and matching the registered ticket owner…';
            const result = await window.tsFace.request('completeCheckIn', { challengeId, frames });
            if (current !== session) return;
            if (result?.valid !== true) throw Error(result?.reason || 'The server could not confirm a face match. Scan the ticket and try again.');
            if (result.testOnly === true) throw Error('The server returned a preview result. Check-in was not confirmed.');
            el('checkin-success-message').textContent = 'QR accepted. Face matched the registered owner. Entry allowed; this ticket is now used and cannot admit another attendee.';
            for (const [field, value] of Object.entries({
                event: result.eventName, attendee: result.attendeeName, category: result.categoryName,
                section: result.section, seat: result.seat, ticket: result.ticketId
            })) el('checkin-result-' + field).textContent = value || 'Not available';
            const usedAt = new Date(result.usedAt);
            el('checkin-result-time').textContent = Number.isNaN(usedAt.getTime()) ? 'Not available' :
                new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Kuala_Lumpur' }).format(usedAt) + ' MYT';
            el('checkin-result-status').textContent = 'Checked in · Used';
            el('checkin-success').hidden = false;
            el('checkin-step').textContent = 'Entry allowed'; el('checkin-status').textContent = 'Verification complete. Select Next attendee to continue.';
            reveal('checkin-success');
        } catch (e) { if (current === session) {
            error(new Error('Verification failed. ' + (e.message || 'Unable to verify your face.')));
            el('checkin-step').textContent = 'Verification failed';
            el('checkin-status').textContent = 'Check-in was not confirmed. Scan the ticket again to check its status before retrying.';
            reveal('checkin-error');
        } }
        finally {
            challenge = null; camera.stop(); faceReady = false; busy = false;
            el('checkin-present').checked = false; buttons();
        }
    }
    el('checkin-reset').addEventListener('click', reset);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { scanVersion++; faceReady = false; buttons(); } });
    window.addEventListener('ts-auth-ready', reset); reset();
})();
