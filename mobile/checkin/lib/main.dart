import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;
import 'package:mobile_scanner/mobile_scanner.dart';
import 'checkin_api.dart';
import 'public_config.dart';

void main() => runApp(const CheckinApp());

class CheckinApp extends StatelessWidget {
  const CheckinApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'TickSecure Entry',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: Colors.black),
      scaffoldBackgroundColor: Colors.white,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
    home: const EntryScreen(),
  );
}

// Bake orientation before sizing so phone JPEGs match the browser capture format.
String normalizeCapture(Uint8List bytes) {
  final decoded = img.decodeImage(bytes);
  if (decoded == null) {
    throw const CheckinException('Camera image could not be read.');
  }
  var image = img.bakeOrientation(decoded);
  if (math.max(image.width, image.height) > 960) {
    image = image.width >= image.height
        ? img.copyResize(image, width: 960)
        : img.copyResize(image, height: 960);
  }
  if (math.min(image.width, image.height) < 160) {
    throw const CheckinException('Camera resolution is too low.');
  }
  final result = base64Encode(img.encodeJpg(image, quality: 90));
  if (result.length > 1000000) {
    throw const CheckinException(
      'Image is too large. Try again in better lighting.',
    );
  }
  return result;
}

class EntryScreen extends StatefulWidget {
  const EntryScreen({super.key});
  @override
  State<EntryScreen> createState() => _EntryScreenState();
}

class _EntryScreenState extends State<EntryScreen> with WidgetsBindingObserver {
  final api = CheckinApi(apiKey: firebaseWebApiKey);
  final email = TextEditingController(),
      password = TextEditingController(),
      qr = TextEditingController();
  CameraController? camera;
  Map<String, dynamic>? staff, challenge, receipt;
  DateTime? expiry;
  String status = 'Connect your phone to the PC by USB before signing in.',
      error = '';
  bool busy = false, consent = false, foreground = true;
  int generation = 0;
  CameraLensDirection facing = CameraLensDirection.back;
  bool current(int value) => mounted && foreground && generation == value;
  Future<void> stopCamera() async {
    final old = camera;
    camera = null;
    await old?.dispose();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      foreground = true;
      return;
    }
    if (!foreground) return;
    foreground = false;
    generation++;
    if (staff == null) api.signOut();
    consent = false;
    challenge = null;
    stopCamera();
    if (mounted) {
      setState(() {
        busy = false;
        status =
            'Camera stopped. Scan again to check ticket status. A submitted check-in may already have completed.';
      });
    }
  }

  @override
  void dispose() {
    generation++;
    WidgetsBinding.instance.removeObserver(this);
    stopCamera();
    api.dispose();
    email.dispose();
    password.dispose();
    qr.dispose();
    super.dispose();
  }

  Future<void> signIn() async {
    if (busy) return;
    final value = ++generation;
    setState(() {
      busy = true;
      error = '';
      status = 'Signing in and checking staff access…';
    });
    try {
      final result = await api.signIn(email.text, password.text);
      if (!current(value)) {
        return;
      }
      if (!['admin', 'organizer'].contains(result['role'])) {
        throw const CheckinException(
          'Use an organizer or administrator account.',
        );
      }
      password.clear();
      setState(() {
        staff = result;
        status = 'Ready. Scan the attendee’s registered ticket QR.';
      });
    } catch (e) {
      if (current(value)) {
        setState(() {
          error = e.toString();
        });
      }
    } finally {
      if (current(value)) {
        setState(() {
          busy = false;
        });
      }
    }
  }

  Future<void> signOut() async {
    generation++;
    api.signOut();
    await stopCamera();
    if (!mounted) return;
    setState(() {
      staff = challenge = receipt = null;
      consent = busy = false;
      password.clear();
      qr.clear();
      error = '';
      status = 'Signed out.';
    });
  }

  Future<void> scanQr() async {
    if (busy) return;
    await stopCamera();
    if (!mounted) return;
    final result = await Navigator.of(
      context,
    ).push<String>(MaterialPageRoute(builder: (_) => const QrScreen()));
    if (!mounted || result == null) return;
    foreground = true;
    qr.text = result;
    await begin();
  }

  Future<void> begin() async {
    if (busy || staff == null) return;
    final text = qr.text.trim();
    if (!text.startsWith('TKSECURE2:') || text.length > 512) {
      setState(() {
        error = 'Scan or paste the complete registered TickSecure QR.';
      });
      return;
    }
    final value = ++generation;
    await stopCamera();
    if (!current(value)) return;
    setState(() {
      busy = true;
      error = '';
      challenge = receipt = null;
      consent = false;
      status = 'Checking QR, current owner and NFT status…';
    });
    try {
      final result = await api.call('beginCheckIn', {'qr': text});
      if (!current(value)) return;
      if (result['challengeId'] is! String) {
        throw const CheckinException(
          'The server did not issue an entry request.',
        );
      }
      setState(() {
        challenge = result;
        expiry = DateTime.now().add(
          Duration(seconds: (result['expiresIn'] as num?)?.toInt() ?? 90),
        );
        status =
            'QR accepted: ${result['eventName']} · Seat ${result['seat']}. Complete the face check within 90 seconds.';
      });
    } catch (e) {
      if (current(value)) {
        setState(() {
          error = e.toString();
        });
      }
    } finally {
      if (current(value)) {
        setState(() {
          busy = false;
        });
      }
    }
  }

  Future<void> startFace() async {
    if (busy || challenge == null) return;
    final value = generation;
    setState(() {
      busy = true;
      error = '';
      status = 'Starting face camera…';
    });
    try {
      await stopCamera();
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        throw const CheckinException('No camera is available.');
      }
      if (!current(value)) return;
      final selected =
          cameras.where((c) => c.lensDirection == facing).firstOrNull ??
          cameras.first;
      final next = CameraController(
        selected,
        ResolutionPreset.high,
        enableAudio: false,
      );
      camera = next;
      await next.initialize();
      if (!current(value) || camera != next) {
        await next.dispose();
        return;
      }
      await Future<void>.delayed(const Duration(milliseconds: 600));
      if (!current(value)) return;
      setState(() {
        status =
            'Look straight ahead. Keep your whole face visible, evenly lit and still.';
      });
    } catch (e) {
      if (current(value)) {
        await stopCamera();
        if (current(value)) {
          setState(() {
            error =
                'Camera could not start: $e. Check Android camera permissions.';
          });
        }
      }
    } finally {
      if (current(value)) {
        setState(() {
          busy = false;
        });
      }
    }
    if (current(value)) await verify();
  }

  Future<void> verify() async {
    if (busy ||
        !consent ||
        challenge == null ||
        camera?.value.isInitialized != true ||
        !foreground) {
      return;
    }
    if (expiry == null || DateTime.now().isAfter(expiry!)) {
      await stopCamera();
      if (mounted) {
        setState(() {
          challenge = null;
          consent = false;
          error = 'QR request expired. Scan again.';
        });
      }
      return;
    }
    final value = generation,
        id = challenge!['challengeId'],
        controller = camera!;
    setState(() {
      busy = true;
      error = '';
      receipt = null;
      status = 'Capturing three face images. Hold still…';
    });
    final frames = <String>[];
    try {
      for (var i = 0; i < 3; i++) {
        if (!current(value)) return;
        final file = await controller.takePicture();
        try {
          frames.add(await compute(normalizeCapture, await file.readAsBytes()));
        } finally {
          try {
            await File(file.path).delete();
          } catch (_) {
            /* Best-effort camera cache cleanup. */
          }
        }
        if (!current(value)) return;
        setState(() {
          status = 'Captured ${i + 1} of 3 images…';
        });
        if (i < 2) {
          await Future<void>.delayed(const Duration(milliseconds: 250));
        }
      }
      await stopCamera();
      if (!current(value)) return;
      setState(() {
        status =
            'Comparing with the buyer’s face registration and verifying entry…';
      });
      final result = await api.call('completeCheckIn', {
        'challengeId': id,
        'frames': frames,
      });
      if (!current(value)) return;
      if (result['valid'] != true ||
          result['testOnly'] == true ||
          result['ticketStatus'] != 'USED') {
        throw CheckinException(
          result['reason']?.toString() ??
              'Entry was not confirmed. Scan again.',
        );
      }
      setState(() {
        receipt = result;
        status =
            'Verification successful. Entry allowed. This ticket is now used.';
      });
    } catch (e) {
      if (current(value)) {
        setState(() {
          error = 'Verification failed: $e';
          status =
              'Entry is not confirmed. Scan again to check ticket status before retrying.';
        });
      }
    } finally {
      frames.clear();
      if (current(value)) {
        await stopCamera();
        if (current(value)) {
          setState(() {
            busy = false;
            challenge = null;
            consent = false;
          });
        }
      }
    }
  }

  Future<void> reset() async {
    if (busy) return;
    generation++;
    await stopCamera();
    if (mounted) {
      setState(() {
        challenge = receipt = null;
        consent = false;
        error = '';
        qr.clear();
        status = 'Ready for the next attendee.';
      });
    }
  }

  Widget gap() => const SizedBox(height: 16);
  Widget box(Widget child) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      border: Border.all(color: const Color(0xffdddddd)),
      borderRadius: BorderRadius.circular(10),
    ),
    child: child,
  );
  Widget receiptView(Map<String, dynamic> result) {
    final time = DateTime.tryParse(
      '${result['usedAt']}',
    )?.toUtc().add(const Duration(hours: 8));
    final values = {
      'Event': result['eventName'],
      'Current owner': result['attendeeName'],
      'Category': result['categoryName'],
      'Section': result['section'],
      'Seat': result['seat'],
      'Ticket': result['ticketId'],
      'Checked in (MYT)': time == null
          ? null
          : '${time.toIso8601String().replaceFirst('T', ' ').substring(0, 19)} MYT',
      'Status': 'Checked in · Used',
    };
    return box(
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check_circle_outline, color: Colors.green, size: 44),
          gap(),
          const Text(
            'Entry allowed',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600),
          ),
          for (final entry in values.entries)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.key,
                    style: const TextStyle(color: Colors.black54, fontSize: 12),
                  ),
                  SelectableText('${entry.value ?? 'Not available'}'),
                ],
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('ticksecure / entry'),
      actions: [
        if (staff != null)
          TextButton(
            onPressed: busy ? null : signOut,
            child: const Text('Sign out'),
          ),
      ],
    ),
    body: SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  staff == null ? 'Staff sign in' : 'Attendee check-in',
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                gap(),
                if (staff == null) ...[
                  const Text(
                    'Use your existing organizer or administrator account. Your PC performs face matching over USB.',
                  ),
                  gap(),
                  TextField(
                    controller: email,
                    enabled: !busy,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    decoration: const InputDecoration(labelText: 'Email'),
                  ),
                  gap(),
                  TextField(
                    controller: password,
                    enabled: !busy,
                    obscureText: true,
                    enableSuggestions: false,
                    autocorrect: false,
                    decoration: const InputDecoration(labelText: 'Password'),
                    onSubmitted: (_) => signIn(),
                  ),
                  gap(),
                  FilledButton(
                    onPressed: busy ? null : signIn,
                    child: const Text('Sign in'),
                  ),
                ] else ...[
                  Text('${staff!['name']} · ${staff!['role']}'),
                  gap(),
                  if (receipt != null) ...[
                    receiptView(receipt!),
                    gap(),
                    FilledButton(
                      onPressed: reset,
                      child: const Text('Next attendee'),
                    ),
                  ] else if (challenge == null) ...[
                    FilledButton.icon(
                      onPressed: busy ? null : scanQr,
                      icon: const Icon(Icons.qr_code_scanner),
                      label: const Text('Scan ticket QR'),
                    ),
                    gap(),
                    ExpansionTile(
                      title: const Text('Enter QR text manually'),
                      children: [
                        TextField(
                          controller: qr,
                          enabled: !busy,
                          maxLines: 3,
                          maxLength: 512,
                          decoration: const InputDecoration(
                            labelText: 'Complete TKSECURE2 QR text',
                          ),
                        ),
                        TextButton(
                          onPressed: busy ? null : begin,
                          child: const Text('Check QR'),
                        ),
                      ],
                    ),
                  ] else ...[
                    box(
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${challenge!['eventName']}',
                            style: const TextStyle(fontSize: 22),
                          ),
                          Text('Seat ${challenge!['seat']}'),
                          const Text(
                            'Complete face verification within 90 seconds.',
                          ),
                        ],
                      ),
                    ),
                    gap(),
                    if (camera?.value.isInitialized == true)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: AspectRatio(
                          aspectRatio: camera!.value.aspectRatio,
                          child: CameraPreview(camera!),
                        ),
                      ),
                    gap(),
                    DropdownButtonFormField<CameraLensDirection>(
                      initialValue: facing,
                      decoration: const InputDecoration(
                        labelText: 'Face camera',
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: CameraLensDirection.back,
                          child: Text('Rear camera'),
                        ),
                        DropdownMenuItem(
                          value: CameraLensDirection.front,
                          child: Text('Front / selfie camera'),
                        ),
                      ],
                      onChanged: busy
                          ? null
                          : (value) async {
                              await stopCamera();
                              if (mounted) {
                                setState(() {
                                  facing = value!;
                                });
                              }
                            },
                    ),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: consent,
                      onChanged: busy
                          ? null
                          : (value) async {
                              setState(() {
                                consent = value ?? false;
                              });
                              await verify();
                            },
                      title: const Text(
                        'The attendee is physically present and agrees to face verification.',
                      ),
                      subtitle: const Text(
                        'A successful match checks this ticket in. Do not scan a photo or video.',
                      ),
                    ),
                    FilledButton(
                      onPressed: busy ? null : startFace,
                      child: const Text('Start face camera & verify'),
                    ),
                    TextButton(
                      onPressed: busy ? null : reset,
                      child: const Text('Cancel / scan another ticket'),
                    ),
                  ],
                ],
                gap(),
                if (busy) const LinearProgressIndicator(color: Colors.black),
                gap(),
                Semantics(liveRegion: true, child: Text(status)),
                if (error.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Semantics(
                      liveRegion: true,
                      child: Text(
                        error,
                        style: const TextStyle(color: Colors.red),
                      ),
                    ),
                  ),
                gap(),
                const Text(
                  'Local FYP demonstration. Staff must supervise the attendee. Keep USB and XAMPP running.',
                  style: TextStyle(fontSize: 12, color: Colors.black54),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class QrScreen extends StatefulWidget {
  const QrScreen({super.key});
  @override
  State<QrScreen> createState() => _QrScreenState();
}

class _QrScreenState extends State<QrScreen> with WidgetsBindingObserver {
  final controller = MobileScannerController(
    formats: [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool captured = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        !captured &&
        controller.value.hasCameraPermission) {
      controller.start();
    } else if (state != AppLifecycleState.resumed) {
      controller.stop();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Scan ticket QR')),
    body: Column(
      children: [
        const Padding(
          padding: EdgeInsets.all(20),
          child: Text(
            'Point the rear camera at the QR on the buyer’s digital ticket.',
          ),
        ),
        Expanded(
          child: MobileScanner(
            controller: controller,
            errorBuilder: (context, error) => const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Camera unavailable. Allow camera permission in Android settings, or go back and enter QR text manually.',
                ),
              ),
            ),
            onDetect: (capture) async {
              if (captured) return;
              final value = capture.barcodes
                  .map((b) => b.rawValue)
                  .whereType<String>()
                  .where((s) => s.startsWith('TKSECURE2:') && s.length <= 512)
                  .firstOrNull;
              if (value == null) return;
              captured = true;
              await controller.stop();
              if (context.mounted) Navigator.of(context).pop(value);
            },
          ),
        ),
      ],
    ),
  );
}
