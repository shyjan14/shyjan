import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});
  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  DateTime month = DateTime(uaeToday().year, uaeToday().month);
  Key key = UniqueKey();

  String get _m => '${month.year}-${month.month.toString().padLeft(2, '0')}';

  void _shift(int d) => setState(() {
    month = DateTime(month.year, month.month + d);
    key = UniqueKey();
  });

  @override
  Widget build(BuildContext context) {
    final now = uaeToday();
    final isCurrent = month.year == now.year && month.month == now.month;
    return Scaffold(
      appBar: AppBar(
        title: const Text('My attendance'),
        actions: [IconButton(tooltip: 'Request correction', icon: const Icon(Icons.edit_calendar_outlined), onPressed: () => _regularize(context, null))],
      ),
      body: Loader<dynamic>(
        key: key,
        load: () => Api.instance.get('/attendance/me?month=$_m'),
        builder: (context, data, reload) {
          final days = {for (final d in data['days']) d['date'] as String: d};
          final s = data['summary'];
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    IconButton(tooltip: 'Previous month', onPressed: () => _shift(-1), icon: const Icon(Icons.chevron_left)),
                    Expanded(
                      child: Text(
                        _monthName(month),
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
                      ),
                    ),
                    IconButton(tooltip: 'Next month', onPressed: isCurrent ? null : () => _shift(1), icon: const Icon(Icons.chevron_right)),
                  ],
                ),
                const SizedBox(height: 8),
                Section(padding: const EdgeInsets.all(12), child: _calendar(days)),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 14,
                  runSpacing: 6,
                  children: [
                    for (final e in {
                      'Present': AppColors.present,
                      'Late': AppColors.late,
                      'Absent': AppColors.absent,
                      'Leave': AppColors.leave,
                      'Off / holiday': AppColors.muted,
                    }.entries)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(color: e.value, shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 6),
                          Text(e.key, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                        ],
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                Section(
                  title: 'Summary',
                  child: Column(
                    children: [
                      _row('Days present', '${s['PRESENT'] + s['LATE']}'),
                      _row('Late arrivals', '${s['LATE']} (${s['lateMinutes']} min)'),
                      _row('Absent', '${s['ABSENT']}'),
                      _row('On leave', '${s['ON_LEAVE']}'),
                      _row('Missed punch', '${s['MISSED_PUNCH']}'),
                      _row('Total worked', fmtMins(s['workMinutes'])),
                      _row('Overtime', fmtMins(s['overtimeMinutes'])),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  String _monthName(DateTime m) =>
      '${const ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m.month - 1]} ${m.year}';

  Widget _row(String k, String v) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      children: [
        Expanded(
          child: Text(k, style: const TextStyle(color: AppColors.muted)),
        ),
        Text(v, style: const TextStyle(fontWeight: FontWeight.w600)),
      ],
    ),
  );

  Widget _calendar(Map<String, dynamic> days) {
    final first = DateTime(month.year, month.month, 1);
    final count = DateTime(month.year, month.month + 1, 0).day;
    final lead = first.weekday % 7; // Sunday first
    final today = isoDate(uaeToday());
    return Column(
      children: [
        Row(
          children: [
            for (final d in ['S', 'M', 'T', 'W', 'T', 'F', 'S'])
              Expanded(
                child: Center(
                  child: Text(
                    d,
                    style: const TextStyle(color: AppColors.muted, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        GridView.count(
          crossAxisCount: 7,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 6,
          crossAxisSpacing: 6,
          children: [
            for (var i = 0; i < lead; i++) const SizedBox(),
            for (var d = 1; d <= count; d++)
              Builder(
                builder: (context) {
                  final iso = '${month.year}-${month.month.toString().padLeft(2, '0')}-${d.toString().padLeft(2, '0')}';
                  final rec = days[iso];
                  final c = rec == null ? null : AppColors.forStatus(rec['status']);
                  final isToday = iso == today;
                  return InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: rec == null ? null : () => _dayDetail(context, rec),
                    child: Container(
                      decoration: BoxDecoration(
                        color: c?.withValues(alpha: .14),
                        borderRadius: BorderRadius.circular(10),
                        border: isToday ? Border.all(color: AppColors.brand, width: 2) : null,
                      ),
                      alignment: Alignment.center,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            '$d',
                            style: TextStyle(fontWeight: FontWeight.w600, color: c),
                          ),
                          if (c != null)
                            Container(
                              margin: const EdgeInsets.only(top: 2),
                              width: 5,
                              height: 5,
                              decoration: BoxDecoration(color: c, shape: BoxShape.circle),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ],
    );
  }

  void _dayDetail(BuildContext context, Map<String, dynamic> d) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(fmtDate(d['date']), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                ),
                StatusChip(d['status']),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Worked ${fmtMins(d['workMinutes'])} · Break ${fmtMins(d['breakMinutes'])}${d['lateMinutes'] > 0 ? ' · Late ${d['lateMinutes']}m' : ''}${d['overtimeMinutes'] > 0 ? ' · OT ${fmtMins(d['overtimeMinutes'])}' : ''}',
              style: const TextStyle(color: AppColors.muted),
            ),
            const Divider(height: 24),
            for (final p in d['punches'])
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(child: Text(label(p['type']))),
                    if (p['distanceM'] != null) Text('${p['distanceM']} m  ', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                    Text(fmtTime(p['serverTime']), style: const TextStyle(fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            if ((d['punches'] as List).isEmpty) const Text('No punches', style: TextStyle(color: AppColors.muted)),
            const SizedBox(height: 16),
            if (['MISSED_PUNCH', 'ABSENT', 'HALF_DAY', 'LATE'].contains(d['status']))
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  _regularize(context, d['date']);
                },
                icon: const Icon(Icons.edit_calendar_outlined),
                label: const Text('Request correction'),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _regularize(BuildContext context, String? date) async {
    final ok = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => RegularizationScreen(date: date)));
    if (ok == true && context.mounted) {
      toast(context, 'Correction request sent to your manager');
      setState(() => key = UniqueKey());
    }
  }
}

class RegularizationScreen extends StatefulWidget {
  const RegularizationScreen({super.key, this.date});
  final String? date;
  @override
  State<RegularizationScreen> createState() => _RegularizationScreenState();
}

class _RegularizationScreenState extends State<RegularizationScreen> {
  late DateTime date = widget.date != null ? DateTime.parse(widget.date!) : uaeToday();
  TimeOfDay? inT = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay? outT = const TimeOfDay(hour: 18, minute: 0);
  final reason = TextEditingController();
  bool busy = false;

  String? _iso(TimeOfDay? t) {
    if (t == null) return null;
    // UAE local time → UTC instant
    return DateTime.utc(date.year, date.month, date.day, t.hour, t.minute).subtract(const Duration(hours: 4)).toIso8601String();
  }

  Future<void> _submit() async {
    if (reason.text.trim().length < 5) return toast(context, 'Please write a reason', error: true);
    setState(() => busy = true);
    try {
      await Api.instance.post('/attendance/regularizations', {
        'date': isoDate(date),
        'checkIn': _iso(inT),
        'checkOut': _iso(outT),
        'reason': reason.text.trim(),
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget _tile(String title, String value, VoidCallback onTap, IconData icon) => Card(
    child: ListTile(
      leading: Icon(icon, color: AppColors.brand),
      title: Text(title),
      trailing: Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
      onTap: onTap,
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Attendance correction')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Forgot to punch or punched wrongly? Request a correction. Your manager and HR will review it.', style: TextStyle(color: AppColors.muted)),
          const SizedBox(height: 16),
          _tile('Date', fmtDate(isoDate(date)), () async {
            final d = await showDatePicker(context: context, initialDate: date, firstDate: uaeToday().subtract(const Duration(days: 30)), lastDate: uaeToday());
            if (d != null) setState(() => date = d);
          }, Icons.event),
          const SizedBox(height: 8),
          _tile('Check in', inT?.format(context) ?? '—', () async {
            final t = await showTimePicker(context: context, initialTime: inT ?? const TimeOfDay(hour: 9, minute: 0));
            if (t != null) setState(() => inT = t);
          }, Icons.login),
          const SizedBox(height: 8),
          _tile('Check out', outT?.format(context) ?? '—', () async {
            final t = await showTimePicker(context: context, initialTime: outT ?? const TimeOfDay(hour: 18, minute: 0));
            if (t != null) setState(() => outT = t);
          }, Icons.logout),
          const SizedBox(height: 16),
          TextField(
            controller: reason,
            maxLines: 3,
            maxLength: 500,
            decoration: const InputDecoration(labelText: 'Reason', hintText: 'e.g. Phone battery was dead'),
          ),
          const SizedBox(height: 16),
          FilledButton(onPressed: busy ? null : _submit, child: const Text('Send request')),
        ],
      ),
    );
  }
}
