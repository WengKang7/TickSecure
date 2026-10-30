Bundled OpenCV.js 4.13.0 (unmodified official distribution)

- Build: https://docs.opencv.org/4.13.0/opencv.js
- Project: https://github.com/opencv/opencv/tree/4.13.0
- License: Apache 2.0, copied in LICENSE.

The distribution embeds its WebAssembly bytes. It is loaded only by the local
seat-shape worker, with no remote detection endpoint or Python dependency.
Browser orchestration: ../../js/seat-shapes.js and ../../js/seat-shape-worker.js
Detection: ../../js/seat-shape-detection.js
This Emscripten build exports a legacy thenable; wait for Mat/runtime readiness
without awaiting the module itself.
