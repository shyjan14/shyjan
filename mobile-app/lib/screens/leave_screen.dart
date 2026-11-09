import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

const leaveIcons = {
  'ANNUAL': Icons.beach_access,
  'SICK': Icons.medical_services_outlined,
  'MATERNITY': Icons.child_friendly_outlined,
  'PARENTAL': Icons.family_restroom,
  'BEREAVEMENT': Icons.spa_outlined,
  'STUDY': Icons.school_outlined,
  'HAJJ': Icons.mosque_outlined,
  'UNPAID': Icons.money_off_outlined,
};

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key});
  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  Key key = UniqueKey();

  Future<(List, List)> _load() async {
    final r = await Future.wait([Api.instance.get('/leave/balances'), Api.instance.get('/leave/requests/mine')]);
    return (r[0] as List, r[1] as List);
  }

  String _n(dynamic v) => v == null ? '∞' : ((v as num) % 1 == 0 ? v.toInt().toString() : v.toString());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Leave')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final ok = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => const ApplyLeaveScreen()));
          if (ok == true && context.mounted) {
            toast(context, 'Leave request sent for approval');
            setState(() => key = UniqueKey());
          }
        },
        icon: const Icon(Icons.add),
        label: const Text('Apply leave'),
      ),
      body: Loader<(List, List)>(
        key: key,
        load: _load,
        builder: (context, data, reload) {
          final (balances, requests) = data;
          return RefreshIndicator(
            onRefresh: () async => setState(() => key = UniqueKey()),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
              children: [
                Text(
                  'Balance ${uaeToday().year}',
                  style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.muted),
                ),
                const SizedBox(height: 10),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 1.45,
                  children: [
                    for (final b in balances)
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(leaveIcons[b['code']] ?? Icons.event_note, size: 18, color: AppColors.brand),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      (b['name'] as String).split(' (').first,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                ],
                              ),
                              const Spacer(),
                              Text(_n(b['available']), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
                              Text(
                                b['available'] == null
                                    ? 'as approved'
                                    : 'of ${_n(b['entitled'] + b['carriedForward'] + b['adjustment'])} · ${_n(b['taken'])} used',
                                style: const TextStyle(fontSize: 12, color: AppColors.muted),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 24),
                const Text(
                  'My requests',
                  style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.muted),
                ),
                const SizedBox(height: 10),
                if (requests.isEmpty)
                  const Card(
                    child: EmptyView('No leave requests yet', icon: Icons.beach_access_outlined, text: 'Tap "Apply leave" to request time off.'),
                  ),
                for (final r in requests)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Card(
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        leading: CircleAvatar(
                          backgroundColor: AppColors.brandLight,
                          child: Icon(leaveIcons[r['leaveType']['code']] ?? Icons.event_note, color: AppColors.brand),
                        ),
                        title: Text(r['leaveType']['name'], style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text(
                          '${fmtShortDate(r['fromDate'].substring(0, 10))} → ${fmtShortDate(r['toDate'].substring(0, 10))} · ${_n(r['days'])} day(s)',
                        ),
                        trailing: StatusChip(r['status']),
                        onTap: () => _detail(context, r),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _detail(BuildContext context, Map r) {
    final canCancel = ['PENDING_MANAGER', 'PENDING_HR', 'APPROVED'].contains(r['status']);
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(r['leaveType']['name'], style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                ),
                StatusChip(r['status']),
              ],
            ),
            const SizedBox(height: 12),
            Text('${fmtDate(r['fromDate'])} → ${fmtDate(r['toDate'])} · ${_n(r['days'])} day(s)'),
            const SizedBox(height: 8),
            Text(r['reason'], style: const TextStyle(color: AppColors.muted)),
            const SizedBox(height: 20),
            if (canCancel)
              OutlinedButton(
                style: OutlinedButton.styleFrom(foregroundColor: AppColors.absent, minimumSize: const Size.fromHeight(48)),
                onPressed: () async {
                  try {
                    await Api.instance.patch('/leave/requests/${r['id']}/cancel');
                    if (sheet.mounted) Navigator.pop(sheet);
                    setState(() => key = UniqueKey());
                  } catch (e) {
                    if (context.mounted) toast(context, e.toString(), error: true);
                  }
                },
                child: const Text('Cancel request'),
              ),
          ],
        ),
      ),
    );
  }
}

class ApplyLeaveScreen extends StatefulWidget {
  const ApplyLeaveScreen({super.key});
  @override
  State<ApplyLeaveScreen> createState() => _ApplyLeaveScreenState();
}

class _ApplyLeaveScreenState extends State<ApplyLeaveScreen> {
  List types = [];
  Map? type;
  DateTimeRange? range;
  String? halfDay;
  final reason = TextEditingController();
  Uint8List? attachment;
  String? attachmentMime;
  bool busy = false;
  String? error;

  @override
  void initState() {
    super.initState();
    Api.instance.get('/leave/types').then((t) => setState(() => types = t)).catchError((e) => setState(() => error = e.toString()));
  }

  bool get _single => range != null && range!.start == range!.end;

  Future<void> _pickAttachment(ImageSource src) async {
    final f = await ImagePicker().pickImage(source: src, maxWidth: 1600, imageQuality: 80);
    if (f == null) return;
    final bytes = await f.readAsBytes();
    setState(() {
      attachment = bytes;
      attachmentMime = bytes.length > 3 && bytes[0] == 0x89 ? 'image/png' : 'image/jpeg';
    });
  }

  Future<void> _submit() async {
    setState(() => error = null);
    if (type == null || range == null) return setState(() => error = 'Choose leave type and dates');
    if (reason.text.trim().length < 3) return setState(() => error = 'Please write a short reason');
    setState(() => busy = true);
    try {
      final res = await Api.instance.multipart(
        '/leave/requests',
        {
          'leaveTypeId': type!['id'],
          'fromDate': isoDate(range!.start),
          'toDate': isoDate(range!.end),
          if (halfDay != null && _single) 'halfDay': halfDay!,
          'reason': reason.text.trim(),
        },
        fileField: attachment != null ? 'attachment' : null,
        bytes: attachment,
        filename: attachmentMime == 'image/png' ? 'document.png' : 'document.jpg',
        mime: attachmentMime ?? 'image/jpeg',
      );
      if (!mounted) return;
      final pay = res['payBreakdown'];
      if (pay != null && (pay['HALF'] > 0 || pay['UNPAID'] > 0)) {
        await showDialog(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Pay information'),
            content: Text('As per UAE law this request includes: ${pay['FULL']} day(s) full pay, ${pay['HALF']} half pay, ${pay['UNPAID']} unpaid.'),
            actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
          ),
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final needsDoc = type != null && type!['attachmentAfterDays'] != null;
    return Scaffold(
      appBar: AppBar(title: const Text('Apply leave')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.absent.withValues(alpha: .08), borderRadius: BorderRadius.circular(12)),
              child: Text(error!, style: const TextStyle(color: AppColors.absent)),
            ),
          const Text('Leave type', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final t in types)
                ChoiceChip(
                  avatar: Icon(leaveIcons[t['code']] ?? Icons.event_note, size: 18),
                  label: Text((t['name'] as String).split(' (').first),
                  selected: type?['id'] == t['id'],
                  onSelected: (_) => setState(() => type = t),
                ),
            ],
          ),
          if (type?['description'] != null)
            Container(
              margin: const EdgeInsets.only(top: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.leave.withValues(alpha: .07), borderRadius: BorderRadius.circular(12)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline, size: 18, color: AppColors.leave),
                  const SizedBox(width: 8),
                  Expanded(child: Text(type!['description'], style: const TextStyle(fontSize: 13))),
                ],
              ),
            ),
          const SizedBox(height: 20),
          Card(
            child: ListTile(
              leading: const Icon(Icons.date_range, color: AppColors.brand),
              title: Text(range == null ? 'Select dates' : '${fmtDate(isoDate(range!.start))} → ${fmtDate(isoDate(range!.end))}'),
              subtitle: range == null ? null : Text('${range!.duration.inDays + 1} calendar day(s)'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () async {
                final now = uaeToday();
                final r = await showDateRangePicker(
                  context: context,
                  firstDate: type?['code'] == 'SICK' ? now.subtract(const Duration(days: 7)) : DateTime(now.year, now.month, now.day),
                  lastDate: DateTime(now.year + 1, 12, 31),
                  initialDateRange: range,
                );
                if (r != null) setState(() => range = r);
              },
            ),
          ),
          if (_single && type?['allowHalfDay'] == true) ...[
            const SizedBox(height: 12),
            SegmentedButton<String?>(
              segments: const [
                ButtonSegment(value: null, label: Text('Full day')),
                ButtonSegment(value: 'FIRST_HALF', label: Text('1st half')),
                ButtonSegment(value: 'SECOND_HALF', label: Text('2nd half')),
              ],
              selected: {halfDay},
              onSelectionChanged: (s) => setState(() => halfDay = s.first),
            ),
          ],
          const SizedBox(height: 16),
          TextField(
            controller: reason,
            maxLines: 3,
            maxLength: 1000,
            decoration: const InputDecoration(labelText: 'Reason'),
          ),
          if (needsDoc) ...[
            const SizedBox(height: 4),
            Text(
              type!['attachmentAfterDays'] == 0
                  ? 'Supporting document required'
                  : 'Medical certificate required for more than ${type!['attachmentAfterDays']} day(s)',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            if (attachment != null)
              Card(
                child: ListTile(
                  leading: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.memory(attachment!, width: 44, height: 44, fit: BoxFit.cover),
                  ),
                  title: const Text('Document attached'),
                  trailing: IconButton(tooltip: 'Remove', icon: const Icon(Icons.close), onPressed: () => setState(() => attachment = null)),
                ),
              )
            else
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _pickAttachment(ImageSource.camera),
                      icon: const Icon(Icons.photo_camera_outlined),
                      label: const Text('Camera'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _pickAttachment(ImageSource.gallery),
                      icon: const Icon(Icons.photo_library_outlined),
                      label: const Text('Gallery'),
                    ),
                  ),
                ],
              ),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: busy ? null : _submit,
            child: busy ? const CircularProgressIndicator(color: Colors.white) : const Text('Submit request'),
          ),
        ],
      ),
    );
  }
}
