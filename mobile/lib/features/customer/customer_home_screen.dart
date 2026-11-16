import 'package:flutter/material.dart';
import 'package:serviceflow/features/auth/domain/app_user.dart';

class CustomerHomeScreen extends StatelessWidget {
  final AppUser user;

  const CustomerHomeScreen({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ServiceFlow')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.home_repair_service_rounded,
                size: 64,
                color: Color(0xFF2563EB),
              ),
              const SizedBox(height: 20),
              Text(
                'Welcome, ${user.firstName}!',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Your service requests and bookings will appear here.',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
