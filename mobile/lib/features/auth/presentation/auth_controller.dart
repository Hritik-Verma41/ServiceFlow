import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:serviceflow/features/auth/data/auth_repository.dart';
import 'package:serviceflow/features/auth/data/token_storage.dart';
import 'package:serviceflow/features/auth/data/user_repository.dart';
import 'package:serviceflow/features/auth/domain/app_user.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository();
});

final userRepositoryProvider = Provider<UserRepository>((ref) {
  return UserRepository();
});

final authControllerProvider = AsyncNotifierProvider<AuthController, AppUser?>(
  AuthController.new,
);

class AuthController extends AsyncNotifier<AppUser?> {
  @override
  Future<AppUser?> build() async {
    final accessToken = await TokenStorage.getAccessToken();

    if (accessToken == null || accessToken.isEmpty) {
      return null;
    }

    try {
      return await ref.read(userRepositoryProvider).getCurrentUser();
    } catch (_) {
      await ref.read(authRepositoryProvider).logout();
      return null;
    }
  }

  Future<void> login({required String email, required String password}) async {
    state = const AsyncLoading();

    state = await AsyncValue.guard(() async {
      await ref
          .read(authRepositoryProvider)
          .login(email: email, password: password);

      return await ref.read(userRepositoryProvider).getCurrentUser();
    });
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(null);
  }
}
