import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

/// Managers: who is in today + pending leave approvals.
class TeamScreen extends StatefulWidget {
  const TeamScreen({super.key});
  @override
  State<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends State<TeamScreen> {
  Key key = UniqueKey();

  Future<(Map, List)> _load() async {
    final r = await Future.wait([Api.instance.get('/attendance/register'), Api.instance.get('/leave/requests')]);
    return (Map<String, dynamic>.from(r[0]), r[1] as List);
  }

  Future<void> _decide(Map r, String action) async {
    String? comment;
    if (action == 'REJECT') {
      final c = TextEditingController();
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Reject leave'),
          content: TextField(
            controller: c,
            decoration: const InputDecoration(labelText: 'Reason (shown to employee)'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Reject')),
          ],
        ),
      );
      if (ok != true) return;
      comment = c.text;
    }
    try {
      await Api.instance.patch('/leave/requests/${r['id']}/decision', {'action': action, if (comment != null && comment.isNotEmpty) 'comment': comment});
      if (mounted) toast(context, action == 'APPROVE' ? 'Approved' : 'Rejected');
      setState(() => key = UniqueKey());
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My team')),
      body: Loader<(Map, List)>(
        key: key,
        load: _load,
        builder: (context, data, _) {
          final (reg, leaves) = data;
          final c = Map<String, dynamic>.from(reg['counts']);
          final present = (c['PRESENT'] ?? 0) + (c['LATE'] ?? 0) + (c['ON_BREAK'] ?? 0) + (c['HALF_DAY'] ?? 0);
          return RefreshIndicator(
            onRefresh: () async => setState(() => key = UniqueKey()),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    _box('Present', present, AppColors.present),
                    _box('Late', c['LATE'] ?? 0, AppColors.late),
                    _box('Leave', c['ON_LEAVE'] ?? 0, AppColors.leave),
                    _box('Not in', c['NOT_IN'] ?? 0, AppColors.absent),
                  ],
                ),
                const SizedBox(height: 16),
                if (leaves.isNotEmpty) ...[
                  Text(
                    'Pending approvals (${leaves.length})',
                    style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.muted),
                  ),
                  const SizedBox(height: 8),
                  for (final r in leaves)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Section(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '${r['employee']['firstName']} ${r['employee']['lastName']}',
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                                  ),
                                ),
                                StatusChip(r['status']),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text('${r['leaveType']['name']} · ${fmtDate(r['fromDate'])} → ${fmtDate(r['toDate'])} · ${r['days']} day(s)'),
                            const SizedBox(height: 4),
                            Text('"${r['reason']}"', style: const TextStyle(color: AppColors.muted)),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(onPressed: () => _decide(r, 'REJECT'), child: const Text('Reject')),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: FilledButton(
                                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(40)),
                                    onPressed: () => _decide(r, 'APPROVE'),
                                    child: const Text('Approve'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: 8),
                ],
                Text(
                  'Today · ${fmtDate(reg['date'])}',
                  style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.muted),
                ),
                const SizedBox(height: 8),
                Card(
                  child: Column(
                    children: [
                      for (final r in reg['rows'])
                        ListTile(
                          leading: CircleAvatar(
                            backgroundColor: AppColors.forStatus(r['status']).withValues(alpha: .15),
                            child: Text(
                              r['name'][0],
                              style: TextStyle(color: AppColors.forStatus(r['status']), fontWeight: FontWeight.w700),
                            ),
                          ),
                          title: Text(r['name']),
                          subtitle: Text(
                            r['firstIn'] != null
                                ? 'In ${fmtTime(r['firstIn'])}${r['lastOut'] != null ? ' · Out ${fmtTime(r['lastOut'])}' : ''}'
                                : r['designation'],
                          ),
                          trailing: StatusChip(r['status']),
                        ),
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

  Widget _box(String k, dynamic v, Color c) => Expanded(
    child: Card(
      margin: const EdgeInsets.symmetric(horizontal: 3),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Column(
          children: [
            Text(
              '$v',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: c),
            ),
            Text(k, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          ],
        ),
      ),
    ),
  );
}
