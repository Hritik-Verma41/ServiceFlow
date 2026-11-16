import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:serviceflow/features/auth/domain/app_user.dart';
import 'package:serviceflow/features/technician/data/service_job_repository.dart';
import 'package:serviceflow/features/technician/domain/service_job.dart';
import 'package:serviceflow/shared/widgets/theme_mode_selector.dart';

class TechnicianHomeScreen extends ConsumerWidget {
  final AppUser user;

  const TechnicianHomeScreen({super.key, required this.user});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final memberships = user.memberships
        .where(
          (membership) =>
              membership.role == 'TECHNICIAN' && membership.status == 'ACTIVE',
        )
        .toList();

    if (memberships.isEmpty) {
      return const Scaffold(
        body: Center(child: Text('No active technician membership found.')),
      );
    }

    final membership = memberships.first;
    final jobsAsync = ref.watch(technicianJobsProvider(membership.companyId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Assigned Jobs'),
        actions: [
          IconButton(
            tooltip: 'Activity History',
            icon: const Icon(Icons.history),
            onPressed: () {
              context.push('/activity/${membership.companyId}');
            },
          ),
          const ThemeModeSelector(),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Welcome, ${user.firstName}!',
                  style: Theme.of(context).textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  membership.companyName,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: jobsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, stackTrace) => _ErrorView(
                onRetry: () {
                  ref.invalidate(technicianJobsProvider(membership.companyId));
                },
              ),
              data: (jobs) {
                if (jobs.isEmpty) {
                  return RefreshIndicator(
                    onRefresh: () => ref.refresh(
                      technicianJobsProvider(membership.companyId).future,
                    ),
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        SizedBox(height: 120),
                        Icon(Icons.assignment_outlined, size: 56),
                        SizedBox(height: 16),
                        Center(child: Text('No assigned jobs yet.')),
                        SizedBox(height: 8),
                        Center(
                          child: Text('New assignments will appear here.'),
                        ),
                      ],
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () => ref.refresh(
                    technicianJobsProvider(membership.companyId).future,
                  ),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: jobs.length,
                    separatorBuilder: (_, index) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      return _JobCard(
                        job: jobs[index],
                        companyId: membership.companyId,
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _JobCard extends StatelessWidget {
  final ServiceJob job;
  final String companyId;

  const _JobCard({required this.job, required this.companyId});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          context.push('/jobs/$companyId/${job.id}');
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      job.title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  _StatusBadge(status: job.status),
                ],
              ),
              if (job.description.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  job.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium,
                ),
              ],
              const SizedBox(height: 14),
              Row(
                children: [
                  Icon(
                    Icons.flag_outlined,
                    size: 18,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 6),
                  Text('Priority: ${job.priority}'),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    Icons.calendar_today_outlined,
                    size: 18,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(_formatSchedule(context, job.scheduledStart)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  'View Details',
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatSchedule(BuildContext context, DateTime? date) {
    if (date == null) return 'Not scheduled';

    final localDate = date.toLocal();
    final dateText = MaterialLocalizations.of(context)
        .formatMediumDate(localDate);
    final timeText = MaterialLocalizations.of(context)
        .formatTimeOfDay(TimeOfDay.fromDateTime(localDate));

    return '$dateText at $timeText';
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    final Color color = switch (status) {
      'NEW' => colorScheme.secondary,
      'SCHEDULED' => Colors.blue,
      'IN_PROGRESS' => Colors.orange,
      'COMPLETED' => Colors.green,
      'CANCELLED' => colorScheme.error,
      _ => colorScheme.outline,
    };

    final label = status.replaceAll('_', ' ');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final VoidCallback onRetry;

  const _ErrorView({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined, size: 48),
            const SizedBox(height: 12),
            const Text(
              'Unable to load your assigned jobs.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }
}
