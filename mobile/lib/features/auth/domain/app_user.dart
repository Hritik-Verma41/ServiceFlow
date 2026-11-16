class CompanyMembership {
  final String companyId;
  final String companyName;
  final String role;
  final String status;

  const CompanyMembership({
    required this.companyId,
    required this.companyName,
    required this.role,
    required this.status,
  });

  factory CompanyMembership.fromJson(Map<String, dynamic> json) {
    return CompanyMembership(
      companyId: json['company_id'] as String,
      companyName: json['company_name'] as String,
      role: json['role'] as String,
      status: json['status'] as String,
    );
  }
}

class AppUser {
  final String id;
  final String firstName;
  final String lastName;
  final String fullName;
  final String email;
  final String phone;
  final List<CompanyMembership> memberships;

  const AppUser({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.fullName,
    required this.email,
    required this.phone,
    required this.memberships,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as String,
      firstName: json['first_name'] as String? ?? '',
      lastName: json['last_name'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      email: json['email'] as String,
      phone: json['phone'] as String? ?? '',
      memberships: (json['memberships'] as List<dynamic>? ?? [])
          .map(
            (membership) =>
                CompanyMembership.fromJson(membership as Map<String, dynamic>),
          )
          .toList(),
    );
  }

  bool get isCustomer =>
      memberships.any((membership) => membership.role == 'CUSTOMER');

  bool get isTechnician =>
      memberships.any((membership) => membership.role == 'TECHNICIAN');

  bool get isManager =>
      memberships.any((membership) => membership.role == 'MANAGER');

  bool get isCompanyAdmin =>
      memberships.any((membership) => membership.role == 'COMPANY_ADMIN');
}
