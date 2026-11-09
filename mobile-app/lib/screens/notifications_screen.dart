import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void dispose() {
    Api.instance.post('/notifications/read-all').catchError((_) => null);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: Loader<dynamic>(
        load: () => Api.instance.get('/notifications'),
        builder: (context, list, reload) => RefreshIndicator(
          onRefresh: reload,
          child: list.isEmpty
              ? ListView(children: const [EmptyView('You are all caught up', icon: Icons.notifications_none)])
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final n = list[i];
                    final unread = n['readAt'] == null;
                    return Card(
                      child: ListTile(
                        leading: Icon(Icons.circle, size: 10, color: unread ? AppColors.brand : Colors.transparent),
                        minLeadingWidth: 10,
                        title: Text(n['title'], style: TextStyle(fontWeight: unread ? FontWeight.w700 : FontWeight.w500)),
                        subtitle: Text('${n['body']}\n${fmtDate(n['createdAt'])} ${fmtTime(n['createdAt'])}'),
                        isThreeLine: true,
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
