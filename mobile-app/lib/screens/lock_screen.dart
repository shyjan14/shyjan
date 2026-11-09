import 'package:flutter/material.dart';

import '../core/device_security.dart';
import '../core/session.dart';
import '../core/theme.dart';

class LockScreen extends StatefulWidget {
  const LockScreen({super.key});
  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _unlock());
  }

  Future<void> _unlock() async {
    if (await DeviceSecurity.unlock()) Session.instance.unlock();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.lock_outline_rounded, size: 56, color: AppColors.brand),
                const SizedBox(height: 16),
                Text('Hi ${Session.instance.firstName}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                const Text(
                  'Use fingerprint, Face ID or your phone PIN to continue.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.muted),
                ),
                const SizedBox(height: 28),
                FilledButton.icon(onPressed: _unlock, icon: const Icon(Icons.fingerprint), label: const Text('Unlock')),
                TextButton(onPressed: Session.instance.logout, child: const Text('Sign in with password')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
