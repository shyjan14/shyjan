# Employee mobile app (Flutter)

Covers attendance (check-in/out, breaks), leave, profile and UAE documents, and team approvals for managers.

```bash
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:4000
```

Code layout:
- `lib/core/`: API client (secure token storage, auto refresh), session, device security (device ID, root check, GPS, biometrics), theme
- `lib/screens/`: login, home (punch), punch flow, attendance, leave, profile, team, notifications
- `lib/widgets/common.dart`: shared UI pieces

Permissions requested: location (only while punching), camera (selfie), biometrics, Wi-Fi state.
