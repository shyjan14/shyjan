import 'package:flutter_test/flutter_test.dart';
import 'package:hrms_app/core/format.dart';

void main() {
  test('formats minutes as hours', () {
    expect(fmtMins(0), '0h 00m');
    expect(fmtMins(545), '9h 05m');
  });

  test('shows times in UAE time (UTC+4)', () {
    expect(fmtTime('2026-11-09T05:30:00.000Z'), '09:30 AM');
  });

  test('labels enum values for display', () {
    expect(label('EMIRATES_ID'), 'Emirates ID');
    expect(label('PENDING_HR'), 'Pending HR');
  });
}
