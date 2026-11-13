/* Local estimated 3D landmarks guide capture. Only the server can approve entry. */
(function () {
    const base = new URL('../lib/mediapipe/', document.currentScript.src).href;
    let modelPromise;
    function valid(steps) {
        return Array.isArray(steps) && ['center,left,center,right,center', 'center,right,center,left,center'].includes(steps.join(','));
    }
    function pose(result) {
        if (result.faceLandmarks?.length !== 1 || result.facialTransformationMatrixes?.length !== 1) return null;
        const points = result.faceLandmarks[0];
        const [a, b] = [points[234], points[454]].sort((x, y) => x.x - y.x);
        if (b.x - a.x < .08) return null;
        const m = result.facialTransformationMatrixes[0].data;
        // Normalize either Matrix storage layout using its translation column.
        const columnMajor = Math.abs(m[14]) > Math.abs(m[11]);
        const value = {
            offset: (points[1].x - (a.x + b.x) / 2) / (b.x - a.x),
            yaw: Math.atan2(m[columnMajor ? 8 : 2], m[10]) * 180 / Math.PI,
            roll: Math.atan2(m[columnMajor ? 1 : 4], m[0]) * 180 / Math.PI
        };
        return Object.values(value).every(Number.isFinite) ? value : null;
    }
    function accepts(sample, step, baseline = 0) {
        if (!sample || Math.abs(sample.roll) > 20) return false;
        if (step === 'center') return Math.abs(sample.yaw) <= 12 && Math.abs(sample.offset) <= .12;
        const delta = sample.offset - baseline;
        return Math.abs(sample.yaw) >= 12 && Math.abs(sample.yaw) <= 40 && (step === 'left' ? delta >= .10 : delta <= -.10);
    }
    async function prepare() {
        if (!modelPromise) modelPromise = (async () => {
            const { FaceLandmarker, FilesetResolver } = await import(base + 'vision_bundle.mjs');
            return FaceLandmarker.createFromOptions(await FilesetResolver.forVisionTasks(base + 'wasm'), {
                baseOptions: { modelAssetPath: base + 'face_landmarker.task', delegate: 'CPU' },
                runningMode: 'IMAGE', numFaces: 2, minFaceDetectionConfidence: .7,
                minFacePresenceConfidence: .7, outputFacialTransformationMatrixes: true
            });
        })().catch(() => { modelPromise = null; throw Error('Face tracking could not load. Refresh the page and try again.'); });
        return modelPromise;
    }
    async function capture(video, steps, active, freshFrame, progress) {
        if (!valid(steps)) throw Error('Start a new guided scan. This request is outdated.');
        const detector = await prepare(), frames = [];
        const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
        const overlay = document.createElement('canvas'); overlay.className = 'ts-face-landmarks'; overlay.setAttribute('aria-hidden', 'true');
        video.parentElement.appendChild(overlay);
        const draw = overlay.getContext('2d');
        let baseline = 0;
        const check = () => { if (!active() || document.hidden) throw Error('Camera scan stopped. Start the camera again.'); };
        try {
            for (let index = 0; index < steps.length; index++) {
                const step = steps[index], start = performance.now();
                let heldSince = null;
                const instruction = step === 'center' ? 'Look straight ahead' : `Turn slightly to your ${step}`;
                while (true) {
                    check();
                    if (performance.now() - start > 12000) throw Error(`Step ${index + 1} timed out. ${instruction}, keep your head upright and try a new scan.`);
                    await freshFrame(); check();
                    const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
                    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const result = detector.detect(canvas), sample = pose(result), ready = accepts(sample, step, baseline);
                    overlay.width = canvas.width; overlay.height = canvas.height;
                    draw.clearRect(0, 0, overlay.width, overlay.height);
                    draw.fillStyle = ready ? '#078552' : '#ffffff';
                    for (const points of result.faceLandmarks || []) for (let n = 0; n < points.length; n += 5) {
                        draw.beginPath(); draw.arc(points[n].x * overlay.width, points[n].y * overlay.height, 1.5, 0, Math.PI * 2); draw.fill();
                    }
                    progress(index + 1, steps.length, `${instruction}. ${!sample ? 'Keep one whole face visible.' : ready ? 'Good — hold briefly…' : 'Keep your face in view and follow the direction.'}`);
                    if (ready) {
                        heldSince ??= performance.now();
                        if (performance.now() - heldSince >= 450) {
                            if (index === 0) baseline = sample.offset;
                            frames.push(canvas.toDataURL('image/jpeg', .9).split(',')[1]);
                            break;
                        }
                    } else heldSince = null;
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            return frames;
        } finally {
            canvas.width = canvas.height = overlay.width = overlay.height = 0;
            overlay.remove();
        }
    }
    window.tsFaceMovement = { prepare, capture, pose, accepts, valid };
})();
