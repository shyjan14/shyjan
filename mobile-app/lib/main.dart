import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'core/config.dart';
import 'core/session.dart';
import 'core/theme.dart';
import 'screens/change_password_screen.dart';
import 'screens/home_shell.dart';
import 'screens/lock_screen.dart';
import 'screens/login_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  Session.instance.init();
  runApp(const HrmsApp());
}

class HrmsApp extends StatelessWidget {
  const HrmsApp({super.key});

  @override
  Widget build(BuildContext context) {
    final s = Session.instance;
    return MaterialApp(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      home: ListenableBuilder(
        listenable: s,
        builder: (context, _) {
          if (!s.ready) return const _Splash();
          if (s.me == null) return const LoginScreen();
          if (s.locked) return const LockScreen();
          if (s.mustChangePassword) return const ChangePasswordScreen(forced: true);
          return const HomeShell();
        },
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) => const Scaffold(
    backgroundColor: AppColors.brand,
    body: Center(child: Icon(Icons.fingerprint_rounded, size: 72, color: Colors.white)),
  );
}
