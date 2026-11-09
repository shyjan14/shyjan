import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../core/api.dart';
import '../core/device_security.dart';
import '../core/format.dart';
import '../core/theme.dart';

/// Guided punch: integrity → location → selfie → submit → confirmation.
class PunchFlow extends StatefulWidget {
  const PunchFlow({super.key, required this.type, required this.branch});
  final String type;
  final Map<String, dynamic> branch;

  static Future<Map<String, dynamic>?> start(BuildContext context, {required String type, required Map<String, dynamic> branch}) {
    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      isDismissible: false,
      enableDrag: false,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => PunchFlow(type: type, branch: branch),
    );
  }

  @override
  State<PunchFlow> createState() => _PunchFlowState();
}

enum _Step { checking, locating, selfie, sending, done, failed }

class _PunchFlowState extends State<PunchFlow> {
  _Step step = _Step.checking;
  String? error;
  Map<String, dynamic>? result;
  Uint8List? selfie;

  static const titles = {'CHECK_IN': 'Check in', 'CHECK_OUT': 'Check out', 'BREAK_START': 'Start break', 'BREAK_END': 'End break'};

  @override
  void initState() {
    super.initState();
    _run();
  }

  void _fail(String msg) {
    HapticFeedback.heavyImpact();
    setState(() {
      step = _Step.failed;
      error = msg;
    });
  }

  Future<void> _run() async {
    setState(() {
      step = _Step.checking;
      error = null;
    });
    final rooted = await DeviceSecurity.isRooted();

    setState(() => step = _Step.locating);
    final loc = await DeviceSecurity.currentLocation();
    if (loc.position == null) return _fail(loc.error!);
    final pos = loc.position!;
    final bssid = await DeviceSecurity.wifiBssid();

    setState(() => step = _Step.selfie);
    try {
      final shot = await ImagePicker().pickImage(source: ImageSource.camera, preferredCameraDevice: CameraDevice.front, maxWidth: 720, imageQuality: 70);
      if (shot == null) return _fail('A selfie is required to confirm it is you.');
      selfie = await shot.readAsBytes();
    } catch (_) {
      return _fail('Camera permission is needed for the attendance selfie.');
    }

    setState(() => step = _Step.sending);
    try {
      final res = await Api.instance.multipart(
        '/attendance/punch',
        {
          'type': widget.type,
          'latitude': pos.latitude.toString(),
          'longitude': pos.longitude.toString(),
          'accuracy': pos.accuracy.toString(),
          'isMockLocation': (!kIsWeb && pos.isMocked).toString(),
          'isRooted': rooted.toString(),
          'wifiBssid': ?bssid,
          'deviceTime': DateTime.now().toUtc().toIso8601String(),
        },
        fileField: 'selfie',
        bytes: selfie,
        filename: 'selfie.jpg',
      );
      HapticFeedback.lightImpact();
      setState(() {
        result = Map<String, dynamic>.from(res);
        step = _Step.done;
      });
    } catch (e) {
      _fail(e is ApiException ? e.message : e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = titles[widget.type]!;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(color: Colors.black12, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 20),
          if (step == _Step.done) ..._done(title) else if (step == _Step.failed) ..._failed(title) else ..._progress(title),
        ],
      ),
    );
  }

  List<Widget> _progress(String title) {
    final steps = [
      (_Step.checking, 'Checking phone security'),
      (_Step.locating, 'Verifying your location'),
      (_Step.selfie, 'Taking selfie'),
      (_Step.sending, 'Recording $title'),
    ];
    final idx = steps.indexWhere((s) => s.$1 == step);
    return [
      Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
      const SizedBox(height: 20),
      for (var i = 0; i < steps.length; i++)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              SizedBox(
                width: 24,
                height: 24,
                child: i < idx
                    ? const Icon(Icons.check_circle, color: AppColors.present)
                    : i == idx
                    ? const CircularProgressIndicator(strokeWidth: 2.5)
                    : const Icon(Icons.radio_button_unchecked, color: Colors.black26),
              ),
              const SizedBox(width: 14),
              Text(
                steps[i].$2,
                style: TextStyle(fontWeight: i == idx ? FontWeight.w600 : FontWeight.w400, color: i > idx ? AppColors.muted : null),
              ),
            ],
          ),
        ),
      const SizedBox(height: 12),
    ];
  }

  List<Widget> _done(String title) {
    final punches = (result?['today']?['punches'] as List?) ?? [];
    final last = punches.isNotEmpty ? punches.last : null;
    return [
      TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 500),
        curve: Curves.elasticOut,
        builder: (_, v, child) => Transform.scale(scale: v, child: child),
        child: Container(
          width: 88,
          height: 88,
          decoration: const BoxDecoration(color: AppColors.present, shape: BoxShape.circle),
          child: const Icon(Icons.check_rounded, color: Colors.white, size: 56),
        ),
      ),
      const SizedBox(height: 18),
      Text('$title successful', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
      const SizedBox(height: 6),
      Text('${fmtTime(last?['serverTime'])} · ${widget.branch['name']}', style: const TextStyle(color: AppColors.muted)),
      if (last != null && (last['flags'] as List).contains('REMOTE'))
        const Padding(
          padding: EdgeInsets.only(top: 8),
          child: Text(
            'Recorded outside branch — sent to your manager for review.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.late),
          ),
        ),
      const SizedBox(height: 24),
      FilledButton(onPressed: () => Navigator.pop(context, result!['today']), child: const Text('Done')),
    ];
  }

  List<Widget> _failed(String title) => [
    Container(
      width: 72,
      height: 72,
      decoration: BoxDecoration(color: AppColors.absent.withValues(alpha: .1), shape: BoxShape.circle),
      child: const Icon(Icons.close_rounded, color: AppColors.absent, size: 44),
    ),
    const SizedBox(height: 16),
    Text('$title not recorded', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
    const SizedBox(height: 8),
    Text(
      error ?? '',
      textAlign: TextAlign.center,
      style: const TextStyle(color: AppColors.muted, fontSize: 15),
    ),
    const SizedBox(height: 24),
    FilledButton(onPressed: _run, child: const Text('Try again')),
    TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
  ];
}
