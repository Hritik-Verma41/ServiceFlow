import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppThemeMode { system, light, dark }

final themeControllerProvider =
    AsyncNotifierProvider<ThemeController, AppThemeMode>(ThemeController.new);

class ThemeController extends AsyncNotifier<AppThemeMode> {
  static const String _themeKey = 'app_theme_mode';

  @override
  Future<AppThemeMode> build() async {
    final preferences = await SharedPreferences.getInstance();
    final savedTheme = preferences.getString(_themeKey);

    return AppThemeMode.values.firstWhere(
      (mode) => mode.name == savedTheme,
      orElse: () => AppThemeMode.system,
    );
  }

  Future<void> setTheme(AppThemeMode mode) async {
    final previousState = state;

    state = AsyncData(mode);

    try {
      final preferences = await SharedPreferences.getInstance();
      await preferences.setString(_themeKey, mode.name);
    } catch (_) {
      state = previousState;
      rethrow;
    }
  }
}
