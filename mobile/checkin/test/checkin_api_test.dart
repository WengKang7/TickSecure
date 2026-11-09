import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:image/image.dart' as img;
import 'package:ticksecure_checkin/checkin_api.dart';
import 'package:ticksecure_checkin/main.dart';

void main() {
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
          expect(request.url, CheckinApi.endpoint);
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
