import 'package:flutter/material.dart';

import '../core/config.dart';
import '../core/session.dart';
import '../core/theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _login = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  final _form = GlobalKey<FormState>();
  String? _mfaToken;
  String? _error;
  bool _busy = false;
  bool _obscure = true;

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_mfaToken != null) {
        await Session.instance.verifyMfa(_mfaToken!, _code.text);
      } else {
        final t = await Session.instance.login(_login.text, _password.text);
        if (t != null) setState(() => _mfaToken = t);
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: Container(
                        width: 64,
                        height: 64,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: AppColors.brand, borderRadius: BorderRadius.circular(18)),
                        child: const Icon(Icons.fingerprint_rounded, color: Colors.white, size: 36),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      _mfaToken == null ? 'Welcome back' : 'Verification',
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _mfaToken == null ? '${AppConfig.appName}\nSign in with your employee code or email.' : 'Enter the 6-digit code from your authenticator app.',
                      style: const TextStyle(color: AppColors.muted, fontSize: 15),
                    ),
                    const SizedBox(height: 28),
                    if (_error != null)
                      Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: AppColors.absent.withValues(alpha: .08), borderRadius: BorderRadius.circular(12)),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: AppColors.absent, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(_error!, style: const TextStyle(color: AppColors.absent)),
                            ),
                          ],
                        ),
                      ),
                    if (_mfaToken == null) ...[
                      TextFormField(
                        controller: _login,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.username],
                        decoration: const InputDecoration(labelText: 'Employee code or email', prefixIcon: Icon(Icons.badge_outlined)),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _password,
                        obscureText: _obscure,
                        autofillHints: const [AutofillHints.password],
                        onFieldSubmitted: (_) => _submit(),
                        decoration: InputDecoration(
                          labelText: 'Password',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            tooltip: _obscure ? 'Show password' : 'Hide password',
                            icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                            onPressed: () => setState(() => _obscure = !_obscure),
                          ),
                        ),
                        validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
                      ),
                    ] else
                      TextFormField(
                        controller: _code,
                        autofocus: true,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 24, letterSpacing: 12),
                        decoration: const InputDecoration(counterText: ''),
                        validator: (v) => (v?.length ?? 0) != 6 ? 'Enter 6 digits' : null,
                      ),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                          : Text(_mfaToken == null ? 'Sign in' : 'Verify'),
                    ),
                    const SizedBox(height: 20),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.shield_outlined, size: 16, color: AppColors.muted),
                        SizedBox(width: 6),
                        Flexible(
                          child: Text('This phone will be linked to your account.', style: TextStyle(color: AppColors.muted, fontSize: 13)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Forgot password? Contact HR.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.muted, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
