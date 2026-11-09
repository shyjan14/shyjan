/// Build-time configuration.
///   flutter run --dart-define=API_URL=https://hr-api.yourcompany.ae
class AppConfig {
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:4000');
  static String get apiBase => '$apiUrl/api/v1';
  static const appName = String.fromEnvironment('COMPANY_NAME', defaultValue: 'Newton Training Center');
}
