import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/device_security.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import 'change_password_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Key key = UniqueKey();
  bool bio = false;
  bool bioAvailable = false;

  @override
  void initState() {
    super.initState();
    DeviceSecurity.biometricAvailable().then((v) => setState(() => bioAvailable = v));
    DeviceSecurity.biometricEnabled.then((v) => setState(() => bio = v));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: Loader<dynamic>(
        key: key,
        load: () => Api.instance.get('/profile'),
        builder: (context, e, reload) => RefreshIndicator(
          onRefresh: reload,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Section(
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 30,
                      backgroundColor: AppColors.brandLight,
                      child: Text(
                        '${e['firstName'][0]}${e['lastName'][0]}',
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.brandDark),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${e['firstName']} ${e['lastName']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                          if (e['nameArabic'] != null)
                            Text(
                              e['nameArabic'],
                              textDirection: TextDirection.rtl,
                              style: const TextStyle(color: AppColors.muted),
                            ),
                          Text('${e['designation']} · ${e['user']['employeeCode']}', style: const TextStyle(color: AppColors.muted)),
                          Text(e['branch']['name'], style: const TextStyle(color: AppColors.muted)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Section(title: 'UAE documents', child: _docs(e['documents'])),
              const SizedBox(height: 16),
              Section(
                title: 'Job',
                child: Column(
                  children: [
                    _kv('Department', e['department']?['name']),
                    _kv('Manager', e['manager'] == null ? null : '${e['manager']['firstName']} ${e['manager']['lastName']}'),
                    _kv('Joining date', fmtDate(e['joiningDate'])),
                    _kv('Probation end', fmtDate(e['probationEnd'])),
                    _kv('Contract', label(e['contractType'] ?? '')),
                    _kv('Shift', e['shift'] == null ? '09:00 – 18:00' : '${e['shift']['startTime']} – ${e['shift']['endTime']}'),
                    if (e['gratuityEstimate'] != null) _kv('Gratuity (estimate)', 'AED ${(e['gratuityEstimate'] as num).toStringAsFixed(0)}'),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Section(
                title: 'Contact',
                trailing: TextButton(onPressed: () => _editContact(context, e), child: const Text('Edit')),
                child: Column(
                  children: [
                    _kv('Mobile', e['user']['phone']),
                    _kv('Email', e['user']['email']),
                    _kv('Emirate', e['emirate']),
                    _kv('UAE address', e['uaeAddress']),
                    _kv(
                      'Emergency contact',
                      e['emergencyName'] == null ? null : '${e['emergencyName']} (${e['emergencyRelation'] ?? ''})\n${e['emergencyPhone'] ?? ''}',
                    ),
                    if (e['iban'] != null) _kv('Bank account', e['iban']),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Card(
                child: Column(
                  children: [
                    if (bioAvailable)
                      SwitchListTile(
                        secondary: const Icon(Icons.fingerprint),
                        title: const Text('Unlock with fingerprint / Face ID'),
                        value: bio,
                        onChanged: (v) async {
                          if (v && !await DeviceSecurity.unlock()) return;
                          await DeviceSecurity.setBiometric(v);
                          setState(() => bio = v);
                        },
                      ),
                    ListTile(
                      leading: const Icon(Icons.password),
                      title: const Text('Change password'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ChangePasswordScreen())),
                    ),
                    ListTile(
                      leading: const Icon(Icons.logout, color: AppColors.absent),
                      title: const Text('Sign out', style: TextStyle(color: AppColors.absent)),
                      onTap: () async {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (_) => AlertDialog(
                            title: const Text('Sign out?'),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                              FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Sign out')),
                            ],
                          ),
                        );
                        if (ok == true) Session.instance.logout();
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _kv(String k, String? v) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 130,
          child: Text(k, style: const TextStyle(color: AppColors.muted)),
        ),
        Expanded(
          child: Text(v == null || v.isEmpty ? '—' : v, style: const TextStyle(fontWeight: FontWeight.w500)),
        ),
      ],
    ),
  );

  Widget _docs(List docs) {
    if (docs.isEmpty) return const Text('No documents on file. Please share copies with HR.', style: TextStyle(color: AppColors.muted));
    return Column(
      children: [
        for (final d in docs)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              children: [
                Icon(_docIcon(d['type']), color: AppColors.brand),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label(d['type']), style: const TextStyle(fontWeight: FontWeight.w600)),
                      Text(
                        '${d['number'] ?? ''}${d['expiryDate'] != null ? ' · exp ${fmtDate(d['expiryDate'])}' : ''}',
                        style: const TextStyle(color: AppColors.muted, fontSize: 13),
                      ),
                    ],
                  ),
                ),
                _expiry(d['expiryDate']),
              ],
            ),
          ),
      ],
    );
  }

  IconData _docIcon(String t) => switch (t) {
    'EMIRATES_ID' => Icons.badge_outlined,
    'PASSPORT' => Icons.menu_book_outlined,
    'RESIDENCE_VISA' => Icons.verified_user_outlined,
    'LABOUR_CARD' => Icons.work_outline,
    'MEDICAL_INSURANCE' => Icons.health_and_safety_outlined,
    'DRIVING_LICENCE' => Icons.directions_car_outlined,
    _ => Icons.description_outlined,
  };

  Widget _expiry(String? date) {
    if (date == null) return const SizedBox();
    final days = DateTime.parse('${date}T00:00:00Z').difference(DateTime.now().toUtc()).inDays;
    final status = days < 0
        ? 'ABSENT'
        : days <= 30
        ? 'ABSENT'
        : days <= 90
        ? 'LATE'
        : 'PRESENT';
    return StatusChip(status, text: days < 0 ? 'Expired' : '$days d');
  }

  Future<void> _editContact(BuildContext context, Map e) async {
    final phone = TextEditingController(text: e['user']['phone']);
    final addr = TextEditingController(text: e['uaeAddress']);
    final en = TextEditingController(text: e['emergencyName']);
    final er = TextEditingController(text: e['emergencyRelation']);
    final ep = TextEditingController(text: e['emergencyPhone']);
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheet) => Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(sheet).viewInsets.bottom + 20),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Update contact details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              TextField(
                controller: phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'UAE mobile (+9715…)'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: addr,
                decoration: const InputDecoration(labelText: 'UAE address'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: en,
                decoration: const InputDecoration(labelText: 'Emergency contact name'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: er,
                decoration: const InputDecoration(labelText: 'Relation'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: ep,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Emergency phone'),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () async {
                  try {
                    await Api.instance.patch('/profile', {
                      if (phone.text.isNotEmpty) 'phone': phone.text.trim(),
                      'uaeAddress': addr.text.trim(),
                      'emergencyName': en.text.trim(),
                      'emergencyRelation': er.text.trim(),
                      'emergencyPhone': ep.text.trim(),
                    });
                    if (sheet.mounted) Navigator.pop(sheet, true);
                  } catch (err) {
                    if (sheet.mounted) toast(sheet, err.toString(), error: true);
                  }
                },
                child: const Text('Save'),
              ),
            ],
          ),
        ),
      ),
    );
    if (saved == true) setState(() => key = UniqueKey());
  }
}
