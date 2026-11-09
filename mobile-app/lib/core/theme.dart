import 'package:flutter/material.dart';

class AppColors {
  static const brand = Color(0xFF0F766E);
  static const brandDark = Color(0xFF115E59);
  static const brandLight = Color(0xFFCCFBF1);
  static const present = Color(0xFF16A34A);
  static const late = Color(0xFFF59E0B);
  static const absent = Color(0xFFDC2626);
  static const leave = Color(0xFF2563EB);
  static const breakColor = Color(0xFF7C3AED);
  static const muted = Color(0xFF64748B);
  static const surface = Color(0xFFF8FAFC);
  static const text = Color(0xFF0F172A);

  static Color forStatus(String? s) {
    switch (s) {
      case 'PRESENT':
      case 'APPROVED':
      case 'ACTIVE':
        return present;
      case 'LATE':
      case 'PENDING_MANAGER':
      case 'PENDING_HR':
      case 'HALF_DAY':
      case 'MISSED_PUNCH':
        return late;
      case 'ABSENT':
      case 'REJECTED':
        return absent;
      case 'ON_LEAVE':
        return leave;
      case 'ON_BREAK':
        return breakColor;
      default:
        return muted;
    }
  }
}

ThemeData buildTheme(Brightness b) {
  final scheme = ColorScheme.fromSeed(seedColor: AppColors.brand, brightness: b, primary: b == Brightness.light ? AppColors.brand : const Color(0xFF2DD4BF));
  final light = b == Brightness.light;
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: light ? AppColors.surface : const Color(0xFF0B1220),
    appBarTheme: AppBarTheme(
      backgroundColor: light ? AppColors.surface : const Color(0xFF0B1220),
      foregroundColor: light ? AppColors.text : Colors.white,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: light ? AppColors.text : Colors.white),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: light ? Colors.white : const Color(0xFF111A2E),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: light ? const Color(0xFFE2E8F0) : const Color(0xFF1E293B)),
      ),
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: light ? Colors.white : const Color(0xFF111A2E),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: light ? const Color(0xFFCBD5E1) : const Color(0xFF334155)),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: light ? Colors.white : const Color(0xFF111A2E),
      indicatorColor: light ? AppColors.brandLight : AppColors.brandDark,
      labelTextStyle: WidgetStateProperty.all(const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
    ),
  );
}
