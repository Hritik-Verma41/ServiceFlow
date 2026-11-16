class ServiceJob {
  final String id;
  final String title;
  final String description;
  final String status;
  final String priority;
  final String customerId;
  final String serviceAddressId;
  final DateTime? scheduledStart;
  final DateTime? scheduledEnd;
  final DateTime? startedAt;
  final DateTime? completedAt;

  const ServiceJob({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    required this.priority,
    required this.customerId,
    required this.serviceAddressId,
    this.scheduledStart,
    this.scheduledEnd,
    this.startedAt,
    this.completedAt,
  });

  factory ServiceJob.fromJson(Map<String, dynamic> json) {
    return ServiceJob(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      status: json['status'] as String? ?? 'NEW',
      priority: json['priority'] as String? ?? 'MEDIUM',
      customerId: json['customer'] as String? ?? '',
      serviceAddressId: json['service_address'] as String? ?? '',
      scheduledStart: _parseDate(json['scheduled_start']),
      scheduledEnd: _parseDate(json['scheduled_end']),
      startedAt: _parseDate(json['started_at']),
      completedAt: _parseDate(json['completed_at']),
    );
  }

  static DateTime? _parseDate(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }
}
