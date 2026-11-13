import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

class CheckinException implements Exception {
  final String message;
  const CheckinException(this.message);
  @override
  String toString() => message;
}

/// Tokens stay in memory. Face templates and service-account credentials never
/// enter the app. The selected server must use a private IPv4 or loopback address.
class CheckinApi {
  static final defaultEndpoint = Uri.parse(
    'http://127.0.0.1:8080/ticksecure-ui/api/face.php',
  );
  Uri endpoint = defaultEndpoint;
  final String apiKey;
  final http.Client client;
  String? _idToken, _refreshToken;
  DateTime _expires = DateTime(2000);
  int _generation = 0;
  CheckinApi({required this.apiKey, http.Client? client})
    : client = client ?? http.Client();

  void setServer(String address) {
    final uri = Uri.tryParse(address.trim());
    final parts = uri?.host.split('.').map(int.tryParse).toList();
    final ipv4 =
        parts != null &&
        parts.length == 4 &&
        parts.every((n) => n != null && n >= 0 && n <= 255);
    final private =
        ipv4 &&
        (parts[0] == 10 ||
            parts[0] == 127 ||
            (parts[0] == 192 && parts[1] == 168) ||
            (parts[0] == 172 && parts[1]! >= 16 && parts[1]! <= 31));
    if (uri == null ||
        !private ||
        !['http', 'https'].contains(uri.scheme) ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment) {
      throw const CheckinException(
        'Enter your PC address, for example http://192.168.100.104/ticksecure-ui',
      );
    }
    if (uri.scheme == 'http' &&
        !['192.168.100.104', '127.0.0.1'].contains(uri.host)) {
      throw const CheckinException(
        'This demo APK allows HTTP only for PC 192.168.100.104 or USB 127.0.0.1. Use the configured PC address or rebuild for its new IP.',
      );
    }
    signOut();
    final path = uri.path.replaceFirst(RegExp(r'/+$'), '');
    endpoint = uri.replace(path: '$path/api/face.php');
  }

  Future<Map<String, dynamic>> _post(
    Uri uri,
    Map<String, dynamic> body, {
    String? token,
    bool form = false,
  }) async {
    try {
      final request = http.Request('POST', uri)..followRedirects = false;
      request.headers.addAll({
        'Content-Type': form
            ? 'application/x-www-form-urlencoded'
            : 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      });
      if (form) {
        request.bodyFields = body.map(
          (key, value) => MapEntry(key, value.toString()),
        );
      } else {
        request.body = jsonEncode(body);
      }
      final response = await client
          .send(request)
          .then(http.Response.fromStream)
          .timeout(const Duration(seconds: 45));
      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) throw const FormatException();
      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          decoded['error'] != null) {
        final error = decoded['error'];
        final message = error is Map ? error['message']?.toString() : null;
        throw CheckinException(
          _friendly(message ?? 'The request could not be completed.'),
        );
      }
      return decoded;
    } on TimeoutException {
      throw const CheckinException(
        'The server took too long. Check the ticket status by scanning again before retrying; check-in may already have completed.',
      );
    } on http.ClientException {
      throw const CheckinException(
        'Cannot reach the PC. Connect the phone and PC to the same Wi-Fi, start XAMPP Apache, and check the PC address and firewall.',
      );
    } on FormatException {
      throw const CheckinException(
        'The server returned an unexpected response. Check XAMPP and the /ticksecure-ui/api/face.php address.',
      );
    }
  }

  static String _friendly(String value) {
    if (value.contains('INVALID_LOGIN_CREDENTIALS') ||
        value.contains('INVALID_PASSWORD') ||
        value.contains('EMAIL_NOT_FOUND')) {
      return 'Email or password is incorrect.';
    }
    if (value.contains('USER_DISABLED')) {
      return 'This account is inactive. Contact the administrator.';
    }
    if (value.contains('TOO_MANY_ATTEMPTS')) {
      return 'Too many sign-in attempts. Please wait before trying again.';
    }
    if (value.contains('INVALID_EMAIL')) return 'Enter a valid email address.';
    return value;
  }

  Future<Map<String, dynamic>> signIn(String email, String password) async {
    signOut();
    final generation = _generation;
    final result = await _post(
      Uri.https(
        'identitytoolkit.googleapis.com',
        '/v1/accounts:signInWithPassword',
        {'key': apiKey},
      ),
      {'email': email.trim(), 'password': password, 'returnSecureToken': true},
    );
    if (generation != _generation) {
      throw const CheckinException('Sign-in was cancelled.');
    }
    _saveTokens(result);
    try {
      return await call('session');
    } catch (_) {
      if (generation == _generation) signOut();
      rethrow;
    }
  }

  void _saveTokens(Map<String, dynamic> result, {bool refresh = false}) {
    _idToken = result[refresh ? 'id_token' : 'idToken'] as String?;
    _refreshToken =
        result[refresh ? 'refresh_token' : 'refreshToken'] as String?;
    _expires = DateTime.now().add(
      Duration(
        seconds:
            int.tryParse('${result[refresh ? 'expires_in' : 'expiresIn']}') ??
            0,
      ),
    );
    if (_idToken == null || _refreshToken == null) {
      throw const CheckinException(
        'Sign-in response is incomplete. Sign in again.',
      );
    }
  }

  Future<Map<String, dynamic>> call(
    String action, [
    Map<String, dynamic> data = const {},
  ]) async {
    final generation = _generation;
    if (_idToken == null) {
      throw const CheckinException(
        'Sign in as the organizer or administrator.',
      );
    }
    if (_expires.isBefore(DateTime.now().add(const Duration(minutes: 1)))) {
      final result = await _post(
        Uri.https('securetoken.googleapis.com', '/v1/token', {'key': apiKey}),
        {'grant_type': 'refresh_token', 'refresh_token': _refreshToken},
        form: true,
      );
      if (generation != _generation) {
        throw const CheckinException('Your sign-in changed.');
      }
      _saveTokens(result, refresh: true);
    }
    if (generation != _generation) {
      throw const CheckinException('Your sign-in changed.');
    }
    final result = await _post(endpoint, {
      ...data,
      'action': action,
    }, token: _idToken);
    if (generation != _generation) {
      throw const CheckinException('Your sign-in changed.');
    }
    if (result['data'] is! Map<String, dynamic>) {
      throw const CheckinException('The server response is incomplete.');
    }
    return result['data'] as Map<String, dynamic>;
  }

  void signOut() {
    _generation++;
    _idToken = _refreshToken = null;
    _expires = DateTime(2000);
  }

  void dispose() {
    signOut();
    client.close();
  }
}
