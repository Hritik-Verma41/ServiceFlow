import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:serviceflow/features/technician/data/service_job_repository.dart';
import 'package:serviceflow/features/technician/domain/service_job.dart';

class ServiceJobDetailScreen extends ConsumerStatefulWidget {
  final String companyId;
  final String jobId;

  const ServiceJobDetailScreen({
    super.key,
    required this.companyId,
    required this.jobId,
  });

  @override
  ConsumerState<ServiceJobDetailScreen> createState() =>
      _ServiceJobDetailScreenState();
}

class _ServiceJobDetailScreenState
    extends ConsumerState<ServiceJobDetailScreen> {
  bool _isUpdating = false;

  Future<void> _updateStatus(String status) async {
    if (_isUpdating) return;

    setState(() => _isUpdating = true);

    try {
      await ref
          .read(serviceJobRepositoryProvider)
          .updateJobStatus(
            companyId: widget.companyId,
            jobId: widget.jobId,
            status: status,
          );

      final detailProvider = serviceJobDetailProvider((
        companyId: widget.companyId,
        jobId: widget.jobId,
      ));

      ref.invalidate(detailProvider);
      ref.invalidate(technicianJobsProvider(widget.companyId));

      await ref.read(detailProvider.future);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            status == 'IN_PROGRESS'
                ? 'Work started successfully.'
                : 'Job completed successfully.',
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to update job status. Please try again.'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isUpdating = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final jobAsync = ref.watch(
      serviceJobDetailProvider((
        companyId: widget.companyId,
        jobId: widget.jobId,
      )),
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Job Details')),
      body: jobAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => _ErrorView(
          onRetry: () {
            ref.invalidate(
              serviceJobDetailProvider((
                companyId: widget.companyId,
                jobId: widget.jobId,
              )),
            );
          },
        ),
        data: (job) => _JobDetails(
          job: job,
          isUpdating: _isUpdating,
          onStatusUpdate: _updateStatus,
          onRefresh: () async {
            final _ = await ref.refresh(
              serviceJobDetailProvider((
                companyId: widget.companyId,
                jobId: widget.jobId,
              )).future,
            );
          },
        ),
      ),
    );
  }
}

class _JobDetails extends StatelessWidget {
  final ServiceJob job;
  final bool isUpdating;
  final Future<void> Function(String status) onStatusUpdate;
  final Future<void> Function() onRefresh;

  const _JobDetails({
    required this.job,
    required this.isUpdating,
    required this.onStatusUpdate,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            job.title,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _InfoBadge(
                label: job.status.replaceAll('_', ' '),
                color: _statusColor(job.status, theme.colorScheme),
              ),
              _InfoBadge(
                label: '${job.priority} Priority',
                color: _priorityColor(job.priority, theme.colorScheme),
              ),
            ],
          ),
          const SizedBox(height: 24),
          _SectionCard(
            title: 'Job Description',
            icon: Icons.description_outlined,
            child: Text(
              job.description.isNotEmpty
                  ? job.description
                  : 'No description provided.',
              style: theme.textTheme.bodyMedium,
            ),
          ),
          const SizedBox(height: 16),
          _SectionCard(
            title: 'Customer & Service Address',
            icon: Icons.location_on_outlined,
            child: Column(
              children: [
                _DetailRow(
                  label: 'Customer ID',
                  value: _displayId(job.customerId),
                ),
                const Divider(height: 20),
                _DetailRow(
                  label: 'Service Address ID',
                  value: _displayId(job.serviceAddressId),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _SectionCard(
            title: 'Schedule',
            icon: Icons.calendar_month_outlined,
            child: Column(
              children: [
                _DetailRow(
                  label: 'Scheduled Start',
                  value: _formatDateTime(job.scheduledStart),
                ),
                const Divider(height: 20),
                _DetailRow(
                  label: 'Scheduled End',
                  value: _formatDateTime(job.scheduledEnd),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _SectionCard(
            title: 'Job Timeline',
            icon: Icons.timeline_outlined,
            child: Column(
              children: [
                _DetailRow(
                  label: 'Started At',
                  value: _formatDateTime(job.startedAt),
                ),
                const Divider(height: 20),
                _DetailRow(
                  label: 'Completed At',
                  value: _formatDateTime(job.completedAt),
                ),
              ],
            ),
          ),

          // Technician job actions
          if (job.status == 'SCHEDULED' || job.status == 'IN_PROGRESS') ...[
            const SizedBox(height: 20),
            _SectionCard(
              title: 'Job Actions',
              icon: Icons.engineering_outlined,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (job.status == 'SCHEDULED')
                    FilledButton.icon(
                      onPressed: isUpdating
                          ? null
                          : () => onStatusUpdate('IN_PROGRESS'),
                      icon: isUpdating
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.play_arrow),
                      label: const Text('Start Work'),
                    ),
                  if (job.status == 'IN_PROGRESS')
                    FilledButton.icon(
                      onPressed: isUpdating
                          ? null
                          : () => onStatusUpdate('COMPLETED'),
                      icon: isUpdating
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.check_circle_outline),
                      label: const Text('Complete Job'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.green,
                      ),
                    ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  String _displayId(String value) {
    return value.isEmpty ? 'Not available' : value;
  }

  String _formatDateTime(DateTime? date) {
    if (date == null) return 'Not available';

    final localDate = date.toLocal();
    final dateText =
        '${localDate.day.toString().padLeft(2, '0')}/'
        '${localDate.month.toString().padLeft(2, '0')}/'
        '${localDate.year}';

    final hour = localDate.hour % 12 == 0 ? 12 : localDate.hour % 12;
    final minute = localDate.minute.toString().padLeft(2, '0');
    final period = localDate.hour >= 12 ? 'PM' : 'AM';

    return '$dateText at $hour:$minute $period';
  }

  Color _statusColor(String status, ColorScheme scheme) {
    return switch (status) {
      'NEW' => scheme.secondary,
      'SCHEDULED' => Colors.blue,
      'IN_PROGRESS' => Colors.orange,
      'COMPLETED' => Colors.green,
      'CANCELLED' => scheme.error,
      _ => scheme.outline,
    };
  }

  Color _priorityColor(String priority, ColorScheme scheme) {
    return switch (priority) {
      'LOW' => Colors.green,
      'MEDIUM' => Colors.blue,
      'HIGH' => Colors.orange,
      'URGENT' => scheme.error,
      _ => scheme.outline,
    };
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: theme.colorScheme.primary),
                const SizedBox(width: 10),
                Text(
                  title,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoBadge extends StatelessWidget {
  final String label;
  final Color color;

  const _InfoBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.bold,
          fontSize: 12,
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
              'Unable to load job details.',
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
