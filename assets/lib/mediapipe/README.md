# Local face movement assets

- Browser library: Google's `@mediapipe/tasks-vision` **1.2.2**, from https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-1.2.2.tgz
- Library license: Apache-2.0, see `LICENSE` (upstream https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE).
- Face landmark model: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- Model SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`
- Official model/task documentation: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker

The browser loads these assets from the local website; Python uses this same model file. Images are not sent to Google. The existing authenticated local PHP service independently checks the captured images. Estimated landmarks are not measured depth, identity recognition or a certified anti-spoofing detector.

Keep the WASM files together: the library resolves its runtime variant at startup. No API key, paid service or blockchain operation is involved.
