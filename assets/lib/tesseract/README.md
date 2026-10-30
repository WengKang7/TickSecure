Bundled OCR dependencies (unmodified third-party distributions)

- Tesseract.js 6.0.1: https://github.com/naptha/tesseract.js
- Tesseract.js-core 6.1.2: https://github.com/naptha/tesseract.js-core
- English 4.0.0_best_int model from @tesseract.js-data/eng 1.0.0:
  https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz
  https://github.com/tesseract-ocr/tessdata_best

Apache 2.0 licenses and bundled notices are included beside the distributions.
The four `core/*.wasm.js` builds embed their WebAssembly bytes. Tesseract chooses
the appropriate SIMD/LSTM variant; standalone `.wasm` duplicates are unnecessary.
All OCR assets and language data are served from the app, without an OCR API key.

Browser orchestration: ../../js/blueprint-ocr.js
Detection and geometry: ../../js/blueprint-detection.js
