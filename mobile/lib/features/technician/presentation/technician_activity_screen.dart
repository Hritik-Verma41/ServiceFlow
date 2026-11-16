import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:serviceflow/features/technician/data/service_job_repository.dart';
import 'package:serviceflow/features/technician/domain/job_activity.dart';

class TechnicianActivityScreen extends ConsumerWidget {
  final String companyId;

  const TechnicianActivityScreen({super.key, required this.companyId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activitiesAsync = ref.watch(technicianActivitiesProvider(companyId));

    return Scaffold(
      appBar: AppBar(title: const Text('Activity History')),
      body: activitiesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_outlined, size: 48),
                const SizedBox(height: 12),
                const Text('Unable to load activity history.'),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () {
                    ref.invalidate(technicianActivitiesProvider(companyId));
                  },
                  icon: const Icon(Icons.refresh),
                  label: const Text('Try Again'),
                ),
              ],
            ),
          ),
        ),
        data: (activities) {
          if (activities.isEmpty) {
            return RefreshIndicator(
              onRefresh: () =>
                  ref.refresh(technicianActivitiesProvider(companyId).future),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 140),
                  Icon(Icons.history, size: 56),
                  SizedBox(height: 16),
                  Center(child: Text('No activity recorded yet.')),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () =>
                ref.refresh(technicianActivitiesProvider(companyId).future),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: activities.length,
              separatorBuilder: (_, index) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                return _ActivityCard(activity: activities[index]);
              },
            ),
          );
        },
      ),
    );
  }
}

class _ActivityCard extends StatelessWidget {
  final JobActivity activity;

  const _ActivityCard({required this.activity});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final icon = _eventIcon(activity.eventType);

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: activity.jobId == null
            ? null
            : () {
                context.push(
                  '/jobs/${_companyIdFromContext(context)}/${activity.jobId}',
                );
              },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                backgroundColor: theme.colorScheme.primaryContainer,
                child: Icon(icon, color: theme.colorScheme.onPrimaryContainer),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _eventTitle(activity.eventType),
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(activity.description),
                    const SizedBox(height: 8),
                    Text(
                      '${activity.actorName} • ${_formatDate(activity.createdAt)}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    if (activity.jobId != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        'View job details →',
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: theme.colorScheme.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _eventIcon(String eventType) {
    return switch (eventType) {
      'JOB_CREATED' => Icons.add_task,
      'JOB_STATUS_CHANGED' => Icons.sync,
      'TECHNICIAN_ASSIGNED' => Icons.person_add_alt_1,
      'COMPLETION_REPORT_SUBMITTED' => Icons.assignment_turned_in,
      'NOTE_ADDED' => Icons.note_add_outlined,
      'INVOICE_CREATED' => Icons.receipt_long,
      'PAYMENT_RECEIVED' => Icons.payments_outlined,
      _ => Icons.history,
    };
  }

  String _eventTitle(String eventType) {
    return switch (eventType) {
      'JOB_CREATED' => 'Job Created',
      'JOB_STATUS_CHANGED' => 'Status Updated',
      'TECHNICIAN_ASSIGNED' => 'Technician Assigned',
      'COMPLETION_REPORT_SUBMITTED' => 'Completion Report',
      'NOTE_ADDED' => 'Note Added',
      'INVOICE_CREATED' => 'Invoice Created',
      'PAYMENT_RECEIVED' => 'Payment Received',
      _ => eventType.replaceAll('_', ' '),
    };
  }

  String _formatDate(DateTime? date) {
    if (date == null) return 'Date unavailable';

    final local = date.toLocal();
    final dateText =
        '${local.day.toString().padLeft(2, '0')}/'
        '${local.month.toString().padLeft(2, '0')}/'
        '${local.year}';

    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';

    return '$dateText at $hour:$minute $period';
  }

  String _companyIdFromContext(BuildContext context) {
    return GoRouterState.of(context).pathParameters['companyId'] ?? '';
  }
}
