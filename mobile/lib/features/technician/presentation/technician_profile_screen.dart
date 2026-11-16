import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:serviceflow/features/auth/domain/app_user.dart';
import 'package:serviceflow/features/auth/presentation/auth_controller.dart';
import 'package:serviceflow/shared/widgets/theme_mode_selector.dart';

class TechnicianProfileScreen extends ConsumerWidget {
  final AppUser user;

  const TechnicianProfileScreen({super.key, required this.user});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final displayName = user.fullName.trim().isNotEmpty
        ? user.fullName.trim()
        : '${user.firstName} ${user.lastName}'.trim();

    final memberships = user.memberships;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile & Settings'),
        actions: const [ThemeModeSelector(), SizedBox(width: 8)],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 38,
                    backgroundColor: theme.colorScheme.primaryContainer,
                    child: Text(
                      _initials(displayName),
                      style: theme.textTheme.headlineMedium?.copyWith(
                        color: theme.colorScheme.onPrimaryContainer,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    displayName.isEmpty ? 'ServiceFlow User' : displayName,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Technician Account',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          _SectionTitle(title: 'Personal Information'),
          Card(
            child: Column(
              children: [
                _InfoTile(
                  icon: Icons.person_outline,
                  label: 'Full Name',
                  value: displayName.isEmpty ? 'Not provided' : displayName,
                ),
                const Divider(height: 1, indent: 56),
                _InfoTile(
                  icon: Icons.email_outlined,
                  label: 'Email Address',
                  value: user.email,
                ),
                const Divider(height: 1, indent: 56),
                _InfoTile(
                  icon: Icons.phone_outlined,
                  label: 'Phone Number',
                  value: user.phone.isEmpty ? 'Not provided' : user.phone,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _SectionTitle(title: 'Company Memberships'),
          if (memberships.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text('No company memberships found.'),
              ),
            )
          else
            ...memberships.map(
              (membership) => Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: theme.colorScheme.secondaryContainer,
                    child: Icon(
                      Icons.business_outlined,
                      color: theme.colorScheme.onSecondaryContainer,
                    ),
                  ),
                  title: Text(
                    membership.companyName,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: [
                        _MembershipChip(label: _formatLabel(membership.role)),
                        _MembershipChip(
                          label: _formatLabel(membership.status),
                          isActive: membership.status == 'ACTIVE',
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          const SizedBox(height: 20),
          _SectionTitle(title: 'Appearance'),
          const Card(
            child: ListTile(
              leading: Icon(Icons.palette_outlined),
              title: Text('App Theme'),
              subtitle: Text('Choose system, light, or dark appearance'),
              trailing: ThemeModeSelector(),
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => _confirmLogout(context, ref),
            icon: const Icon(Icons.logout),
            label: const Text('Log Out'),
            style: OutlinedButton.styleFrom(
              foregroundColor: theme.colorScheme.error,
              side: BorderSide(color: theme.colorScheme.error),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
          const SizedBox(height: 24),
          Center(
            child: Text(
              'ServiceFlow',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _initials(String name) {
    final parts = name.split(' ').where((part) => part.isNotEmpty).toList();

    if (parts.isEmpty) return 'SF';
    if (parts.length == 1) return parts.first[0].toUpperCase();

    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  String _formatLabel(String value) {
    return value
        .split('_')
        .map(
          (part) => part.isEmpty
              ? part
              : '${part[0]}${part.substring(1).toLowerCase()}',
        )
        .join(' ');
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Log Out'),
        content: const Text('Are you sure you want to log out of ServiceFlow?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Log Out'),
          ),
        ],
      ),
    );

    if (shouldLogout != true || !context.mounted) return;

    try {
      await ref.read(authControllerProvider.notifier).logout();

      if (context.mounted) {
        context.go('/login');
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unable to log out. Please try again.')),
        );
      }
    }
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;

  const _SectionTitle({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleMedium
            ?.copyWith(fontWeight: FontWeight.bold),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon),
      title: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall
            ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
      ),
      subtitle: Text(
        value,
        style: const TextStyle(fontWeight: FontWeight.w500),
      ),
    );
  }
}

class _MembershipChip extends StatelessWidget {
  final String label;
  final bool isActive;

  const _MembershipChip({required this.label, this.isActive = false});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    final color = isActive ? Colors.green : colorScheme.secondary;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
