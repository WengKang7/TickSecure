## Wi-Fi upgrade — version 1.2.0 (build 3)

Install the updated APK over the existing app. Wi-Fi setup is described below. USB remains available by entering http://127.0.0.1:8080/ticksecure-ui and running Connect-USB.ps1. Existing face registrations remain usable. The earlier three-image APK cannot complete the new server movement check. No extra SepoliaETH is needed.

# TickSecure Entry — Android Wi-Fi FYP demo

This is a native Flutter Android app, not just a `.dart` file. Install the built **APK** on an Android 7.0+ phone. It uses the same Firebase project, PHP face service, encrypted registrations, YuNet/SFace matcher and atomic check-in transaction as the website. No new Firebase database is needed.

## What it does

- Sign in with an existing active organizer/admin email and password; buyers cannot operate the scanner.
- Scan TKSECURE2 QR codes using the rear camera, or enter decoded QR text manually.
- Validate the current owner, registered face, NFT confirmation, event and unused ticket on the backend. Organizers are limited to their own events.
- Capture five guided head poses using three-second countdowns on the rear or front camera after consent; compare on the PC with the buyer's existing face registration.
- Only show entry allowed after the backend confirms USED. Display event, current owner, category, section, seat, ticket and Malaysia check-in time.
- Reject invalid/expired QR, wrong face, wrong organizer, unconfirmed NFT and already-used tickets. No automatic retries after a network error.

## Install and connect

Deliverables in the website project's `downloads` folder:

- `ticksecure-entry-demo.apk`: installable Android application.
- `ticksecure-checkin-source.zip`: Flutter source, tests and connection scripts (uses the existing website backend).
- `ticksecure-entry-build.txt`: build checks, APK checksum and device-test limitation.

1. Connect the phone and PC to the same trusted home/demo Wi-Fi. A PC connected by Ethernet to the same router also works. Guest Wi-Fi with device isolation may block access.
2. Start XAMPP Apache. This APK is configured for the PC IPv4 address **192.168.100.104** (found using ipconfig). Keep that address reserved for the PC in the router. This APK permits HTTP only for that address and loopback. If your PC IP changes, rebuild after updating the IP in lib/main.dart, lib/checkin_api.dart, android/app/src/main/res/xml/network_security_config.xml and Connect-WiFi.ps1.
3. On the phone open http://192.168.100.104/ticksecure-ui/downloads/ticksecure-entry-demo.apk to download and install the APK. You can also transfer the APK file to the phone without USB. Allow installation from your chosen browser when Android asks.
4. Open TickSecure Entry. The PC server address is prefilled as **http://192.168.100.104/ticksecure-ui**. Enter the existing organizer/admin email and password, then sign in.
5. Keep the PC awake, Apache running and both devices connected. Both devices need internet for Firebase. No USB or USB debugging is required for Wi-Fi.

If the phone cannot open the download URL, confirm the PC IP with ipconfig. On your trusted Wi-Fi, Windows needs a **Private** network profile and an inbound Apache exception. To select a Private profile on your own trusted Wi-Fi, open Windows Settings > Network & internet > Wi-Fi > your connected network > Network profile type > Private. The supplied script can add an exception limited to Apache, its port, the local subnet and the Private profile. Run PowerShell as Administrator from the project directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\mobile\checkin\Connect-WiFi.ps1 -AllowFirewall
```

For a different Apache port, add -ApachePort 8081 and include :8081 in the phone URL and app address. No router port forwarding is needed. Use the same APK signing key to update the installed app.

## Check in an attendee

1. The buyer finishes NFT confirmation and registers their face on the website. Open their ticket QR on another screen.
2. In the phone app choose **Scan ticket QR**. QR acceptance does not admit the attendee.
3. Choose rear camera (staff points phone at attendee) or front/selfie camera. Confirm the attendee is physically present and agrees to verification.
4. Select **Start face camera & verify**. Once the camera is ready and consent is checked, read the five directions to the attendee: look forward, turn gently to their requested side, return forward, turn to the opposite side, return forward. Each step has a three-second countdown and captures automatically. The server checks the movements and identity before entry.
5. Wait for the explicit result. Success consumes the real ticket and deletes its face template. Select **Next attendee** for another ticket.

On failure, read the message. An expired request or mismatch requires scanning again. On timeout/backgrounding/disconnection, check ticket status by rescanning; a server transaction may have finished even if its response was lost. Do not assume admission and do not automatically repeat the POST. The app stops the camera and invalidates its local challenge when backgrounded.

## Connection and privacy

The selected PC address supplies the existing /api/face.php endpoint. The backend allows private IPv4 peers for authenticated staff session, QR validation and check-in only. It reads the socket peer rather than forwarded headers. Account, event ownership and ticket checks still run on every operation. Buyer registration continues through the PC website.

The local HTTP connection carries images and bearer tokens without encryption. Use trusted private Wi-Fi and FYP test accounts. Android permits HTTP only for the configured PC IP and loopback. Redirects are disabled. Firebase sign-in/refresh use HTTPS. For deployment beyond this supervised local demo, configure trusted HTTPS. Matching needs the PC's configured service-account credentials, encryption key and face models.

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

Backend regression tests: `C:/xampp/php/php.exe tests/face-verification.test.php` from the website project root. Flutter tests use synthetic images and mock HTTP; they do not enroll faces or consume live tickets. A real phone/Wi-Fi/camera rehearsal is still required, including wrong face, duplicate entry, sign-out, permission denial and disconnected Wi-Fi.

Android HTTP exceptions follow the platform domain configuration: https://developer.android.com/privacy-and-security/security-config
