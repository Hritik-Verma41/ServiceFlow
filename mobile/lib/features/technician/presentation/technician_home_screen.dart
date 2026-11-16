import 'package:flutter/material.dart';
import 'package:serviceflow/features/auth/domain/app_user.dart';
import 'package:serviceflow/shared/widgets/theme_mode_selector.dart';

class TechnicianHomeScreen extends StatelessWidget {
  final AppUser user;

  const TechnicianHomeScreen({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('ServiceFlow Technician'),
        actions: const [ThemeModeSelector(), SizedBox(width: 8)],
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.engineering_rounded,
                size: 64,
                color: Color(0xFF2563EB),
              ),
              const SizedBox(height: 20),
              Text(
                'Welcome, ${user.firstName}!',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Your assigned service jobs will appear here.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
