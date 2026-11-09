/// Build-time configuration.
/// Release builds use the live server by default.
/// For local development:  flutter run --dart-define=API_URL=http://10.0.2.2:4000
class AppConfig {
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'https://api.newtontraininguae.com');
  static String get apiBase => '$apiUrl/api/v1';
  static const appName = String.fromEnvironment('COMPANY_NAME', defaultValue: 'Newton Training Center');
}
