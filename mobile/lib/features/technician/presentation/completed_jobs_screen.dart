import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:serviceflow/features/technician/data/service_job_repository.dart';
import 'package:serviceflow/features/technician/domain/service_job.dart';

class CompletedJobsScreen extends ConsumerWidget {
  final String companyId;

  const CompletedJobsScreen({super.key, required this.companyId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobsAsync = ref.watch(technicianJobsProvider(companyId));

    return Scaffold(
      appBar: AppBar(title: const Text('Completed Jobs')),
      body: jobsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_outlined, size: 48),
                const SizedBox(height: 12),
                const Text('Unable to load completed jobs.'),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () {
                    ref.invalidate(technicianJobsProvider(companyId));
                  },
                  icon: const Icon(Icons.refresh),
                  label: const Text('Try Again'),
                ),
              ],
            ),
          ),
        ),
        data: (jobs) {
          final completedJobs =
              jobs.where((job) => job.status == 'COMPLETED').toList()
                ..sort((a, b) {
                  if (a.completedAt == null && b.completedAt == null) {
                    return 0;
                  }
                  if (a.completedAt == null) return 1;
                  if (b.completedAt == null) return -1;

                  return b.completedAt!.compareTo(a.completedAt!);
                });

          return RefreshIndicator(
            onRefresh: () =>
                ref.refresh(technicianJobsProvider(companyId).future),
            child: completedJobs.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      SizedBox(height: 140),
                      Icon(Icons.task_alt_outlined, size: 56),
                      SizedBox(height: 16),
                      Center(child: Text('No completed jobs yet.')),
                      SizedBox(height: 8),
                      Center(
                        child: Text('Your completed jobs will appear here.'),
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: completedJobs.length,
                    separatorBuilder: (_, index) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      return _CompletedJobCard(
                        job: completedJobs[index],
                        companyId: companyId,
                      );
                    },
                  ),
          );
        },
      ),
    );
  }
}

class _CompletedJobCard extends StatelessWidget {
  final ServiceJob job;
  final String companyId;

  const _CompletedJobCard({required this.job, required this.companyId});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final completedAt = job.completedAt?.toLocal();

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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      job.title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.green.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'COMPLETED',
                      style: TextStyle(
                        color: Colors.green,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
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
                  const SizedBox(width: 8),
                  Text('Priority: ${job.priority}'),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    Icons.event_available_outlined,
                    size: 18,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      completedAt == null
                          ? 'Completion date unavailable'
                          : 'Completed ${MaterialLocalizations.of(context).formatMediumDate(completedAt)} at ${MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(completedAt))}',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  'View Job Details →',
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
}
