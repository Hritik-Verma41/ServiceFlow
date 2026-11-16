import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:serviceflow/core/router/app_router.dart';
import 'package:serviceflow/core/theme/app_theme.dart';
import 'package:serviceflow/core/theme/theme_controller.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  runApp(const ProviderScope(child: ServiceFlowApp()));
}

class ServiceFlowApp extends ConsumerWidget {
  const ServiceFlowApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final themeState = ref.watch(themeControllerProvider);

    final selectedTheme = themeState.value ?? AppThemeMode.system;

    return MaterialApp.router(
      title: 'ServiceFlow',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: switch (selectedTheme) {
        AppThemeMode.light => ThemeMode.light,
        AppThemeMode.dark => ThemeMode.dark,
        AppThemeMode.system => ThemeMode.system,
      },
      routerConfig: router,
    );
  }
}
