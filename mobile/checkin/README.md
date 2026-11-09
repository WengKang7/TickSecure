# TickSecure Entry — Android USB FYP demo

This is a native Flutter Android app, not just a `.dart` file. Install the built **APK** on an Android 7.0+ phone. It uses the same Firebase project, PHP face service, encrypted registrations, YuNet/SFace matcher and atomic check-in transaction as the website. No new Firebase database is needed.

## What it does

- Sign in with an existing active organizer/admin email and password; buyers cannot operate the scanner.
- Scan TKSECURE2 QR codes using the rear camera, or enter decoded QR text manually.
- Validate the current owner, registered face, NFT confirmation, event and unused ticket on the backend. Organizers are limited to their own events.
- Capture three current JPEGs using the rear or front camera after consent; compare on the PC with the buyer's existing face registration.
- Only show entry allowed after the backend confirms USED. Display event, current owner, category, section, seat, ticket and Malaysia check-in time.
- Reject invalid/expired QR, wrong face, wrong organizer, unconfirmed NFT and already-used tickets. No automatic retries after a network error.

## Install and connect

Deliverables in the website project's `downloads` folder:

- `ticksecure-entry-demo.apk`: installable Android application.
- `ticksecure-checkin-source.zip`: Flutter source, tests and USB script (uses the existing website backend).
- `ticksecure-entry-build.txt`: build checks, APK checksum and device-test limitation.

1. On your PC start **XAMPP → Apache**. The existing website must be working at `http://localhost/ticksecure-ui/`. The existing face model/key setup must already work in the browser scanner.
2. On your phone enable Developer options (usually Settings → About phone → tap Build number seven times), then **USB debugging**. Android menus differ by manufacturer.
3. Connect the phone by a data-capable USB cable. Unlock it and approve the USB debugging prompt **for your own PC**.
4. Open PowerShell in `C:\xampp\htdocs\ticksecure-ui` and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\mobile\checkin\Connect-USB.ps1 -Install
```

This installs the local demo APK and forwards phone port 8080 to PC Apache port 80. It does not open the PC server to Wi-Fi or the internet. If Apache uses a different port, add `-ApachePort 8081` (replace 8081 with its actual port). With more than one connected device add `-DeviceSerial YOUR_DEVICE_ID`.

5. Open **TickSecure Entry** on the phone and sign in using your organizer/admin account. Allow camera access when asked.
6. After unplugging/reconnecting or restarting the phone, rerun the script without `-Install` to reconnect USB.

Alternatively copy `downloads/ticksecure-entry-demo.apk` to the phone and open it to install, then run the USB script without `-Install`. A Dart source file or source ZIP cannot be installed as an Android application.

## Check in an attendee

1. The buyer finishes NFT confirmation and registers their face on the website. Open their ticket QR on another screen.
2. In the phone app choose **Scan ticket QR**. QR acceptance does not admit the attendee.
3. Choose rear camera (staff points phone at attendee) or front/selfie camera. Confirm the attendee is physically present and agrees to verification.
4. Select **Start face camera & verify**. Once the camera is ready and consent is checked, the app captures three images automatically.
5. Wait for the explicit result. Success consumes the real ticket and deletes its face template. Select **Next attendee** for another ticket.

On failure, read the message. An expired request or mismatch requires scanning again. On timeout/backgrounding/disconnection, check ticket status by rescanning; a server transaction may have finished even if its response was lost. Do not assume admission and do not automatically repeat the POST. The app stops the camera and invalidates its local challenge when backgrounded.

## Connection and privacy

The fixed API address is `http://127.0.0.1:8080/ticksecure-ui/api/face.php` **on the phone**. ADB reverse sends it through USB to the PC, satisfying the existing loopback-only backend restriction. Firebase sign-in/refresh use HTTPS. Network cleartext is permitted only for loopback hosts, not arbitrary LAN/internet addresses. Phone and PC need internet access for Firebase; PC also needs its configured service-account credentials and face models. The app cannot perform matching independently when the PC is off.

Only the existing public Firebase web API key is bundled. Service-account credentials, encryption keys, saved templates and match scores never enter the app. Credentials/tokens stay in memory, Android backup is disabled, and closing the process requires signing in again. Camera plugin files are temporary; each captured file is deleted after reading/normalizing it, including capture failures where a file was returned. Images are not written to the gallery. A crash can leave a temporary camera-cache file; Android app storage/cache deletion removes it. No biometric images are logged or uploaded to a third-party recognition service.

This remains a supervised FYP matcher, not certified liveness detection. Staff must not use photos/videos as an attendee. No Sepolia transaction or fee is created by the check-in app.

## Build and test

Flutter 3.41.5 / Dart 3.11.3, Android SDK 36 and JDK 17 were used. Dependencies are pinned in pubspec.lock. Install compatible Android SDK/NDK tools and accept their licences yourself if your build environment requests them.

```powershell
cd mobile/checkin
flutter pub get
flutter analyze
flutter test
flutter build apk --release
```

Build result: `build/app/outputs/flutter-apk/app-release.apk`. The FYP APK uses the generated debug signing key for sideloading and is not a Play Store release. Keep this build key to install future updates over the same app. The distributable source ZIP excludes SDK caches, build outputs and machine-local configuration.

Backend regression tests: `C:/xampp/php/php.exe tests/face-verification.test.php` from the website project root. Flutter tests use synthetic images and mock HTTP; they do not enroll faces or consume live tickets. A real phone/USB/camera rehearsal is still required, including wrong face, duplicate entry, sign-out, permission denial and unplugged USB.
