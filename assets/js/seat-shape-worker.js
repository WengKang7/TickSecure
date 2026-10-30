/* global cv, tsSeatShapeDetection */
importScripts('../lib/opencv/opencv.js', 'seat-shape-detection.js');
let runtime = self.cv;
if (runtime instanceof Promise) runtime.then(value => { runtime = value; });
self.onmessage = async ({ data }) => {
    try {
        const started = Date.now();
        while (!runtime?.Mat) { if (Date.now() - started > 20000) throw new Error('The seat detector could not initialize. Refresh and retry.'); await new Promise(resolve => setTimeout(resolve, 25)); }
        const result = tsSeatShapeDetection.detect(runtime, { width: data.width, height: data.height, data: new Uint8ClampedArray(data.buffer) }, data.options);
        self.postMessage({ ok: true, result });
    } catch (error) { self.postMessage({ ok: false, error: error.message || 'Seat-shape detection failed.' }); }
};
