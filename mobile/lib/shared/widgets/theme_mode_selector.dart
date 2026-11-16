import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:serviceflow/core/theme/theme_controller.dart';

class ThemeModeSelector extends ConsumerWidget {
  const ThemeModeSelector({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeState = ref.watch(themeControllerProvider);
    final selectedTheme = themeState.value ?? AppThemeMode.system;

    return PopupMenuButton<AppThemeMode>(
      tooltip: 'Change appearance',
      icon: const Icon(Icons.palette_outlined),
      initialValue: selectedTheme,
      onSelected: (mode) {
        ref.read(themeControllerProvider.notifier).setTheme(mode);
      },
      itemBuilder: (context) => [
        _buildItem(
          AppThemeMode.system,
          selectedTheme,
          Icons.settings_suggest_outlined,
          'System',
        ),
        _buildItem(
          AppThemeMode.light,
          selectedTheme,
          Icons.light_mode_outlined,
          'Light',
        ),
        _buildItem(
          AppThemeMode.dark,
          selectedTheme,
          Icons.dark_mode_outlined,
          'Dark',
        ),
      ],
    );
  }

  PopupMenuItem<AppThemeMode> _buildItem(
    AppThemeMode mode,
    AppThemeMode selectedTheme,
    IconData icon,
    String label,
  ) {
    return PopupMenuItem<AppThemeMode>(
      value: mode,
      child: Row(
        children: [
          Icon(icon, size: 20),
          const SizedBox(width: 12),
          Expanded(child: Text(label)),
          if (selectedTheme == mode) const Icon(Icons.check, size: 18),
        ],
      ),
    );
  }
}
