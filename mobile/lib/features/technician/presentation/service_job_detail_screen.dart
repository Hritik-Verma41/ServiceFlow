import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:serviceflow/features/technician/data/service_job_repository.dart';
import 'package:serviceflow/features/technician/domain/job_activity.dart';
import 'package:serviceflow/features/technician/domain/job_note.dart';
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

      ref.invalidate(
        jobActivitiesProvider((
          companyId: widget.companyId,
          jobId: widget.jobId,
        )),
      );

      ref.invalidate(technicianActivitiesProvider(widget.companyId));

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
          companyId: widget.companyId,
          jobId: widget.jobId,
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
  final String companyId;
  final ServiceJob job;
  final String jobId;
  final bool isUpdating;
  final Future<void> Function(String status) onStatusUpdate;
  final Future<void> Function() onRefresh;

  const _JobDetails({
    required this.companyId,
    required this.job,
    required this.jobId,
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

          const SizedBox(height: 16),
          _JobNotesSection(companyId: companyId, jobId: jobId),

          const SizedBox(height: 16),
          _JobActivityTimeline(companyId: companyId, jobId: jobId),

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

class _JobNotesSection extends ConsumerStatefulWidget {
  final String companyId;
  final String jobId;

  const _JobNotesSection({required this.companyId, required this.jobId});

  @override
  ConsumerState<_JobNotesSection> createState() => _JobNotesSectionState();
}

class _JobNotesSectionState extends ConsumerState<_JobNotesSection> {
  final _controller = TextEditingController();

  List<JobNote> _notes = [];
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadNotes();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadNotes() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final notes = await ref
          .read(serviceJobRepositoryProvider)
          .getJobNotes(companyId: widget.companyId, jobId: widget.jobId);

      if (!mounted) return;

      setState(() {
        _notes = notes;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _error = 'Unable to load job notes.';
        _isLoading = false;
      });
    }
  }

  Future<void> _addNote() async {
    final noteText = _controller.text.trim();

    if (noteText.isEmpty || _isSubmitting) return;

    setState(() => _isSubmitting = true);

    try {
      final note = await ref
          .read(serviceJobRepositoryProvider)
          .addJobNote(
            companyId: widget.companyId,
            jobId: widget.jobId,
            note: noteText,
          );

      if (!mounted) return;

      setState(() {
        _notes = [..._notes, note];
        _controller.clear();
        _isSubmitting = false;
      });

      ref.invalidate(
        jobActivitiesProvider((
          companyId: widget.companyId,
          jobId: widget.jobId,
        )),
      );

      ref.invalidate(technicianActivitiesProvider(widget.companyId));

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Note added successfully.')));
    } catch (error) {
      if (!mounted) return;

      setState(() => _isSubmitting = false);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to add note. Please try again.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Job Notes & Updates',
      icon: Icons.notes_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _controller,
            minLines: 2,
            maxLines: 4,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              hintText: 'Add a work update or job note...',
              border: OutlineInputBorder(),
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: _isSubmitting ? null : _addNote,
            icon: _isSubmitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.add),
            label: const Text('Add Note'),
          ),
          const SizedBox(height: 20),
          const Divider(),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Previous Updates',
                style: Theme.of(context).textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              IconButton(
                tooltip: 'Refresh notes',
                onPressed: _isLoading ? null : _loadNotes,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            Column(
              children: [
                Text(_error!),
                TextButton(
                  onPressed: _loadNotes,
                  child: const Text('Try Again'),
                ),
              ],
            )
          else if (_notes.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text(
                'No notes yet. Add the first work update.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            )
          else
            ..._notes.map(
              (note) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest
                        .withValues(alpha: 0.45),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(note.note),
                      if (note.createdAt != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          _formatNoteDate(note.createdAt!),
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                              ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _formatNoteDate(DateTime date) {
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
}

class _JobActivityTimeline extends ConsumerWidget {
  final String companyId;
  final String jobId;

  const _JobActivityTimeline({required this.companyId, required this.jobId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activitiesAsync = ref.watch(
      jobActivitiesProvider((companyId: companyId, jobId: jobId)),
    );

    return _SectionCard(
      title: 'Activity Timeline',
      icon: Icons.history,
      child: activitiesAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(20),
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (error, stackTrace) => Column(
          children: [
            const Text('Unable to load activity timeline.'),
            TextButton.icon(
              onPressed: () {
                ref.invalidate(
                  jobActivitiesProvider((companyId: companyId, jobId: jobId)),
                );
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Try Again'),
            ),
          ],
        ),
        data: (activities) {
          if (activities.isEmpty) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(
                child: Text('No activity recorded for this job yet.'),
              ),
            );
          }

          return Column(
            children: [
              ...activities.asMap().entries.map((entry) {
                final index = entry.key;
                final activity = entry.value;
                final isLast = index == activities.length - 1;

                return _ActivityTimelineItem(
                  activity: activity,
                  isLast: isLast,
                );
              }),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () {
                    ref.invalidate(
                      jobActivitiesProvider((
                        companyId: companyId,
                        jobId: jobId,
                      )),
                    );
                  },
                  icon: const Icon(Icons.refresh, size: 16),
                  label: const Text('Refresh Timeline'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ActivityTimelineItem extends StatelessWidget {
  final JobActivity activity;
  final bool isLast;

  const _ActivityTimelineItem({required this.activity, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 36,
            child: Column(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _eventIcon(activity.eventType),
                    size: 16,
                    color: theme.colorScheme.onPrimaryContainer,
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: theme.colorScheme.outlineVariant,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _eventTitle(activity.eventType),
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(activity.description, style: theme.textTheme.bodyMedium),
                  const SizedBox(height: 6),
                  Text(
                    '${activity.actorName} • ${_formatDate(activity.createdAt)}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
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
}
