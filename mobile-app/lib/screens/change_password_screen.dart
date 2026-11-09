import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key, this.forced = false});
  final bool forced;
  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _cur = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;

  String? _strong(String? v) {
    if (v == null || v.length < 10) return 'At least 10 characters';
    if (!RegExp(r'[a-z]').hasMatch(v) || !RegExp(r'[A-Z]').hasMatch(v) || !RegExp(r'\d').hasMatch(v)) return 'Use upper case, lower case and a number';
    return null;
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await Api.instance.post('/auth/change-password', {'currentPassword': _cur.text, 'newPassword': _new.text});
      if (!mounted) return;
      toast(context, 'Password changed. Please sign in again.');
      await Session.instance.logout();
      if (mounted && !widget.forced) Navigator.of(context).popUntil((r) => r.isFirst);
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Change password'),
        automaticallyImplyLeading: !widget.forced,
        actions: [if (widget.forced) TextButton(onPressed: Session.instance.logout, child: const Text('Sign out'))],
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (widget.forced)
              Container(
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(color: AppColors.late.withValues(alpha: .1), borderRadius: BorderRadius.circular(12)),
                child: const Text('For your security, set your own password before using the app.'),
              ),
            TextFormField(
              controller: _cur,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Current / temporary password'),
              validator: (v) => (v ?? '').isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _new,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'New password', helperText: 'Min 10 characters, with A-Z, a-z and 0-9'),
              validator: _strong,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _confirm,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Confirm new password'),
              validator: (v) => v != _new.text ? 'Passwords do not match' : null,
            ),
            const SizedBox(height: 28),
            FilledButton(onPressed: _busy ? null : _save, child: const Text('Save password')),
          ],
        ),
      ),
    );
  }
}
