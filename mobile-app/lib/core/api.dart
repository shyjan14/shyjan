import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import 'config.dart';

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;
  @override
  String toString() => message;
}

/// HTTP client with access/refresh token handling.
/// Tokens live only in the OS keystore (Android Keystore / iOS Keychain).
class Api {
  Api._();
  static final instance = Api._();

  final _storage = const FlutterSecureStorage();
  final _client = http.Client();
  String? _access;
  String? _refresh;
  String? deviceId;
  Future<bool>? _refreshing;
  void Function()? onSessionExpired;

  Future<void> loadTokens() async {
    _access = await _storage.read(key: 'access');
    _refresh = await _storage.read(key: 'refresh');
  }

  bool get hasSession => _refresh != null;

  Future<void> saveTokens(String access, String refresh) async {
    _access = access;
    _refresh = refresh;
    await _storage.write(key: 'access', value: access);
    await _storage.write(key: 'refresh', value: refresh);
  }

  Future<void> clearTokens() async {
    final r = _refresh;
    _access = null;
    _refresh = null;
    await _storage.delete(key: 'access');
    await _storage.delete(key: 'refresh');
    if (r != null) {
      unawaited(
        _client
            .post(Uri.parse('${AppConfig.apiBase}/auth/logout'), headers: {'Content-Type': 'application/json'}, body: jsonEncode({'refreshToken': r}))
            .catchError((_) => http.Response('', 0)),
      );
    }
  }

  Map<String, String> _headers({bool json = true}) => {
    if (json) 'Content-Type': 'application/json',
    if (_access != null) 'Authorization': 'Bearer $_access',
    'X-Device-Id': ?deviceId,
  };

  Future<bool> _doRefresh() {
    return _refreshing ??= () async {
      try {
        if (_refresh == null) return false;
        final res = await _client.post(
          Uri.parse('${AppConfig.apiBase}/auth/refresh'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'refreshToken': _refresh}),
        );
        if (res.statusCode != 200) return false;
        final j = jsonDecode(res.body);
        await saveTokens(j['accessToken'], j['refreshToken']);
        return true;
      } catch (_) {
        return false;
      } finally {
        _refreshing = null;
      }
    }();
  }

  Future<dynamic> _send(Future<http.Response> Function() call, {bool retry = true}) async {
    http.Response res;
    try {
      res = await call().timeout(const Duration(seconds: 30));
    } on TimeoutException {
      throw ApiException(0, 'Server is not responding. Check your internet connection.');
    } catch (_) {
      throw ApiException(0, 'No internet connection. Please try again.');
    }
    if (res.statusCode == 401 && retry && _refresh != null) {
      if (await _doRefresh()) return _send(call, retry: false);
      await clearTokens();
      onSessionExpired?.call();
      throw ApiException(401, 'Session expired. Please log in again.');
    }
    final body = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    if (res.statusCode >= 400) {
      final m = body is Map ? body['message'] : null;
      throw ApiException(res.statusCode, m is List ? m.join('\n') : (m?.toString() ?? 'Something went wrong (${res.statusCode})'));
    }
    return body;
  }

  Uri _u(String path) => Uri.parse('${AppConfig.apiBase}$path');

  Future<dynamic> get(String path) => _send(() => _client.get(_u(path), headers: _headers()));
  Future<dynamic> post(String path, [Object? body]) => _send(() => _client.post(_u(path), headers: _headers(), body: jsonEncode(body ?? {})));
  Future<dynamic> patch(String path, [Object? body]) => _send(() => _client.patch(_u(path), headers: _headers(), body: jsonEncode(body ?? {})));

  Future<dynamic> multipart(String path, Map<String, String> fields, {String? fileField, Uint8List? bytes, String? filename, String mime = 'image/jpeg'}) {
    return _send(() async {
      final req = http.MultipartRequest('POST', _u(path))
        ..headers.addAll(_headers(json: false))
        ..fields.addAll(fields);
      if (fileField != null && bytes != null) {
        final parts = mime.split('/');
        req.files.add(http.MultipartFile.fromBytes(fileField, bytes, filename: filename ?? 'file', contentType: MediaType(parts[0], parts[1])));
      }
      return http.Response.fromStream(await _client.send(req));
    });
  }

  /// Download a private file (selfie, document) with the access token.
  Future<Uint8List> file(String key) async {
    final res = await _client.get(_u('/files/$key'), headers: _headers());
    if (res.statusCode != 200) throw ApiException(res.statusCode, 'File not available');
    return res.bodyBytes;
  }
}
