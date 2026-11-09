import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_jailbreak_detection/flutter_jailbreak_detection.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:local_auth/local_auth.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:uuid/uuid.dart';

import 'config.dart';

class DeviceInfo {
  DeviceInfo(this.id, this.model, this.platform);
  final String id;
  final String model;
  final String platform;
}

class LocationResult {
  LocationResult(this.position, this.error);
  final Position? position;
  final String? error;
}

/// Device binding, integrity checks, location and biometrics.
class DeviceSecurity {
  static const _storage = FlutterSecureStorage();
  static final _auth = LocalAuthentication();

  /// Stable per-install device ID kept in the secure keystore.
  /// A reinstall creates a new ID, which HR must approve before it can punch.
  static Future<DeviceInfo> deviceInfo() async {
    var id = await _storage.read(key: 'device_id');
    if (id == null) {
      id = const Uuid().v4();
      await _storage.write(key: 'device_id', value: id);
    }
    var model = 'Unknown', platform = 'web';
    try {
      final info = DeviceInfoPlugin();
      if (kIsWeb) {
        model = (await info.webBrowserInfo).browserName.name;
      } else if (defaultTargetPlatform == TargetPlatform.android) {
        final a = await info.androidInfo;
        model = '${a.manufacturer} ${a.model}';
        platform = 'android ${a.version.release}';
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        final i = await info.iosInfo;
        model = i.utsname.machine;
        platform = 'ios ${i.systemVersion}';
      }
    } catch (_) {}
    return DeviceInfo(id, model, platform);
  }

  static Future<bool> isRooted() async {
    if (kIsWeb) return false;
    try {
      return await FlutterJailbreakDetection.jailbroken;
    } catch (_) {
      return false;
    }
  }

  static Future<LocationResult> currentLocation() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      return LocationResult(null, 'Location is turned off. Please turn on GPS / Location services.');
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied) return LocationResult(null, 'Location permission is needed to verify you are at your branch.');
    if (perm == LocationPermission.deniedForever) {
      return LocationResult(null, 'Location permission is blocked. Open Settings → Apps → Attendance → Permissions and allow Location.');
    }
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.best, timeLimit: Duration(seconds: 20)),
      );
      return LocationResult(pos, null);
    } catch (_) {
      return LocationResult(null, 'Could not get your location. Move near a window or outside and try again.');
    }
  }

  static Future<String?> wifiBssid() async {
    if (kIsWeb) return null;
    try {
      final b = await NetworkInfo().getWifiBSSID();
      return (b == null || b == '02:00:00:00:00:00') ? null : b;
    } catch (_) {
      return null;
    }
  }

  static double distance(double lat1, double lon1, double lat2, double lon2) => Geolocator.distanceBetween(lat1, lon1, lat2, lon2);

  static Future<bool> biometricAvailable() async {
    if (kIsWeb) return false;
    try {
      return await _auth.isDeviceSupported() && await _auth.canCheckBiometrics;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> unlock() async {
    if (kIsWeb) return true;
    try {
      if (!await _auth.isDeviceSupported()) return true;
      return await _auth.authenticate(localizedReason: 'Unlock ${AppConfig.appName}', persistAcrossBackgrounding: true);
    } catch (_) {
      return false;
    }
  }

  static Future<bool> get biometricEnabled async => (await _storage.read(key: 'biometric')) == '1';
  static Future<void> setBiometric(bool on) => _storage.write(key: 'biometric', value: on ? '1' : '0');
}
