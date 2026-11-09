# Handoff: Newton Training Center HR system

Paste this into a new Claude / Cowork chat to continue the work.

## Project
- Attendance & HR system for **Newton Training Center** (UAE): 8 branches, about 100 staff.
- GitHub: `shyjan14/shyjan`, branch **`claude/jolly-newton-s60pdd`** (not yet merged into `main`).

| Folder | What |
|---|---|
| `backend/` | NestJS + Prisma + PostgreSQL API |
| `admin-portal/` | Next.js HR portal |
| `mobile-app/` | Flutter app (Android/iOS), app name "Newton HR" |
| `deploy/` | Docker compose files (single server and AWS + RDS), Caddyfile (HTTPS), backup script |
| `docs/` | `ATTENDANCE_HRMS_BLUEPRINT.md` (spec), `DEPLOYMENT-AWS.md` (chosen plan), `DEPLOYMENT.md` (single server / Hostinger VPS) |

## Status (done and tested)
- Attendance: check-in, check-out and breaks, with geofence, selfie, device binding, and fake-GPS and root checks
- UAE leave policy and approvals (manager first, then HR); UAE documents with expiry alerts; reports and payroll CSV; audit log
- Live setup script (`backend/src/setup/setup-production.ts`) creates the **`admin`** login. The password comes from the `ADMIN_PASSWORD` env and is never stored in the code; a password change is forced at first login.
- Tests: backend 8 unit + 15 end-to-end, Flutter analyze + tests, HTTPS Docker stack, and a load test with 100 simultaneous check-ins (about 1.4 s).

## Decisions made
- **Domain:** `newtontraininguae.com`, DNS at **Hostinger**. Planned sub-domains:
  - `hr.newtontraininguae.com`: HR portal
  - `api.newtontraininguae.com`: API for the mobile app
- **Hosting:** AWS, region Middle East (UAE) `me-central-1`
  - EC2 **t3.medium**
  - RDS PostgreSQL **db.t4g.small**, single-AZ, **20 GB**
  - Estimate: about USD 80–100 per month
- The first admin login is `admin`. The owner gives the initial password when running the setup script.
- The mobile app is installed on staff phones (APK / Play Store); it is not uploaded to Hostinger.

## Next steps
1. Owner: check the Hostinger hPanel plan (Websites and VPS). If there's already a VPS, the Hostinger route is an option; otherwise use AWS.
2. Owner: create an AWS account and choose the UAE region (`docs/DEPLOYMENT-AWS.md`, Step 1). Set a USD 120 budget alert.
3. Create RDS (Step 2) → EC2 + Elastic IP (Step 3) → Hostinger DNS A records `hr` and `api` (Step 4) → server commands (Step 5) → go live (Step 6).
4. Build the Android APK:
   ```bash
   cd mobile-app
   ```
   ```bash
   flutter build apk --release
   ```
5. Open a pull request to merge the branch into `main`.

## Not built yet
Server-side face matching, push notifications (Firebase), Arabic screens, payslip PDFs / WPS SIF file, offline punch queue, bulk Excel import.

## Security rules
Never paste passwords, AWS keys, `.pem` files or card details into the chat. Never commit `.env`.
