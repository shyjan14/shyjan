import 'package:intl/intl.dart';

/// All times are shown in UAE time (UTC+4, no daylight saving).
DateTime toUae(DateTime t) => t.toUtc().add(const Duration(hours: 4));
String fmtTime(String? iso) => iso == null ? '--:--' : DateFormat('hh:mm a').format(toUae(DateTime.parse(iso)));
String fmtDate(String? s) => s == null ? '—' : DateFormat('d MMM yyyy').format(DateTime.parse(s.length == 10 ? '${s}T00:00:00Z' : s).toUtc());
String fmtShortDate(String s) => DateFormat('d MMM').format(DateTime.parse('${s}T00:00:00Z').toUtc());
String fmtMins(int m) => '${m ~/ 60}h ${(m % 60).toString().padLeft(2, '0')}m';
String label(String s) {
  final t = s.replaceAll('_', ' ').toLowerCase();
  return (t.isEmpty ? t : t[0].toUpperCase() + t.substring(1)).replaceAllMapped(RegExp(r'\b(id|hr)\b'), (m) => m[0]!.toUpperCase());
}

String isoDate(DateTime d) => DateFormat('yyyy-MM-dd').format(d);
DateTime uaeToday() => toUae(DateTime.now());
