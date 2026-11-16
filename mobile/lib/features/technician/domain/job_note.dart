class JobNote {
  final String id;
  final String jobId;
  final String createdBy;
  final String note;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const JobNote({
    required this.id,
    required this.jobId,
    required this.createdBy,
    required this.note,
    this.createdAt,
    this.updatedAt,
  });

  factory JobNote.fromJson(Map<String, dynamic> json) {
    return JobNote(
      id: json['id']?.toString() ?? '',
      jobId: json['job']?.toString() ?? '',
      createdBy: json['created_by']?.toString() ?? '',
      note: json['note']?.toString() ?? '',
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'].toString())
          : null,
    );
  }
}
