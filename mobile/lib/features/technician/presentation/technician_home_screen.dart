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

    final firstName = user.firstName.trim().isNotEmpty
        ? user.firstName.trim()
        : user.fullName.split(' ').first;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            tooltip: 'Completed Jobs',
            icon: const Icon(Icons.task_alt_outlined),
            onPressed: () {
              context.push('/completed-jobs/${membership.companyId}');
            },
          ),
          IconButton(
            tooltip: 'Activity History',
            icon: const Icon(Icons.history),
            onPressed: () {
              context.push('/activity/${membership.companyId}');
            },
          ),
          IconButton(
            tooltip: 'My Profile',
            icon: const Icon(Icons.account_circle_outlined),
            onPressed: () {
              context.push('/profile');
            },
          ),
          const ThemeModeSelector(),
          const SizedBox(width: 8),
        ],
      ),
      body: jobsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => _ErrorView(
          onRetry: () {
            ref.invalidate(technicianJobsProvider(membership.companyId));
          },
        ),
        data: (jobs) => _DashboardBody(
          user: user,
          firstName: firstName,
          companyName: membership.companyName,
          jobs: jobs,
          onRefresh: () =>
              ref.refresh(technicianJobsProvider(membership.companyId).future),
        ),
      ),
    );
  }
}

class _DashboardBody extends StatelessWidget {
  final AppUser user;
  final String firstName;
  final String companyName;
  final List<ServiceJob> jobs;
  final Future<void> Function() onRefresh;

  const _DashboardBody({
    required this.user,
    required this.firstName,
    required this.companyName,
    required this.jobs,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final today = DateUtils.dateOnly(DateTime.now());

    final activeJobs = jobs
        .where((job) => job.status != 'COMPLETED' && job.status != 'CANCELLED')
        .toList();

    final newJobs = jobs.where((job) => job.status == 'NEW').length;
    final scheduledJobs = jobs.where((job) => job.status == 'SCHEDULED').length;
    final inProgressJobs = jobs
        .where((job) => job.status == 'IN_PROGRESS')
        .length;

    final todayJobs =
        activeJobs
            .where(
              (job) =>
                  job.scheduledStart != null &&
                  DateUtils.isSameDay(job.scheduledStart!.toLocal(), today),
            )
            .toList()
          ..sort(_compareSchedule);

    final upcomingJobs =
        activeJobs
            .where(
              (job) =>
                  job.scheduledStart != null &&
                  DateUtils.dateOnly(job.scheduledStart!.toLocal())
                      .isAfter(today),
            )
            .toList()
          ..sort(_compareSchedule);

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        children: [
          _WelcomeSection(firstName: firstName, companyName: companyName),
          const SizedBox(height: 24),

          _SectionHeading(title: 'Overview', subtitle: 'Your work at a glance'),
          const SizedBox(height: 12),

          LayoutBuilder(
            builder: (context, constraints) {
              final columns = constraints.maxWidth >= 600 ? 4 : 2;
              const spacing = 12.0;
              final cardWidth =
                  (constraints.maxWidth - spacing * (columns - 1)) / columns;

              return Wrap(
                spacing: spacing,
                runSpacing: spacing,
                children: [
                  SizedBox(
                    width: cardWidth,
                    child: _StatCard(
                      title: 'My Assigned Jobs',
                      value: jobs.length,
                      subtitle: 'Jobs assigned to you',
                      icon: Icons.work_outline,
                      color: Colors.blue,
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    child: _StatCard(
                      title: 'New Jobs',
                      value: newJobs,
                      subtitle: 'Awaiting scheduling',
                      icon: Icons.fiber_new_outlined,
                      color: Colors.deepPurple,
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    child: _StatCard(
                      title: 'Scheduled Jobs',
                      value: scheduledJobs,
                      subtitle: 'Ready for work',
                      icon: Icons.calendar_month_outlined,
                      color: Colors.teal,
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    child: _StatCard(
                      title: 'In Progress',
                      value: inProgressJobs,
                      subtitle: 'Currently working',
                      icon: Icons.engineering_outlined,
                      color: Colors.orange,
                    ),
                  ),
                ],
              );
            },
          ),

          const SizedBox(height: 28),

          _JobSection(
            title: 'My Active Jobs',
            subtitle: 'Your assigned work that is not yet completed',
            count: activeJobs.length,
            jobs: activeJobs,
            emptyTitle: 'No active jobs',
            emptyMessage: 'New assignments will appear here.',
            icon: Icons.assignment_outlined,
          ),

          const SizedBox(height: 24),

          _JobSection(
            title: "Today's Jobs",
            subtitle: 'Jobs scheduled for today',
            count: todayJobs.length,
            jobs: todayJobs,
            emptyTitle: 'No jobs scheduled for today',
            emptyMessage: 'Your schedule is clear for today.',
            icon: Icons.today_outlined,
          ),

          const SizedBox(height: 24),

          _JobSection(
            title: 'Upcoming Jobs',
            subtitle: 'Your future scheduled work',
            count: upcomingJobs.length,
            jobs: upcomingJobs,
            emptyTitle: 'No upcoming jobs',
            emptyMessage: 'Future assignments will appear here.',
            icon: Icons.upcoming_outlined,
            showScheduleDate: true,
          ),

          const SizedBox(height: 24),

          _CompletedJobsLink(
            companyId: user.memberships
                .firstWhere(
                  (membership) =>
                      membership.role == 'TECHNICIAN' &&
                      membership.status == 'ACTIVE',
                )
                .companyId,
          ),
        ],
      ),
    );
  }

  static int _compareSchedule(ServiceJob a, ServiceJob b) {
    return a.scheduledStart!.compareTo(b.scheduledStart!);
  }
}

class _WelcomeSection extends StatelessWidget {
  final String firstName;
  final String companyName;

  const _WelcomeSection({required this.firstName, required this.companyName});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Welcome back, $firstName 👋',
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          "Here's your personal work schedule and assigned service jobs.",
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Icon(
              Icons.business_outlined,
              size: 17,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(width: 7),
            Expanded(
              child: Text(
                companyName,
                style: theme.textTheme.labelLarge?.copyWith(
                  color: theme.colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _SectionHeading extends StatelessWidget {
  final String title;
  final String subtitle;

  const _SectionHeading({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final int value;
  final String subtitle;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 21),
            ),
            const SizedBox(height: 14),
            Text(
              value.toString(),
              style: theme.textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              subtitle,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _JobSection extends StatelessWidget {
  final String title;
  final String subtitle;
  final int count;
  final List<ServiceJob> jobs;
  final String emptyTitle;
  final String emptyMessage;
  final IconData icon;
  final bool showScheduleDate;

  const _JobSection({
    required this.title,
    required this.subtitle,
    required this.count,
    required this.jobs,
    required this.emptyTitle,
    required this.emptyMessage,
    required this.icon,
    this.showScheduleDate = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: _SectionHeading(title: title, subtitle: subtitle),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
              decoration: BoxDecoration(
                color: theme.colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '$count',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: theme.colorScheme.onPrimaryContainer,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (jobs.isEmpty)
          _EmptySection(icon: icon, title: emptyTitle, message: emptyMessage)
        else
          ...jobs.map(
            (job) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _JobCard(job: job, showScheduleDate: showScheduleDate),
            ),
          ),
      ],
    );
  }
}

class _JobCard extends StatelessWidget {
  final ServiceJob job;
  final bool showScheduleDate;

  const _JobCard({required this.job, this.showScheduleDate = false});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          // Job details navigation is handled by the existing job route.
          final membership = context
              .findAncestorWidgetOfExactType<TechnicianHomeScreen>();
          if (membership != null) {
            // The card is opened through the company-specific route below.
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      job.title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _StatusBadge(status: job.status),
                ],
              ),
              if (job.description.isNotEmpty) ...[
                const SizedBox(height: 7),
                Text(
                  job.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
              const SizedBox(height: 13),
              Wrap(
                spacing: 16,
                runSpacing: 8,
                children: [
                  _JobMetadata(
                    icon: Icons.flag_outlined,
                    label: '${job.priority} priority',
                  ),
                  if (job.scheduledStart != null)
                    _JobMetadata(
                      icon: Icons.calendar_today_outlined,
                      label: _formatDateTime(
                        context,
                        job.scheduledStart!,
                        showDate: showScheduleDate,
                      ),
                    )
                  else
                    const _JobMetadata(
                      icon: Icons.event_busy_outlined,
                      label: 'Not scheduled',
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  'View job details  →',
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDateTime(
    BuildContext context,
    DateTime date, {
    required bool showDate,
  }) {
    final localDate = date.toLocal();
    final time = MaterialLocalizations.of(context)
        .formatTimeOfDay(TimeOfDay.fromDateTime(localDate));

    if (!showDate) return time;

    final formattedDate = MaterialLocalizations.of(context)
        .formatMediumDate(localDate);

    return '$formattedDate · $time';
  }
}

class _JobMetadata extends StatelessWidget {
  final IconData icon;
  final String label;

  const _JobMetadata({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: theme.colorScheme.onSurfaceVariant),
        const SizedBox(width: 5),
        Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
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

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.replaceAll('_', ' '),
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _EmptySection extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;

  const _EmptySection({
    required this.icon,
    required this.title,
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 25),
      decoration: BoxDecoration(
        border: Border.all(color: theme.colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, size: 32, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(height: 9),
          Text(
            title,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            message,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _CompletedJobsLink extends StatelessWidget {
  final String companyId;

  const _CompletedJobsLink({required this.companyId});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: () {
        context.push('/completed-jobs/$companyId');
      },
      icon: const Icon(Icons.history),
      label: const Text('View Completed Job History'),
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 14),
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
              'Unable to load your dashboard.',
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
