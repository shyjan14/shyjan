import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/api.dart';
import '../core/device_security.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import 'notifications_screen.dart';
import 'punch_flow.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.onOpenTab});
  final void Function(int) onOpenTab;
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  final api = Api.instance;
  Map<String, dynamic>? today;
  List<dynamic> balances = [];
  Map<String, dynamic>? month;
  int unread = 0;
  String? error;
  DateTime fetchedAt = DateTime.now();
  Timer? _tick;
  double? distanceM;
  bool locating = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _tick = Timer.periodic(const Duration(seconds: 20), (_) => mounted ? setState(() {}) : null);
  }

  @override
  void dispose() {
    _tick?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _load();
  }

  Future<void> _load() async {
    try {
      final r = await Future.wait([api.get('/attendance/today'), api.get('/leave/balances'), api.get('/attendance/me'), api.get('/notifications')]);
      if (!mounted) return;
      setState(() {
        today = Map<String, dynamic>.from(r[0]);
        balances = r[1];
        month = Map<String, dynamic>.from(r[2]);
        unread = (r[3] as List).where((n) => n['readAt'] == null).length;
        fetchedAt = DateTime.now();
        error = null;
      });
      _checkLocation();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  Future<void> _checkLocation() async {
    if (today == null || locating) return;
    setState(() => locating = true);
    final loc = await DeviceSecurity.currentLocation();
    if (!mounted) return;
    final b = today!['branch'];
    setState(() {
      locating = false;
      distanceM = loc.position == null
          ? null
          : DeviceSecurity.distance(loc.position!.latitude, loc.position!.longitude, (b['latitude'] as num).toDouble(), (b['longitude'] as num).toDouble());
    });
  }

  int get _liveWork {
    final base = (today?['workMinutes'] ?? 0) as int;
    return today?['state'] == 'WORKING' ? base + DateTime.now().difference(fetchedAt).inMinutes : base;
  }

  int get _liveBreak {
    final base = (today?['breakMinutes'] ?? 0) as int;
    return today?['state'] == 'ON_BREAK' ? base + DateTime.now().difference(fetchedAt).inMinutes : base;
  }

  Future<void> _punch(String type) async {
    HapticFeedback.mediumImpact();
    final result = await PunchFlow.start(context, type: type, branch: Map<String, dynamic>.from(today!['branch']));
    if (result != null && mounted) {
      setState(() {
        today = Map<String, dynamic>.from(result);
        fetchedAt = DateTime.now();
      });
      _load();
    }
  }

  String get _greeting {
    final h = uaeToday().hour;
    return h < 12
        ? 'Good morning'
        : h < 17
        ? 'Good afternoon'
        : 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final s = Session.instance;
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('$_greeting, ${s.firstName}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 2),
                        Text(
                          today == null ? '' : '${fmtDate(today!['date'])} · Shift ${today!['shift']['startTime']}–${today!['shift']['endTime']}',
                          style: const TextStyle(color: AppColors.muted),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Notifications',
                    onPressed: () async {
                      await Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen()));
                      _load();
                    },
                    icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.notifications_outlined)),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (error != null && today == null)
                ErrorView(error!, onRetry: _load)
              else if (today == null)
                const LoadingView()
              else ...[
                _punchCard(),
                const SizedBox(height: 16),
                if ((today!['punches'] as List).isNotEmpty) ...[_timeline(), const SizedBox(height: 16)],
                _leaveCards(),
                const SizedBox(height: 16),
                _monthCard(),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _geoChip() {
    final b = today!['branch'];
    final radius = (b['radiusM'] as num).toDouble();
    String text;
    Color c;
    IconData icon;
    if (locating) {
      text = 'Checking location…';
      c = AppColors.muted;
      icon = Icons.my_location;
    } else if (distanceM == null) {
      text = 'Location unavailable · tap to retry';
      c = AppColors.late;
      icon = Icons.location_disabled;
    } else if (distanceM! <= radius) {
      text = 'You are at ${b['name']}';
      c = AppColors.present;
      icon = Icons.check_circle;
    } else {
      text = '${distanceM! >= 1000 ? '${(distanceM! / 1000).toStringAsFixed(1)} km' : '${distanceM!.round()} m'} from ${b['name']}';
      c = AppColors.absent;
      icon = Icons.location_off;
    }
    return InkWell(
      onTap: _checkLocation,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(color: c.withValues(alpha: .1), borderRadius: BorderRadius.circular(20)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: c),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                text,
                style: TextStyle(color: c, fontWeight: FontWeight.w600, fontSize: 13),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _punchCard() {
    final state = today!['state'] as String;
    final next = List<String>.from(today!['nextActions']);
    final (String main, String mainLabel, Color color, IconData icon) = switch (state) {
      'WORKING' => ('CHECK_OUT', 'CHECK OUT', AppColors.absent, Icons.logout_rounded),
      'ON_BREAK' => ('BREAK_END', 'END BREAK', AppColors.breakColor, Icons.play_arrow_rounded),
      _ => ('CHECK_IN', state == 'CHECKED_OUT' ? 'CHECK IN AGAIN' : 'CHECK IN', AppColors.present, Icons.login_rounded),
    };
    final stateText = switch (state) {
      'WORKING' => 'Working',
      'ON_BREAK' => 'On break',
      'CHECKED_OUT' => 'Checked out',
      _ => 'Not in yet',
    };
    return Section(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
      child: Column(
        children: [
          _geoChip(),
          const SizedBox(height: 24),
          Semantics(
            button: true,
            label: mainLabel,
            child: GestureDetector(
              onTap: () => _punch(main),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                width: 176,
                height: 176,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [color.withValues(alpha: .85), color]),
                  boxShadow: [BoxShadow(color: color.withValues(alpha: .35), blurRadius: 30, spreadRadius: 2, offset: const Offset(0, 10))],
                  border: Border.all(color: color.withValues(alpha: .18), width: 10, strokeAlign: BorderSide.strokeAlignOutside),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icon, color: Colors.white, size: 40),
                    const SizedBox(height: 6),
                    Text(
                      mainLabel,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17, letterSpacing: .5),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 22),
          if (next.contains('BREAK_START'))
            OutlinedButton.icon(
              onPressed: () => _punch('BREAK_START'),
              icon: const Icon(Icons.coffee_outlined, color: AppColors.breakColor),
              label: const Text(
                'Start break',
                style: TextStyle(color: AppColors.breakColor, fontWeight: FontWeight.w600),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.breakColor),
                shape: const StadiumBorder(),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
            ),
          const SizedBox(height: 14),
          Row(
            children: [
              _metric(
                'Status',
                stateText,
                AppColors.forStatus(
                  state == 'ON_BREAK'
                      ? 'ON_BREAK'
                      : state == 'WORKING'
                      ? 'PRESENT'
                      : 'x',
                ),
              ),
              _metric('Worked', fmtMins(_liveWork), null),
              _metric('Break', fmtMins(_liveBreak), null),
            ],
          ),
          if ((today!['lateMinutes'] ?? 0) > 0)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: StatusChip('LATE', text: 'Late by ${_lateText(today!['lateMinutes'] as int)}'),
            ),
        ],
      ),
    );
  }

  Widget _metric(String k, String v, Color? c) => Expanded(
    child: Column(
      children: [
        Text(k, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
        const SizedBox(height: 4),
        Text(
          v,
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: c, fontFeatures: const [FontFeature.tabularFigures()]),
        ),
      ],
    ),
  );

  Widget _timeline() {
    const names = {'CHECK_IN': 'Checked in', 'BREAK_START': 'Break started', 'BREAK_END': 'Break ended', 'CHECK_OUT': 'Checked out'};
    const colors = {'CHECK_IN': AppColors.present, 'BREAK_START': AppColors.breakColor, 'BREAK_END': AppColors.brand, 'CHECK_OUT': AppColors.muted};
    final punches = today!['punches'] as List;
    return Section(
      title: "Today's activity",
      child: Column(
        children: [
          for (final p in punches)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(color: colors[p['type']], shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Text(names[p['type']] ?? p['type'])),
                  if ((p['flags'] as List).isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Text((p['flags'] as List).map((f) => label(f)).join(', '), style: const TextStyle(fontSize: 12, color: AppColors.late)),
                    ),
                  Text(fmtTime(p['serverTime']), style: const TextStyle(fontWeight: FontWeight.w600)),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _leaveCards() {
    final show = balances.where((b) => ['ANNUAL', 'SICK'].contains(b['code'])).toList();
    return Row(
      children: [
        for (final b in show) ...[
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => widget.onOpenTab(2),
              child: Section(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          b['code'] == 'ANNUAL' ? Icons.beach_access : Icons.medical_services_outlined,
                          size: 18,
                          color: b['code'] == 'ANNUAL' ? AppColors.leave : AppColors.absent,
                        ),
                        const SizedBox(width: 6),
                        Text(b['code'] == 'ANNUAL' ? 'Annual' : 'Sick', style: const TextStyle(color: AppColors.muted)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(_num(b['available']), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700)),
                    const Text('days left', style: TextStyle(color: AppColors.muted, fontSize: 12)),
                  ],
                ),
              ),
            ),
          ),
          if (b != show.last) const SizedBox(width: 12),
        ],
      ],
    );
  }

  String _lateText(int m) => m >= 60 ? fmtMins(m) : '$m min';

  String _num(dynamic n) => n == null ? '∞' : ((n as num) % 1 == 0 ? n.toInt().toString() : n.toString());

  Widget _monthCard() {
    final s = month?['summary'];
    if (s == null) return const SizedBox();
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => widget.onOpenTab(1),
      child: Section(
        title: 'This month',
        trailing: const Icon(Icons.chevron_right, color: AppColors.muted),
        child: Row(
          children: [
            _stat('Present', s['PRESENT'] + s['LATE'], AppColors.present),
            _stat('Late', s['LATE'], AppColors.late),
            _stat('Absent', s['ABSENT'], AppColors.absent),
            _stat('Leave', s['ON_LEAVE'], AppColors.leave),
          ],
        ),
      ),
    );
  }

  Widget _stat(String k, dynamic v, Color c) => Expanded(
    child: Column(
      children: [
        Text(
          '$v',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c),
        ),
        Text(k, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
      ],
    ),
  );
}
