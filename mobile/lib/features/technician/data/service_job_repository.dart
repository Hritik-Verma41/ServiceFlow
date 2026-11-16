import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:serviceflow/core/network/api_client.dart';
import 'package:serviceflow/features/technician/domain/service_job.dart';

final serviceJobRepositoryProvider = Provider<ServiceJobRepository>((ref) {
  return ServiceJobRepository();
});

final technicianJobsProvider = FutureProvider.family<List<ServiceJob>, String>((
  ref,
  companyId,
) async {
  return ref.read(serviceJobRepositoryProvider).getAssignedJobs(companyId);
});

final serviceJobDetailProvider =
    FutureProvider.family<ServiceJob, ({String companyId, String jobId})>((
      ref,
      params,
    ) async {
      return ref
          .read(serviceJobRepositoryProvider)
          .getJob(companyId: params.companyId, jobId: params.jobId);
    });

class ServiceJobRepository {
  Future<List<ServiceJob>> getAssignedJobs(String companyId) async {
    final response = await ApiClient.dio.get('/api/companies/$companyId/jobs/');

    final data = response.data;

    final List<dynamic> results;

    if (data is List) {
      results = data;
    } else if (data is Map<String, dynamic> && data['results'] is List) {
      results = data['results'] as List<dynamic>;
    } else {
      throw Exception('Invalid service jobs response.');
    }

    return results
        .map((item) => ServiceJob.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<ServiceJob> getJob({
    required String companyId,
    required String jobId,
  }) async {
    final response = await ApiClient.dio.get(
      '/api/companies/$companyId/jobs/$jobId/',
    );

    if (response.data is! Map<String, dynamic>) {
      throw Exception('Invalid service job details response.');
    }

    return ServiceJob.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> updateJobStatus({
    required String companyId,
    required String jobId,
    required String status,
  }) async {
    await ApiClient.dio.post(
      '/api/companies/$companyId/jobs/$jobId/status/',
      data: {'status': status},
    );
  }
}
