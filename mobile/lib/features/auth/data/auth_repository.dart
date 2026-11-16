import 'package:dio/dio.dart';
import 'package:serviceflow/core/config/app_config.dart';
import 'package:serviceflow/core/network/api_client.dart';
import 'package:serviceflow/features/auth/data/token_storage.dart';

class AuthRepository {
  final Dio _dio = ApiClient.dio;

  Future<void> login({required String email, required String password}) async {
    try {
      final response = await _dio.post(
        AppConfig.tokenUrl,
        data: {'email': email.trim(), 'password': password},
      );

      final data = response.data as Map<String, dynamic>;

      final accessToken = data['access'] as String?;
      final refreshToken = data['refresh'] as String?;

      if (accessToken == null || refreshToken == null) {
        throw Exception('Invalid authentication response.');
      }

      await TokenStorage.saveTokens(
        accessToken: accessToken,
        refreshToken: refreshToken,
      );
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        throw Exception('Invalid email or password.');
      }

      throw Exception(
        error.response?.data is Map
            ? (error.response?.data['detail'] ??
                  'Unable to connect to ServiceFlow.')
            : 'Unable to connect to ServiceFlow.',
      );
    }
  }

  Future<void> logout() async {
    await TokenStorage.clearTokens();
  }
}
