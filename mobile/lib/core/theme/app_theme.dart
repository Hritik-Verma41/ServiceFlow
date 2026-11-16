import 'package:flutter/material.dart';

class AppTheme {
  AppTheme._();

  static const Color primary = Color(0xFF2563EB);

  static ThemeData get light {
    return _buildTheme(
      brightness: Brightness.light,
      background: const Color(0xFFF8FAFC),
      surface: Colors.white,
      textPrimary: const Color(0xFF0F172A),
      textSecondary: const Color(0xFF64748B),
      border: const Color(0xFFE2E8F0),
    );
  }

  static ThemeData get dark {
    return _buildTheme(
      brightness: Brightness.dark,
      background: const Color(0xFF0B1120),
      surface: const Color(0xFF151F32),
      textPrimary: const Color(0xFFF1F5F9),
      textSecondary: const Color(0xFF94A3B8),
      border: const Color(0xFF29364B),
    );
  }

  static ThemeData _buildTheme({
    required Brightness brightness,
    required Color background,
    required Color surface,
    required Color textPrimary,
    required Color textSecondary,
    required Color border,
  }) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primary,
      brightness: brightness,
      surface: surface,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme.copyWith(
        primary: primary,
        surface: surface,
        onSurface: textPrimary,
      ),
      scaffoldBackgroundColor: background,
      appBarTheme: AppBarTheme(
        backgroundColor: surface,
        foregroundColor: textPrimary,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: border),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        hintStyle: TextStyle(color: textSecondary),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primary, width: 1.5),
        ),
      ),
      textTheme: ThemeData(brightness: brightness).textTheme
          .apply(bodyColor: textPrimary, displayColor: textPrimary),
      dividerColor: border,
    );
  }
}
