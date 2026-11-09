import 'package:flutter/foundation.dart';

import 'api.dart';
import 'device_security.dart';

/// Global auth state.
class Session extends ChangeNotifier {
  Session._();
  static final instance = Session._();
  final api = Api.instance;

  Map<String, dynamic>? me;
  bool ready = false;
  bool locked = false;
  String? deviceStatus;

  String get role => me?['role'] ?? 'EMPLOYEE';
  bool get isManager => role != 'EMPLOYEE';
  Map<String, dynamic>? get employee => me?['employee'];
  String get firstName => employee?['firstName'] ?? '';
  bool get mustChangePassword => me?['mustChangePwd'] == true;

  Future<void> init() async {
    final dev = await DeviceSecurity.deviceInfo();
    api.deviceId = dev.id;
    api.onSessionExpired = () {
      me = null;
      notifyListeners();
    };
    await api.loadTokens();
    if (api.hasSession) {
      locked = await DeviceSecurity.biometricEnabled;
      try {
        me = Map<String, dynamic>.from(await api.get('/auth/me'));
      } catch (_) {
        me = null;
      }
    }
    ready = true;
    notifyListeners();
  }

  /// Returns an MFA token if a second step is required.
  Future<String?> login(String login, String password) async {
    final dev = await DeviceSecurity.deviceInfo();
    final res = await api.post('/auth/login', {
      'login': login.trim(),
      'password': password,
      'deviceId': dev.id,
      'deviceModel': dev.model,
      'platform': dev.platform,
    });
    if (res['mfaRequired'] == true) return res['mfaToken'];
    await _complete(res);
    return null;
  }

  Future<void> verifyMfa(String mfaToken, String code) async {
    await _complete(await api.post('/auth/mfa/verify', {'mfaToken': mfaToken, 'code': code}));
  }

  Future<void> _complete(dynamic res) async {
    await api.saveTokens(res['accessToken'], res['refreshToken']);
    deviceStatus = res['deviceStatus'];
    me = Map<String, dynamic>.from(res['user']);
    notifyListeners();
  }

  Future<void> refreshMe() async {
    me = Map<String, dynamic>.from(await api.get('/auth/me'));
    notifyListeners();
  }

  void unlock() {
    locked = false;
    notifyListeners();
  }

  Future<void> logout() async {
    await api.clearTokens();
    me = null;
    notifyListeners();
  }
}
