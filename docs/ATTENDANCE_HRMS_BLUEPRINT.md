# Attendance & Employee Portal: Project Blueprint

**Scope:** Mobile attendance app plus web HR portal for a UAE company with **8 branches and about 100 employees**.
**Status:** Phases 1–5 built (see README for what is done and what is next).

> ⚠️ The UAE Labour Law figures below (leave days, gratuity, working hours) come from Federal Decree-Law No. 33 of 2021 and its Executive Regulations. Ask your HR or legal advisor to confirm them before go-live. Every rule is a **configurable setting** in the system, not a hard-coded value.

---

## 1. What we are building

| Part | Who uses it | Platform |
|---|---|---|
| **Employee mobile app** | All 100 employees | Android + iOS (one Flutter codebase) |
| **Admin / HR web portal** | HR, Branch Managers, Owner | Web browser (desktop + tablet) |
| **Backend API + database** | Both apps | Cloud server (UAE / Middle East region) |

### Core modules
1. **Attendance**: Check-in, Check-out, Break-in, Break-out
2. **Leave management**: Annual, Sick/Medical, Maternity, Parental, Bereavement, Study, Hajj, Unpaid, Comp-off
3. **Employee profile (UAE details)**: Emirates ID, passport, visa, labour card, insurance, with expiry alerts
4. **Shifts & schedules**: per branch, including Ramadan timings
5. **Approvals workflow**: Employee → Branch Manager → HR
6. **Reports & payroll export**: attendance, overtime, leave balance, WPS-ready export
7. **Notifications**: push, email, in-app
8. **Security & audit**

---

## 2. User roles & permissions (RBAC)

| Permission | Employee | Branch Manager | HR Admin | Super Admin (Owner) |
|---|:-:|:-:|:-:|:-:|
| Own check-in / out / breaks | ✅ | ✅ | ✅ | ✅ |
| View own attendance, leave, payslip | ✅ | ✅ | ✅ | ✅ |
| Apply leave / regularization | ✅ | ✅ | ✅ | ✅ |
| View team attendance (own branch) | ❌ | ✅ | ✅ (all) | ✅ (all) |
| Approve leave (first level) | ❌ | ✅ | ✅ | ✅ |
| Final leave approval, edit balances | ❌ | ❌ | ✅ | ✅ |
| Add / edit employees & documents | ❌ | ❌ | ✅ | ✅ |
| Branch, shift, geofence, holiday setup | ❌ | ❌ | ✅ | ✅ |
| Manual attendance correction | ❌ | Request only | ✅ (logged) | ✅ (logged) |
| Roles, security settings, audit logs | ❌ | ❌ | ❌ | ✅ |

Data scoping is enforced **on the server**: a Branch Manager can only query employees of their own branch(es).

---

## 3. Attendance: how it works

### 3.1 Punch types and states
```
 ┌──────────┐ Check-in ┌─────────┐ Break-in ┌─────────┐
 │ OFF DUTY │ ───────▶ │ WORKING │ ───────▶ │ ON BREAK│
 └──────────┘          └─────────┘ ◀─────── └─────────┘
      ▲                     │       Break-out
      └──── Check-out ──────┘
```
- The app shows **only the valid next action**. For example, Check-out is hidden while the employee is on break.
- Multiple breaks per day are allowed. Each break has a configurable maximum (for example 60 min total). Going over the limit raises an alert to the manager.
- **Auto check-out**: if someone forgets, the system closes the day at shift end + X hours, marks it "Missed check-out" and asks for regularization.

### 3.2 Anti-fraud verification on every punch
Each layer can be switched on or off per branch:

| # | Check | Purpose |
|---|---|---|
| 1 | **Geofence**: GPS inside the branch radius (e.g. 100 m) | Employee is physically at the branch |
| 2 | **Mock-location / fake GPS detection** | Blocks spoofing apps |
| 3 | **Selfie + liveness check** (blink / head turn), face-matched with the profile photo | No buddy punching |
| 4 | **Device binding**: one registered phone per employee; changing it needs HR approval | No punching from a friend's phone |
| 5 | **Branch Wi-Fi (BSSID) or rotating QR code** on a tablet at the branch (optional) | Second proof of presence |
| 6 | **Root / jailbreak / emulator detection** | Blocks tampered devices |
| 7 | **Server time only**: the phone clock is ignored | Time cannot be faked |

**Offline mode:** if there is no internet, the punch is stored encrypted on the device with GPS and selfie. It syncs later and is flagged "offline punch" so a manager can review it.

**Field / outdoor staff:** "Remote punch" is allowed only for employees with that permission. It records location and always goes to the manager for approval.

### 3.3 Attendance calculations
- Late arrival / early leaving, with a grace period (e.g. 10 min)
- Total work hours = check-out − check-in − breaks
- **Overtime** (UAE): over 8 hrs/day → +25% rate; between 10 PM and 4 AM → +50%; on rest day / public holiday → substitute day off or +50%
- Status per day: Present, Absent, Late, Half-day, On Leave, Holiday, Weekly Off, Missed Punch
- **Ramadan mode**: the working day is automatically 2 hours shorter for the configured dates
- **Midday break rule** (15 June to 15 Sept, 12:30 to 15:00) for outdoor workers, if applicable

### 3.4 Regularization
If an employee forgot to punch or had a wrong punch, they raise a request with a reason. It is approved by the manager and then HR. The original record is never deleted; corrections are stored as new versions in the audit trail.

---

## 4. Leave management (UAE default policy)

All values are **editable per leave type** in the HR portal.

| Leave type | UAE default | Pay | Notes / system rule |
|---|---|---|---|
| **Annual (vacation)** | 2 days/month after 6 months of service; **30 calendar days/year** after 1 year | Full (basic + housing) | Accrues monthly. Carry-forward limit configurable. Leave encashment on exit. |
| **Sick / Medical** | Up to **90 days/year** (after probation) | First 15 days full, next 30 days half, next 45 days unpaid | **Medical certificate upload mandatory** (if > 1 day, configurable). System auto-calculates pay slabs. |
| **Maternity** | **60 days** | 45 days full + 15 days half | Plus optional unpaid extension |
| **Parental (Father/Mother)** | **5 working days** | Full | Within 6 months of the child's birth |
| **Bereavement** | 5 days (spouse); 3 days (parent, child, sibling, grandparent/grandchild) | Full | Relation is selected when applying |
| **Study / Exam** | 10 working days/year | Full | After 2 years of service; for studies at a UAE-accredited institution |
| **Hajj** | Configurable (commonly once in service) | As company policy | |
| **Unpaid leave** | As approved | None | Affects gratuity and annual leave accrual |
| **Comp-off** | Earned by working on an off day / holiday | Full | Expiry configurable (e.g. 60 days) |
| **Public holidays** | UAE official calendar | Full | HR updates the list every year (Islamic dates change) |

### Leave features
- **Balance dashboard**: Entitled / Taken / Pending / Remaining for each leave type, by year
- **Leave calendar**: team view so managers can see clashes before approving
- **Half-day leave** (first half / second half)
- **Weekend & holiday exclusion** is configurable per leave type (annual leave counts calendar days in UAE; parental leave counts working days)
- **Approval flow**: Employee → Branch Manager → HR. Auto-escalation if there is no action in 48 hours.
- **Cancel / modify** before the start date; after the start date it needs approval
- **Attachments**: medical certificate, death certificate, and so on
- **Delegation**: a manager on leave can assign an approver
- **Year-end processing**: carry forward, lapse, and encashment report

---

## 5. Employee profile: UAE details

| Section | Fields |
|---|---|
| **Personal** | Full name (English + Arabic), photo, DOB, gender, nationality, marital status, religion (optional, for Hajj eligibility), blood group |
| **Contact** | UAE mobile, email, UAE address (emirate, area), home-country address |
| **Emergency contact** | Name, relation, phone (UAE + home country) |
| **Job** | Employee ID, branch, department, designation, manager, joining date, probation end date, contract type (limited/unlimited), contract end date, shift, work location type (office/field) |
| **Emirates ID** | Number, issue date, **expiry**, front/back scan |
| **Passport** | Number, issuing country, **expiry**, scan |
| **Residence Visa** | UID number, file number, sponsor, **expiry**, scan |
| **Labour Card / Work Permit (MOHRE)** | Number, person code, **expiry** |
| **Medical insurance** | Provider, policy number, card number, **expiry**, category |
| **Driving licence** (optional) | Number, emirate, **expiry** |
| **Salary** (HR only) | Basic, housing, transport, other allowances, IBAN, bank, WPS routing code |
| **Gratuity estimate** | Auto-calculated: 21 days of basic per year for the first 5 years, 30 days per year after that (capped at 2 years' wage) |
| **Documents vault** | Offer letter, contract, certificates, payslips, warning letters |

**Expiry alerts:** the system reminds the employee and HR **90, 60, 30 and 7 days before** any document expires. The HR dashboard has an "Expiring documents" widget.

**Self-service:** employees can request changes to their phone, address, emergency contact or bank details. HR approves them. Sensitive fields are read-only for employees.

---

## 6. Screens

### 6.1 Employee mobile app
1. **Splash / Login**: Employee ID + password, then **OTP** on the first login. After that, **Face ID / fingerprint** unlock.
2. **Home dashboard**
   - Greeting, date, today's shift (e.g. 9:00 AM to 6:00 PM, Dubai Mall Branch)
   - **One big action button** that changes by state: `CHECK IN` (green) → `START BREAK` / `CHECK OUT` → `END BREAK`
   - Live timer: hours worked today, break time used
   - Geofence status chip: "✓ You are at Dubai Mall Branch" or "✗ Outside branch (230 m)"
   - Quick cards: Leave balance, This month (present/late/absent), Pending requests
3. **Punch flow**: Tap → location check → selfie camera with face outline → liveness → ✓ success animation + haptic + time stamp
4. **My Attendance**: calendar view with colour-coded days, then day detail (all punches with time, location map, selfie thumbnail)
5. **Leave**: balance cards per type → Apply Leave (type, dates, half-day, reason, attachment) → My Requests (status timeline)
6. **Requests**: regularization, document request (salary certificate, NOC, experience letter), profile change
7. **Profile**: personal, job, UAE documents with expiry badges, my documents (view/download)
8. **Payslips** (phase 2): monthly PDF
9. **Notifications**: approvals, reminders, announcements
10. **Team (managers only)**: who's in / late / on leave today, approve requests, team calendar
11. **Settings**: language (English / Arabic, RTL), dark mode, notifications, change password, registered device

### 6.2 HR / Admin web portal
1. **Dashboard**: today across all 8 branches (Present / Late / Absent / On leave / On break), branch-wise bar chart, live punch feed, expiring documents, pending approvals
2. **Live map**: branches with geofence circles and current punches
3. **Employees**: list with filters (branch, department, status), add/edit, bulk import (Excel), document upload, offboarding
4. **Attendance**: daily register, monthly muster roll, regularizations, manual correction (reason mandatory, logged), flagged punches (offline, face mismatch, remote)
5. **Leave**: requests queue, team calendar, balance adjustments, leave policy setup
6. **Shifts & rosters**: shift templates, weekly roster per branch, Ramadan timings, weekly off rules
7. **Branches**: 8 branches with address, GPS pin + radius picker on the map, Wi-Fi BSSID, QR kiosk, timezone
8. **Holidays**: UAE public holiday calendar
9. **Reports**: attendance summary, late/early report, overtime, absenteeism, leave balance, document expiry, headcount. **Export to Excel/PDF**. Payroll export (WPS SIF format).
10. **Announcements**: send a message to all staff, a branch, or a department
11. **Settings**: roles & users, approval workflows, security policy, audit log viewer

---

## 7. UI / UX design system

**Principles:** one-tap primary action, zero confusion about state, readable outdoors, and usable by staff with low tech literacy.

| Element | Spec |
|---|---|
| **Primary colour** | Deep teal `#0F766E` (trust, calm) |
| **Status colours** | Present / success `#16A34A` · Late / warning `#F59E0B` · Absent / error `#DC2626` · Leave `#2563EB` · Break `#7C3AED` · Holiday `#64748B` |
| **Neutrals** | Background `#F8FAFC`, Surface `#FFFFFF`, Text `#0F172A`, Muted `#64748B` (plus a full dark-mode palette) |
| **Typography** | English: **Inter**. Arabic: **IBM Plex Sans Arabic** (or Noto Kufi Arabic). Sizes 12 / 14 / 16 / 20 / 28 / 40 (timer). |
| **Spacing** | 4-pt grid (4, 8, 12, 16, 24, 32); 16 px screen padding; card radius 16 |
| **Touch targets** | Minimum 48×48 dp; main punch button is 160 dp round |
| **Feedback** | Success animation (Lottie), haptic vibration, clear error messages with a fix ("Turn on location", "Move closer to branch") |
| **Accessibility** | WCAG AA contrast, supports system font scaling, status is never shown by colour alone (icon + text too) |
| **Languages** | English + Arabic with full **RTL layout**; optional Hindi/Malayalam/Tamil/Urdu labels later for staff |
| **Empty & loading states** | Skeleton loaders; friendly empty states ("No leave requests yet") |

**Home screen wireframe (mobile)**
```
┌─────────────────────────────┐
│ Good morning, Ahmed     🔔 │
│ Mon, 9 Nov · Shift 9–6     │
│ 📍 Dubai Mall Branch  ✓    │
│                             │
│        ╭───────────╮        │
│        │  CHECK IN │        │
│        │   08:57   │        │
│        ╰───────────╯        │
│   Worked 0h 00m · Break 0m  │
│                             │
│ ┌─────────┐ ┌─────────┐     │
│ │Annual   │ │Sick     │     │
│ │18.5 left│ │ 87 left │     │
│ └─────────┘ └─────────┘     │
│ This month: 6 P · 1 L · 0 A │
├─────────────────────────────┤
│ 🏠 Home 📅 Attend 🌴 Leave 👤│
└─────────────────────────────┘
```

---

## 8. Security architecture

| Area | Measures |
|---|---|
| **Authentication** | Password (min 10 chars, bcrypt/argon2 hashed) + **OTP on new device**; biometric unlock on the phone; **mandatory MFA (authenticator app) for HR/Admin**; account lock after 5 failed tries |
| **Sessions** | Short-lived JWT access token (15 min) + rotating refresh token (stored in Keychain / Android Keystore); remote logout / device revoke |
| **Authorization** | Role-based + branch-scoped access checked on **every API call** server-side |
| **Transport** | HTTPS/TLS 1.2+ only, **certificate pinning** in the mobile app, HSTS on the portal |
| **Data at rest** | Encrypted database and storage (AES-256); extra field-level encryption for Emirates ID, passport, IBAN and salary |
| **Files** | Selfies & documents in private storage, served only through short-lived signed URLs |
| **Device integrity** | Root/jailbreak/emulator detection, mock-location detection, Play Integrity / App Attest |
| **API protection** | Rate limiting, input validation, WAF, CORS restricted to the portal domain |
| **Audit trail** | Every create/edit/delete/approve/login is stored with who, when, IP, device, old value → new value. Cannot be edited. |
| **Privacy (UAE PDPL)** | Employee consent for location/face data, location captured **only at punch time** (no background tracking), data retention policy, export/delete on request |
| **Hosting** | UAE/Middle East cloud region (e.g. AWS me-central-1 UAE, or Azure UAE North), daily encrypted backups (30-day retention), restore tested quarterly |
| **Monitoring** | Error tracking (Sentry), uptime alerts, suspicious-activity alerts (many failed logins, face mismatch spikes) |
| **Testing** | OWASP Top 10 / MASVS checklist, penetration test before go-live |

---

## 9. Recommended technology stack

| Layer | Choice | Why |
|---|---|---|
| Mobile app | **Flutter** (Dart) | One codebase for Android + iOS, smooth UI, good camera/GPS/biometric plugins |
| Web portal | **Next.js (React) + TypeScript + Tailwind** | Fast, modern admin UI |
| Backend API | **NestJS (Node.js + TypeScript)** | Structured, good built-in security patterns (guards, validation) |
| Database | **PostgreSQL** (+ PostGIS for geofence) | Reliable, relational HR data |
| Cache / queues | Redis + BullMQ | OTP, rate limits, scheduled jobs (auto check-out, expiry alerts, leave accrual) |
| File storage | AWS S3 (private bucket) | Selfies, documents |
| Face verification | AWS Rekognition (or on-device Google ML Kit + server match) | Liveness + face match |
| Push notifications | Firebase Cloud Messaging | Android + iOS |
| Email / SMS OTP | AWS SES / a UAE SMS gateway | |
| Hosting | AWS me-central-1 (UAE) – Docker containers | Data stays in the UAE |

**Estimated monthly running cost for 100 users:** about USD 80–200 (server, database, storage, face API, SMS). Apple Developer is USD 99/year; Google Play is USD 25 one-time.

---

## 10. Database: main tables

```
branches(id, name, emirate, address, lat, lng, radius_m, wifi_bssids[], qr_secret, timezone, active)
departments(id, name)
users(id, employee_code, email, phone, password_hash, role, status, mfa_secret, failed_logins, locked_until)
employees(id, user_id, branch_id, department_id, manager_id, name_en, name_ar, dob, gender, nationality,
          joining_date, probation_end, contract_type, contract_end, designation, work_mode, photo_url, face_template_ref)
employee_documents(id, employee_id, type[EMIRATES_ID|PASSPORT|VISA|LABOUR_CARD|INSURANCE|LICENCE|OTHER],
                   number_enc, issue_date, expiry_date, file_url, verified_by)
employee_salary(id, employee_id, basic, housing, transport, other, iban_enc, bank, effective_from)
devices(id, user_id, device_id, model, os, push_token, status[PENDING|ACTIVE|REVOKED], registered_at)
shifts(id, name, start_time, end_time, break_minutes, grace_minutes, ramadan_start, ramadan_end)
rosters(id, employee_id, date, shift_id, is_weekly_off)
attendance_days(id, employee_id, date, branch_id, first_in, last_out, work_minutes, break_minutes,
                overtime_minutes, late_minutes, status, is_regularized)
punches(id, employee_id, attendance_day_id, type[IN|OUT|BREAK_START|BREAK_END], server_time, device_time,
        lat, lng, accuracy, distance_m, inside_geofence, selfie_url, face_score, liveness_ok,
        wifi_bssid, is_mock_location, is_offline, source[APP|KIOSK|MANUAL], flags[], device_id)
regularizations(id, employee_id, date, requested_in, requested_out, reason, status, approver_chain)
leave_types(id, code, name, yearly_entitlement, accrual_rule, pay_slabs_json, counts_weekends,
            needs_attachment_after_days, min_service_months, carry_forward_max, gender_rule)
leave_balances(id, employee_id, leave_type_id, year, entitled, accrued, taken, pending, carried_forward)
leave_requests(id, employee_id, leave_type_id, from_date, to_date, half_day, days, reason,
               attachment_url, status, current_approver_id)
approvals(id, entity_type, entity_id, level, approver_id, action, comment, acted_at)
holidays(id, date, name, branch_id_nullable)
announcements(id, title, body, audience_json, created_by, created_at)
notifications(id, user_id, type, title, body, read_at)
audit_logs(id, actor_id, action, entity, entity_id, old_json, new_json, ip, device, created_at)  -- append-only
```

---

## 11. Main API endpoints (REST, `/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/otp/verify`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/mfa/verify` |
| Device | `POST /devices/register`, `GET /devices`, `PATCH /devices/:id/approve`, `DELETE /devices/:id` |
| Attendance | `GET /attendance/today`, `POST /attendance/punch` (multipart: type, lat, lng, selfie, bssid, integrity token), `GET /attendance?month=` , `POST /attendance/sync-offline` |
| Regularization | `POST /regularizations`, `GET /regularizations`, `PATCH /regularizations/:id` |
| Leave | `GET /leave/types`, `GET /leave/balances`, `POST /leave/requests`, `GET /leave/requests`, `PATCH /leave/requests/:id/(approve\|reject\|cancel)`, `GET /leave/calendar` |
| Employees | `GET/POST /employees`, `GET/PATCH /employees/:id`, `POST /employees/import`, `GET/POST /employees/:id/documents` |
| Admin setup | `/branches`, `/departments`, `/shifts`, `/rosters`, `/holidays`, `/leave-policies` |
| Reports | `GET /reports/attendance`, `/reports/overtime`, `/reports/leave-balance`, `/reports/document-expiry`, `/reports/payroll-export` |
| Misc | `/notifications`, `/announcements`, `/audit-logs` (Super Admin) |

---

## 12. Background jobs (automatic)

| Job | Schedule |
|---|---|
| Auto check-out & missed-punch marking | Every 30 min |
| Mark absent (no punch, no leave, working day) | Daily 23:59 |
| Annual leave accrual | 1st of every month |
| Document expiry reminders (90/60/30/7 days) | Daily 08:00 |
| Leave approval escalation (48 h) | Hourly |
| "Forgot to check in?" reminder (shift start + 15 min) | Per shift |
| Year-end leave carry forward / lapse | 1 Jan (or company leave year) |
| Database backup | Daily |

---

## 13. Development plan & timeline

| Phase | Duration | Deliverables |
|---|---|---|
| **0. Planning** (this document) | 1 week | Requirements sign-off, UI designs in Figma, leave policy confirmed with HR |
| **1. Foundation** | 2 weeks | Backend setup, database, auth (login + OTP + MFA), roles, branches, employee master, portal login |
| **2. Attendance MVP** | 3 weeks | Mobile app: login, home, check-in/out, breaks, geofence, selfie, device binding. Portal: live dashboard, daily register |
| **3. Leave management** | 2 weeks | Leave types/policies, balances, apply/approve flow, calendar, attachments, notifications |
| **4. Employee portal & UAE documents** | 2 weeks | Full profile, document vault, expiry alerts, self-service requests |
| **5. Shifts, overtime, reports** | 2 weeks | Rosters, Ramadan mode, overtime calc, Excel/PDF reports, payroll export |
| **6. Security hardening & testing** | 1–2 weeks | Face liveness, root/mock detection, cert pinning, pen test, UAT with 1 pilot branch |
| **7. Launch** | 1 week | Play Store + App Store release, data import of 100 employees, staff training, rollout to all 8 branches |
| **Total** | **about 14–15 weeks** | |

**Pilot first:** launch in **1 branch for 2 weeks**, fix feedback, then roll out to the other 7.

---

## 14. Information needed from you before Phase 1

1. Company name, logo and brand colours (if you have any)
2. List of the 8 branches: name, emirate, address, Google Maps pin
3. Shift timings for each branch, weekly off day(s), and break rules
4. Your current leave policy: is it the same as UAE law, or more generous?
5. Approval chain: is it Manager → HR, or a single level?
6. Do you need payroll / payslips in the app now, or later?
7. Are there any field or outdoor staff who need remote punch?
8. Employee data in Excel (we will provide a template)
9. Preferred hosting: AWS UAE / Azure UAE / your own server
10. App languages: English + Arabic? Any others?

---

## 15. Next step

When this blueprint is approved, development starts with **Phase 1**:
- `backend/`: NestJS API, PostgreSQL schema, auth & RBAC
- `admin-portal/`: Next.js HR portal
- `mobile-app/`: Flutter employee app

All three live in this repository.
