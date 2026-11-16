class JobActivity {
  final String id;
  final String eventType;
  final String description;
  final String? jobId;
  final String actorName;
  final DateTime? createdAt;
  final Map<String, dynamic> metadata;

  const JobActivity({
    required this.id,
    required this.eventType,
    required this.description,
    this.jobId,
    required this.actorName,
    this.createdAt,
    required this.metadata,
  });

  factory JobActivity.fromJson(Map<String, dynamic> json) {
    return JobActivity(
      id: json['id']?.toString() ?? '',
      eventType: json['event_type']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      jobId: json['job']?.toString(),
      actorName: json['actor_name']?.toString() ?? 'Team member',
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
      metadata: json['metadata'] is Map
          ? Map<String, dynamic>.from(json['metadata'] as Map)
          : {},
    );
  }
}
