(function () {
    const workerUrl = new URL('seat-shape-worker.js', document.currentScript.src).href;
    window.tsSeatShapes = { detect(image, options = {}) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(workerUrl);
            const finish = (error, result) => { clearTimeout(timer); worker.terminate(); error ? reject(new Error(error)) : resolve(result); };
            const timer = setTimeout(() => finish('Seat-shape detection timed out. Crop to one floor and retry.'), 45000);
            worker.onmessage = event => finish(event.data.ok ? null : event.data.error, event.data.result);
            worker.onerror = () => finish('The seat detector could not load. Refresh the page and retry.');
            const bytes = new Uint8ClampedArray(image.data);
            worker.postMessage({ width: image.width, height: image.height, buffer: bytes.buffer, options }, [bytes.buffer]);
        });
    } };
})();
