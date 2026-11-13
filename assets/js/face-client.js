// Identity checks are made by the authenticated backend, never by browser flags.
(function () {
    const endpoint = new URL('../../api/face.php', document.currentScript.src).href;
    function deadline(work, milliseconds, message, cancel = () => {}) {
        let timer;
        return Promise.race([work, new Promise((_, reject) => {
            timer = setTimeout(() => { reject(Error(message)); cancel(); }, milliseconds);
        })]).finally(() => clearTimeout(timer));
    }
    async function request(action, data = {}) {
        const user = window.tsFirebase?.auth?.currentUser;
        if (!user) throw Error('Sign in before using face verification.');
        const controller = new AbortController();
        return deadline((async () => {
            const token = await user.getIdToken();
            if (controller.signal.aborted) throw Error('Face verification timed out.');
            const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', signal: controller.signal,
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ ...data, action }) });
            const result = await response.json();
            if (window.tsFirebase?.auth?.currentUser?.uid !== user.uid) throw Error('Your sign-in changed. Reload this page.');
            if (!response.ok || result.error) throw Error(result.error?.message || 'Face verification is unavailable.');
            return result.data;
        })(), 45000, 'The server took too long to respond. Check the ticket status before retrying; do not assume check-in succeeded.', () => controller.abort());
    }
    function camera(video) {
        let stream = null, generation = 0;
        function stop() { generation++; stream?.getTracks().forEach(track => track.stop()); stream = null; video.srcObject = null; }
        function freshFrame() {
            return new Promise((resolve, reject) => {
                let callback, poll, timer;
                const initialTime = video.currentTime;
                function finish(error) {
                    clearTimeout(timer); clearTimeout(poll);
                    if (callback !== undefined) video.cancelVideoFrameCallback?.(callback);
                    error ? reject(error) : resolve();
                }
                timer = setTimeout(() => finish(Error('The camera image is frozen. Restart the camera and try again.')), 2500);
                if (video.requestVideoFrameCallback) callback = video.requestVideoFrameCallback(() => finish());
                else {
                    const check = () => {
                        if (video.readyState >= 2 && video.currentTime !== initialTime) finish();
                        else poll = setTimeout(check, 40);
                    };
                    check();
                }
            });
        }
        async function start(facingMode = 'user') {
            stop(); const current = generation;
            if (!navigator.mediaDevices?.getUserMedia) throw Error('Camera access requires localhost or HTTPS and a supported browser.');
            const capture = await navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
            if (current !== generation) { capture.getTracks().forEach(track => track.stop()); throw Error('Camera was closed.'); }
            stream = capture; video.srcObject = stream;
            try {
                await deadline(video.play(), 5000, 'The camera could not start. Close other camera apps and try again.');
                await freshFrame();
                // Let auto-exposure settle before enabling capture.
                await new Promise(resolve => setTimeout(resolve, 350));
                if (window.tsFaceMovement && facingMode === 'user') await deadline(window.tsFaceMovement.prepare(), 20000, 'Face tracking took too long to load. Restart the camera.');
                if (current !== generation) throw Error('Camera was closed.');
            } catch (error) { if (current === generation) stop(); throw error; }
        }
        async function frames(onProgress = () => {}, movements = null) {
            const current = generation;
            if (movements !== null) {
                if (!window.tsFaceMovement) throw Error('Refresh the page to load guided face scanning.');
                return window.tsFaceMovement.capture(video, movements,
                    () => !!stream && current === generation && video.readyState >= 2,
                    freshFrame, onProgress);
            }
            const frames = [];
            const canvas = document.createElement('canvas');
            try { for (let i = 0; i < 3; i++) {
                if (i > 0) await new Promise(resolve => setTimeout(resolve, 250));
                await freshFrame();
                if (!stream || current !== generation || video.readyState < 2 || Math.min(video.videoWidth, video.videoHeight) < 160) throw Error('Start the camera and wait for a clear image.');
                const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
                canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
                canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
                onProgress(i + 1, 3);
            } return frames; }
            finally { canvas.width = canvas.height = 0; }
        }
        window.addEventListener('pagehide', stop);
        window.addEventListener('ts-auth-ready', stop);
        document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
        return { start, stop, frames };
    }
    window.tsFace = { request, camera };
})();
