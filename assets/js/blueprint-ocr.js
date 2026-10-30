// OCR stays in the administrator's browser. Assets are hosted with this app.
(function () {
    'use strict';
    const assets = new URL('../lib/tesseract/', document.currentScript.src).href;
    const detection = window.tsBlueprintDetection;
    const canvasFor = (width, height) => {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas;
    };
    async function scan(file, onStatus = () => {}, options = {}) {
        if (!window.Tesseract || !detection) throw new Error('The OCR engine could not be loaded. Refresh the page and retry.');
        let worker, pdf, bitmap, timedOut = false, timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => { timedOut = true; if (worker) worker.terminate().catch(() => {}); reject(new Error('OCR timed out. Crop the blueprint to one floor or use a clearer image, then retry.')); }, 120000);
        });
        const work = async () => {
            onStatus('Opening blueprint for OCR...');
            let pages = 1;
            if (file.type === 'application/pdf') {
                const lib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
                if (!lib) throw new Error('The PDF reader could not be loaded. Refresh the page and retry.');
                lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
                pages = pdf.numPages;
                if (pages > 10) throw new Error('Upload at most 10 blueprint pages at a time. Split this PDF into smaller files.');
            } else {
                const header = new DataView(await file.slice(0, 24).arrayBuffer());
                if (header.byteLength < 24 || header.getUint32(0) !== 0x89504e47) throw new Error('This is not a valid PNG image.');
                const width = header.getUint32(16), height = header.getUint32(20);
                if (!width || !height || width * height > 24000000) throw new Error('Use a PNG with no more than 24 million pixels for OCR.');
                bitmap = await createImageBitmap(file);
            }
            if (timedOut) { bitmap?.close(); if (pdf) await pdf.destroy(); return; }
            onStatus('Loading local OCR engine...');
            worker = await window.Tesseract.createWorker('eng', 1, { workerPath: assets + 'worker.min.js', corePath: assets + 'core',
                langPath: assets + 'lang', workerBlobURL: false,
                logger: message => { if (!timedOut && message.status === 'loading language traineddata') onStatus('Loading OCR language data...'); } });
            if (timedOut) { await worker.terminate(); return; }
            const sections = [], summaries = [];
            for (let page = 1; page <= pages; page++) {
                if (timedOut) return;
                let base;
                if (pdf) {
                    const source = await pdf.getPage(page), original = source.getViewport({ scale: 1 });
                    const viewport = source.getViewport({ scale: Math.min(3, 2200 / Math.max(original.width, original.height), Math.sqrt(4000000 / (original.width * original.height))) });
                    base = canvasFor(Math.floor(viewport.width), Math.floor(viewport.height));
                    await source.render({ canvasContext: base.getContext('2d'), viewport }).promise;
                } else {
                    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height), Math.sqrt(4000000 / (bitmap.width * bitmap.height)));
                    base = canvasFor(Math.floor(bitmap.width * scale), Math.floor(bitmap.height * scale));
                    const ctx = base.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, base.width, base.height); ctx.drawImage(bitmap, 0, 0, base.width, base.height);
                }
                const pixels = base.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, base.width, base.height);
                onStatus(`Detecting seat shapes on page ${page}/${pages}...`);
                const shapePromise = window.tsSeatShapes ? window.tsSeatShapes.detect(pixels, options) : Promise.resolve({ seats: [] });
                // Observe an early worker rejection while OCR is still running.
                const shapeResult = shapePromise.then(result => ({ result }), error => ({ error }));
                const segmentation = detection.regions(pixels);
                const scale = Math.min(3, 2400 / Math.max(base.width, base.height));
                const enlarged = canvasFor(Math.round(base.width * scale), Math.round(base.height * scale));
                enlarged.getContext('2d').drawImage(base, 0, 0, enlarged.width, enlarged.height);
                onStatus(`OCR: reading page ${page} of ${pages}...`);
                await worker.setParameters({ tessedit_pageseg_mode: '11' });
                const full = await worker.recognize(enlarged, {}, { tsv: true });
                const words = detection.parseTsv(full.data.tsv).map(w => ({ ...w, line: 'full-' + w.line,
                    x0: w.x0 / scale, x1: w.x1 / scale, y0: w.y0 / scale, y1: w.y1 / scale }));
                const shapeOutcome = await shapeResult;
                if (shapeOutcome.error) throw shapeOutcome.error;
                const shapeAreas = (shapeOutcome.result.seats || []).map(seat => seat.w * seat.h).sort((a,b) => a-b);
                const seatPlan = options.mode !== 'sections' && shapeAreas.length >= 12 && shapeAreas[Math.floor(shapeAreas.length / 2)] / (base.width * base.height) <= .0015;
                // Chair numbering uses shapes, so do not OCR hundreds of icons.
                // A full-page stage label is enough; otherwise inspect large regions.
                const cropRegions = seatPlan && words.some(word => /^STAGE$/i.test(word.text.trim())) ? []
                    : seatPlan ? segmentation.items.filter(region => region.area > (shapeAreas[Math.floor(shapeAreas.length / 2)] || 1) * 9).slice(0, 30)
                    : segmentation.items.slice(0, 220);
                const crops = cropRegions.map(region => ({ region, crop: detection.regionCrop(pixels, region, segmentation) })).filter(item => item.crop);
                await worker.setParameters({ tessedit_pageseg_mode: '6' });
                for (let i = 0; i < crops.length; i++) {
                    if (timedOut) return;
                    onStatus(`OCR: page ${page}/${pages}, reading region ${i + 1}/${crops.length}...`);
                    const { region, crop } = crops[i], patch = canvasFor(crop.width, crop.height);
                    patch.getContext('2d').putImageData(new ImageData(crop.data, crop.width, crop.height), 0, 0);
                    let result = await worker.recognize(patch, {}, { tsv: true }), cropScale = crop.scale;
                    let cropWords = detection.parseTsv(result.data.tsv);
                    if (crop.width > 500 && !cropWords.some(word => word.confidence >= 25)) {
                        const factor = 2 / 3, smaller = canvasFor(Math.round(crop.width * factor), Math.round(crop.height * factor));
                        smaller.getContext('2d').drawImage(patch, 0, 0, smaller.width, smaller.height);
                        result = await worker.recognize(smaller, {}, { tsv: true });
                        cropWords = detection.parseTsv(result.data.tsv); cropScale *= factor;
                    }
                    words.push(...cropWords.map(w => ({ ...w, line: region.id + '-' + w.line, regionId: region.id,
                        x0: w.x0 / cropScale + crop.x, x1: w.x1 / cropScale + crop.x, y0: w.y0 / cropScale + crop.y, y1: w.y1 / cropScale + crop.y })));
                }
                const ocr = detection.detect(pixels, words, page, segmentation);
                const detected = window.tsSeatImport ? window.tsSeatImport.combine(pixels, shapeOutcome.result, words, ocr, options, page) : ocr;
                detected.sections.forEach(section => { if (pages > 1) section.sectionId = `P${page}_${section.sectionId}`; });
                sections.push(...detected.sections);
                summaries.push({ page, width: base.width, height: base.height, sections: detected.sections.length, mode: detected.importMode || 'sections', shapes: detected.shapeCount || 0 });
            }
            window.tsSeatLayout?.autoNumber(sections);
            if (!sections.length) throw new Error('OCR could not identify any section or seat labels. Upload a clearer image or add sections manually on the review page.');
            if (sections.reduce((sum, section) => sum + (section.geometry.seatMarkers?.length || 0), 0) > 3000) {
                throw new Error('More than 3,000 labelled seats were found. Split this blueprint into smaller floor layouts and retry.');
            }
            const sourceHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
            return { sections, analysis: { engine: 'tesseract.js-6.0.1+opencv.js-4.13.0', status: 'NEEDS_REVIEW', scannedAt: new Date().toISOString(), sourceHash,
                sourceName: file.name, sourceSize: file.size, pages: summaries, sectionCount: sections.length,
                message: 'Seats are numbered automatically left to right, row by row from the stage, starting at 1. Review the layout before activation; section-only capacities must be entered manually.' } };
        };
        try { return await Promise.race([work(), timeout]); }
        finally { timedOut = true; clearTimeout(timer); if (worker) await worker.terminate().catch(() => {}); bitmap?.close(); if (pdf) await pdf.destroy().catch(() => {}); }
    }
    window.tsBlueprintOCR = { scan };
})();
