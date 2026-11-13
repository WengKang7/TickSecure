import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:image/image.dart' as img;
import 'package:ticksecure_checkin/checkin_api.dart';
import 'package:ticksecure_checkin/main.dart';

void main() {
  test(
    'Wi-Fi routes only the staff API to the PC and blocks redirects',
    () async {
      final api = CheckinApi(
        apiKey: 'key',
        client: MockClient((request) async {
          expect(request.followRedirects, isFalse);
          if (request.url.host == 'identitytoolkit.googleapis.com') {
            return http.Response(
              jsonEncode({
                'idToken': 'token',
                'refreshToken': 'refresh',
                'expiresIn': '3600',
              }),
              200,
            );
          }
          expect(
            request.url.toString(),
            'http://192.168.100.104/ticksecure-ui/api/face.php',
          );
          expect(request.headers['Authorization'], 'Bearer token');
          return http.Response(
            jsonEncode({
              'data': {'role': 'organizer'},
            }),
            200,
          );
        }),
      );
      api.setServer('http://192.168.100.104/ticksecure-ui/');
      await api.signIn('staff@example.test', 'password');
      api.setServer('http://127.0.0.1:8080/ticksecure-ui');
      await expectLater(api.call('session'), throwsA(isA<CheckinException>()));
      for (final address in [
        'http://8.8.8.8',
        'http://192.168.100.104.evil.test',
        'http://user:pass@192.168.100.104',
        'http://192.168.100.104/?secret=x',
        'ftp://192.168.100.104',
        'http://192.168.0.13',
      ]) {
        expect(() => api.setServer(address), throwsA(isA<CheckinException>()));
      }
      api.dispose();
    },
  );

  test(
    'staff session uses Firebase identity and then the protected loopback endpoint',
    () async {
      final requests = <http.Request>[];
      final api = CheckinApi(
        apiKey: 'public-key',
        client: MockClient((request) async {
          requests.add(request);
          if (request.url.host == 'identitytoolkit.googleapis.com') {
            return http.Response(
              jsonEncode({
                'idToken': 'staff-token',
                'refreshToken': 'refresh',
                'expiresIn': '3600',
              }),
              200,
            );
          }
          expect(request.url, CheckinApi.defaultEndpoint);
          expect(request.headers['Authorization'], 'Bearer staff-token');
          return http.Response(
            jsonEncode({
              'data': {'uid': 'staff', 'role': 'organizer'},
            }),
            200,
          );
        }),
      );
      expect(
        (await api.signIn('staff@example.test', 'password'))['role'],
        'organizer',
      );
      expect(jsonDecode(requests.last.body)['action'], 'session');
      api.signOut();
      await expectLater(
        api.call('beginCheckIn'),
        throwsA(isA<CheckinException>()),
      );
      expect(requests.length, 2);
      api.dispose();
    },
  );
  test(
    'backend access denial clears sign-in and is never treated as admission',
    () async {
      final api = CheckinApi(
        apiKey: 'key',
        client: MockClient((request) async {
          if (request.url.host == 'identitytoolkit.googleapis.com') {
            return http.Response(
              jsonEncode({
                'idToken': 'token',
                'refreshToken': 'refresh',
                'expiresIn': '3600',
              }),
              200,
            );
          }
          return http.Response(
            jsonEncode({
              'error': {'message': 'This account cannot perform this action.'},
            }),
            403,
          );
        }),
      );
      await expectLater(
        api.signIn('buyer@example.test', 'password'),
        throwsA(isA<CheckinException>()),
      );
      await expectLater(
        api.call('completeCheckIn'),
        throwsA(isA<CheckinException>()),
      );
      api.dispose();
    },
  );
  test(
    'JPEG normalization keeps image dimensions and payload inside server limits',
    () {
      final frame = normalizeCapture(
        img.encodeJpg(img.Image(width: 1600, height: 1200)),
      );
      final image = img.decodeJpg(base64Decode(frame))!;
      expect(image.width, 960);
      expect(image.height, 720);
      expect(frame.length, lessThan(1000000));
      expect(
        () => normalizeCapture(img.encodeJpg(img.Image(width: 80, height: 80))),
        throwsA(isA<CheckinException>()),
      );
    },
  );
}
