class AppConfig {
  AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:8000',
  );

  static const String tokenUrl = '/api/auth/token/';
  static const String refreshTokenUrl = '/api/auth/token/refresh/';
  static const String currentUserUrl = '/api/accounts/me/';
}
