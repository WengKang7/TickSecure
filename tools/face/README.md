# Local FYP face registration and entrance verification

This feature is a supervised demonstration, not production identity proofing or certified presentation-attack detection. YuNet detects faces; SFace produces 128-value descriptors. Neither proves that a capture is live. Staff must supervise the camera. Do not describe this demo as photo-proof or as legal identity verification.

## Buyer flow

1. Complete simulated checkout and confirm every NFT operation in MetaMask.
2. Open **My Tickets → a ticket → Register my face**.
3. Read the consent text, enable the camera and follow five guided head movements using your own face.
4. Open the ticket with your normal login. No repeated face scan is needed to view its QR.
5. Use your own face for every ticket you own. Transfer a ticket before a different attendee registers it.

Registration is per ticket and current ownership. Existing tickets also require registration. Collections remain artwork previews; they are not entry credentials. Used tickets can be viewed as receipts but have no entry QR.

Transfer/resale immediately deletes that ticket's previous encrypted template in the same ownership transaction, in both PHP and Functions implementations. New registration waits for confirmed current-wallet NFT ownership and all ticket blockchain operations. A saved QR cannot be reused after ownership or registration changes.

## Check-in

Open **Attendees → Check in attendees** or `/ticksecure-ui/verification/face-machine.php` as the event organizer/admin. `/ticksecure-ui/verification/scanner.php` uses the same real entrance flow. Both pages perform actual check-in; there is no Test my face button or preview mode in the UI.

Scan a buyer's registered ticket QR using the camera, or paste its decoded text. QR validation creates a single-use request lasting 90 seconds, including a server-chosen movement order; it does not admit the attendee. Start the face camera and confirm the attendee's physical presence/consent. Once the camera is ready and consent is checked, five guided frames are captured and verified automatically (forward, a random left/right turn, forward, the opposite turn, forward). A positive server result marks the ticket used and removes its face registration. The screen displays success or failure, stops the camera, and waits for **Next attendee / reset**. It never continuously retries. A mismatch requires rescanning and leaves the ticket unused. This flow consumes real demo tickets on success.


The server independently extracts and matches the images. It never accepts a browser `match=true` flag or feature vectors. The final Firestore transaction rechecks the operator, event, current owner, confirmed NFT, enrollment version and unused status, then marks the ticket USED. A concurrent scanner cannot consume the same ticket twice. A failed face match consumes its request but leaves the ticket unused; scan again to retry. An uncertain network result must be checked by rescanning, not by assuming success.

Successful check-in returns a receipt with the event, current owner's name, ticket category, section, seat, ticket reference, USED status and committed check-in timestamp. The page displays the timestamp in Malaysia time (UTC+8). The name comes from the current owner's profile, including after transfers; biometric templates and match scores are never included.

The old `scanTicket` action now refuses QR-only admission. **If an older Cloud Function is deployed, redeploy that change before relying on face verification.** The new face inference endpoint is intentionally local-only; it is not deployed to Firebase.

## Local setup

Python with `opencv-python`, `numpy`, and `mediapipe` is required. The movement upgrade was checked with MediaPipe Python 1.0.1; run `python -m pip install mediapipe==1.0.1` in the configured Python environment if missing. This workspace was validated with Python 3.12 / OpenCV 5.0.0. OpenCV's published face-recognition API is also available in recent 4.x versions; verify model compatibility before changing versions.

Run the one-time CLI setup with the full Python path:

```powershell
C:/xampp/php/php.exe tools/face/setup.php C:/path/to/python.exe
```

It creates a random 32-byte `ticksecure-face-template.key` beside the existing Firebase service-account file, outside `htdocs`, and writes an ignored `api/face-config.local.php` containing paths only. It never overwrites an existing key. Restrict that private directory to the server/user account. Back up this key privately; losing it makes existing templates unreadable. Never put it in the website, Git, logs or mobile app. No paid face API, extra blockchain transaction, or SepoliaETH is used by enrollment/check-in. Normal Firebase usage quotas still apply.

The models are vendored locally and loaded without network access at inference time:

| File | Source | SHA-256 |
|---|---|---|
| `models/yunet.onnx` | [OpenCV YuNet 2023mar](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) | `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4` |
| `models/sface.onnx` | [OpenCV SFace 2021dec](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface) | `0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79` |

Model licenses are included beside the files. QR scanning uses vendored jsQR 1.4.0 (Apache-2.0). The 0.5 cosine threshold is a conservative demo starting point, not a calibrated error-rate guarantee. The [OpenCV tutorial](https://docs.opencv.org/4.x/d0/dd4/tutorial_dnn_face.html) reports different thresholds across benchmark datasets. Test with consenting volunteers and the actual entrance camera/lighting before your presentation. Do not lower the threshold merely to force a match.

## Guided movement upgrade (10 November 2026)

The buyer registration page and both staff web scanner pages now load a local MediaPipe Face Landmarker. The preview shows estimated face landmarks; green dots indicate an acceptable angle. Each step requires about 450ms of stable pose before automatic capture. Missing/multiple faces, wrong direction, excessive tilt or a 12-second step timeout stop capture. Total server challenge lifetime remains 90 seconds. Refresh open pages after deployment.

The five-step sequence is center → randomly left/right → center → opposite side → center. Left/right means the attendee's own left/right. Turn gently (roughly 20 degrees), keep eyes and face visible, and return fully forward when prompted. The browser preview is unmirrored. Android 1.1.0 uses three-second countdown prompts for each pose instead of a local landmark overlay; staff should read directions to the attendee. Install the updated APK: the earlier three-frame app fails closed against this backend.

The trusted server measures estimated 3D pose using the actual five JPEGs and the stored challenge order; a client `passed` flag, changed order or client-supplied landmarks cannot bypass it. All five SFace descriptors must be mutually consistent. Three frontal descriptors are stored/compared using the existing encrypted template format and unchanged 0.5 identity threshold. Existing registrations do not need deleting or re-enrolling. Registration now also requires a single-use challenge bound to the buyer, ticket and ownership revision. Failed movement checks leave tickets unused, and consume the attempt.

This is a movement challenge, not certified liveness or measured-depth 3D face recognition. Sophisticated replay/synthetic-image attacks are still possible. Supervised staff remain necessary. Thresholds are conservative demo starting points, not a measured accuracy guarantee. Test with consenting participants and your actual lighting/cameras. These extra movements intentionally add capture time; no speed or recognition-accuracy improvement has been measured for this upgrade.

No movement landmarks, camera frames or face scores are saved or returned to the client. Only encrypted identity descriptors and challenge metadata remain. All inference is local; no paid API or SepoliaETH is used.

Smoke checks:

```powershell
'{"action":"health"}' | python tools/face/recognize.py
python tests/face-movement.test.py
node --test tests/face-movement.test.cjs
```

## Capture quality and speed

Both buyer enrollment and staff verification share the same capture helper. It requests 960×720 when the camera supports it, waits for a decoded frame and a short exposure settling period, and sends five JPEGs bounded to a 960px longest edge. Guided browser captures wait for the requested stable pose and a new video frame. The previous three-frame capture helper remains available internally, but the enrollment and admission endpoints require the five-step sequence. A frozen camera fails instead of silently capturing a stale preview. The page reports capture progress and then server processing. A 45-second request deadline gives a visible error; it never automatically retries a check-in. A timed-out server operation may still finish, so check ticket status before retrying.

YuNet detection uses a maximum 640px longest edge, with a full-resolution retry when no face is found. Boxes and all five landmarks are mapped back to the original pixels for SFace alignment. Recognition still uses the original image; the model identifier, encrypted template format, 0.5 identity threshold remain unchanged; consistency is now checked across all five guided frames. Existing registrations are not deleted or migrated.

Quality checks now reject clipped faces and give specific guidance for no face, multiple faces, small faces, darkness, excessive brightness and blur. Sharpness is checked on a bounded-size face crop for more consistent behavior across camera resolutions. These are quality gates, not liveness detection.

Historical identity-only smoke measurement, before the movement upgrade (6 timed three-image runs per pipeline, median, models already loaded): a 960×960 version of OpenCV's public `samples/data/lena.jpg` took **212.3ms** with full-resolution detection and **139.5ms** with bounded detection. The cross-pipeline cosine score was **0.9279**; mild brightness/blur variants scored **0.9172–0.9407** against the full-resolution descriptor. This is one synthetic variation test, not a population accuracy study or end-to-end browser/Firebase timing. Lower-resolution cameras and network latency will have different results. Rehearse with consenting participants and the actual cameras before claiming an accuracy improvement.

## Storage and privacy

- `TicketFaces/{ticketId}`: AES-256-GCM encrypted vectors, authenticated against ticket ID, ownership revision and enrollment version; model and consent version. No original face image is stored.
- `FaceChallenges/{randomId}`: actor UID, ticket ID, enrollment/check-in purpose, randomized movement order, ownership/enrollment version, expiry and consumed flag. No facial template. Failed/expired challenges are unusable even if retained; periodically remove these metadata records for a long-running deployment.
- `FaceRateLimits/{hashedUid}`: bounded per-account minute counter (12 expensive requests/minute).
- `NFTTickets`: a face-registration status projection only; never vectors/images.
- `AuditLogs`: successful entry reference and actor/time; never face images or vectors.

These private collections have no browser read/write access. The existing rules' default deny also protects unknown collections; deploy the updated rules with the rest of your Firestore policy when releasing. Authorized staff only receive safe ticket information and verification outcomes from the API. Templates are erased after transfer/resale, successful admission, or the owner's **Remove my face registration** action. Database backups, if separately enabled, have their own retention policy.

## API for your separate mobile app

A native Android USB demo is now available in `mobile/checkin`, with the installable APK at `downloads/ticksecure-entry-demo.apk`. Follow `mobile/checkin/README.md` to connect the phone to the PC and install it. It uses existing organizer/admin sign-in, QR scanning, guided movement checks, face comparison and real check-in against this same backend. A physical phone rehearsal is still required. All calls are JSON POST to `/ticksecure-ui/api/face.php` with `Authorization: Bearer <Firebase ID token>`. Do not put service-account credentials, template keys or stored descriptors in the app.

| Action | Request fields | Response |
|---|---|---|
| `session` | none | Active staff only: `uid`, `role`, `name` |
| `status` | `ticketId` | Owner only: `registered`, `eligible`, `qr` (only when entry eligible), `message` |
| `beginEnrollment` | `ticketId` | Owner only: `challengeId`, `movements`, `expiresIn` |
| `enroll` | `ticketId`, `challengeId`, `consent: true`, `frames` | Owner only: `registered: true` |
| `remove` | `ticketId` | Owner only: deletes enrollment and revokes its QR |
| `beginCheckIn` | complete `qr` string | Staff only: `challengeId`, `movements`, `expiresIn`, safe event/seat details |
| `completeCheckIn` | `challengeId`, `frames` | Staff only: `valid`, `reason`; successful result includes ticketId/usedAt |
| `testFace` | `challengeId`, `frames` | Staff only: real matching without entry; success includes `valid:true`, `testOnly:true`; ticket stays unused |

`frames` is exactly five base64 JPEG strings, ordered according to the server-provided `movements`, **without data URL prefixes**, maximum 1,000,000 characters each; each image dimension 160–1280px. Exactly one sufficiently large, sharp, well-lit face is required. Responses use `{data: ...}` or `{error: {code, message}}`. Face mismatches return `valid:false`; invalid/expired/unauthorized requests return appropriate HTTP errors. Treat errors and timeouts as no admission.

Loopback only is intentional. Android Emulator can use `10.0.2.2` to reach the host; for a USB-connected Android device, `adb reverse tcp:8080 tcp:80` lets the app reach the server at `http://localhost:8080`. Your app must explicitly permit local demo cleartext traffic if needed. A normal phone browser cannot use your PC's `localhost`; LAN/browser camera use requires trusted HTTPS and an explicitly secured deployment. Do not disable the loopback guard or expose XAMPP publicly. iOS/native deployment is outside this local demo scope.

## Verification

```powershell
C:/xampp/php/php.exe tests/face-verification.test.php
python tests/face-processing.test.py
node --test tests/face-client.test.cjs tests/face-ui.test.cjs
node --test tests/face-ui.test.cjs tests/ticket-pages.test.cjs tests/ticket-transfer.test.cjs tests/resale-workflows.test.cjs tests/auth-guard.test.cjs tests/checkout-flow.test.cjs
```

Tests use synthetic in-memory records and do not create buyers, enroll real faces or consume live tickets. Run a supervised end-to-end rehearsal using your own demo buyer and camera before the FYP presentation.
