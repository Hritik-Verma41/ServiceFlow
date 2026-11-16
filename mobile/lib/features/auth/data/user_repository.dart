import 'package:dio/dio.dart';
import 'package:serviceflow/core/config/app_config.dart';
import 'package:serviceflow/core/network/api_client.dart';
import 'package:serviceflow/features/auth/domain/app_user.dart';

class UserRepository {
  final Dio _dio = ApiClient.dio;

  Future<AppUser> getCurrentUser() async {
    try {
      final response = await _dio.get(AppConfig.currentUserUrl);

      if (response.data is! Map<String, dynamic>) {
        throw Exception('Invalid user profile response.');
      }

      return AppUser.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        throw Exception('Your session has expired. Please log in again.');
      }

      throw Exception('Unable to load your ServiceFlow profile.');
    }
  }
}
