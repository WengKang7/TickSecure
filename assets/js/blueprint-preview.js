(function () {
    window.tsBlueprintPreview = { async create(file) {
        const urls = {}, sizes = {};
        if (file.type === 'image/png') {
            const header = new DataView(await file.slice(0, 24).arrayBuffer());
            urls[1] = URL.createObjectURL(file); sizes[1] = { imageWidth: header.getUint32(16), imageHeight: header.getUint32(20) };
        } else {
            const lib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
            if (!lib) throw new Error('The PDF preview could not load.');
            lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
            try {
                for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
                    const page = await pdf.getPage(i), original = page.getViewport({ scale: 1 });
                    const viewport = page.getViewport({ scale: Math.min(2, 1400 / Math.max(original.width, original.height)) });
                    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
                    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                    if (!blob) throw new Error('The PDF page could not be previewed.');
                    urls[i] = URL.createObjectURL(blob); sizes[i] = { imageWidth: canvas.width, imageHeight: canvas.height };
                }
            } catch (error) { Object.values(urls).forEach(url => URL.revokeObjectURL(url)); throw error; }
            finally { await pdf.destroy(); }
        }
        return { urls, sizes, dispose: () => Object.values(urls).forEach(url => URL.revokeObjectURL(url)) };
    } };
})();
