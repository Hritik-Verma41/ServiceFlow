import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:serviceflow/features/auth/domain/app_user.dart';
import 'package:serviceflow/features/auth/presentation/auth_controller.dart';
import 'package:serviceflow/features/auth/presentation/login_screen.dart';
import 'package:serviceflow/features/customer/customer_home_screen.dart';
import 'package:serviceflow/features/technician/presentation/technician_home_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: '/',

    redirect: (context, state) {
      final authState = ref.read(authControllerProvider);
      final isLoginRoute = state.matchedLocation == '/login';

      if (authState.isLoading) {
        return null;
      }

      final user = authState.value;

      if (user == null) {
        return isLoginRoute ? null : '/login';
      }

      if (isLoginRoute) {
        return '/home';
      }

      return null;
    },

    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const _AuthLoadingScreen(),
      ),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/home',
        builder: (context, state) {
          final user = ref.read(authControllerProvider).value;

          if (user == null) {
            return const _AuthLoadingScreen();
          }

          return _buildHomeScreen(user);
        },
      ),
    ],
  );

  ref.listen(authControllerProvider, (previous, next) {
    router.refresh();
  });

  ref.onDispose(router.dispose);

  return router;
});

Widget _buildHomeScreen(AppUser user) {
  if (user.isTechnician) {
    return TechnicianHomeScreen(user: user);
  }

  if (user.isCustomer) {
    return CustomerHomeScreen(user: user);
  }

  return const _UnsupportedRoleScreen();
}

class _AuthLoadingScreen extends StatelessWidget {
  const _AuthLoadingScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}

class _UnsupportedRoleScreen extends ConsumerWidget {
  const _UnsupportedRoleScreen();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.info_outline, size: 48),
              const SizedBox(height: 16),
              const Text(
                'This account role is not available in the mobile app yet.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () async {
                  await ref.read(authControllerProvider.notifier).logout();

                  if (context.mounted) {
                    context.go('/login');
                  }
                },
                child: const Text('Log Out'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
