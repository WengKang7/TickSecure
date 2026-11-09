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
/// enter the app. USB forwarding keeps the existing PHP loopback guard intact.
class CheckinApi {
  static final endpoint = Uri.parse(
    'http://127.0.0.1:8080/ticksecure-ui/api/face.php',
  );
  final String apiKey;
  final http.Client client;
  String? _idToken, _refreshToken;
  DateTime _expires = DateTime(2000);
  int _generation = 0;
  CheckinApi({required this.apiKey, http.Client? client})
    : client = client ?? http.Client();

  Future<Map<String, dynamic>> _post(
    Uri uri,
    Map<String, dynamic> body, {
    String? token,
    bool form = false,
  }) async {
    try {
      final response = await client
          .post(
            uri,
            headers: {
              'Content-Type': form
                  ? 'application/x-www-form-urlencoded'
                  : 'application/json',
              if (token != null) 'Authorization': 'Bearer $token',
            },
            body: form
                ? body.map((key, value) => MapEntry(key, value.toString()))
                : jsonEncode(body),
          )
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
        'Cannot reach the PC. Keep USB connected, start XAMPP Apache and run the USB connection script.',
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
