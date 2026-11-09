/**
 * First-time setup for the LIVE system (no demo data).
 *
 * Creates: UAE leave policy, 2026 UAE public holidays, departments, a default shift,
 * one "Head Office" branch (update its GPS location in the portal) and the Super Admin login.
 *
 *   ADMIN_PASSWORD='...' npm run setup:prod                       (development)
 *   docker compose exec -e ADMIN_PASSWORD='...' api node dist/setup/setup-production.js   (server)
 *
 * Optional env: ADMIN_USERNAME (default "admin"), ADMIN_EMAIL, COMPANY_NAME.
 * The password is never stored in the code. The admin must change it at first login.
 * Safe to run again: existing records are kept and the admin password is NOT overwritten.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { d, DEPARTMENTS, HOLIDAYS_2026, LEAVE_TYPES } from './reference-data';

async function main() {
  const prisma = new PrismaClient();
  const company = process.env.COMPANY_NAME ?? 'Newton Training Center';
  const username = (process.env.ADMIN_USERNAME ?? 'admin').trim().toUpperCase();
  const email = (process.env.ADMIN_EMAIL ?? 'admin@newton-training-center.local').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';

  if (!/^[A-Z0-9-]{2,20}$/.test(username)) throw new Error('ADMIN_USERNAME must be 2-20 letters, numbers or dashes');

  try {
    for (const t of LEAVE_TYPES) await prisma.leaveType.upsert({ where: { code: t.code }, update: {}, create: t as any });
    for (const [date, name] of HOLIDAYS_2026) {
      await prisma.holiday.upsert({ where: { date_name: { date: d(date), name } }, update: {}, create: { date: d(date), name } });
    }
    for (const name of DEPARTMENTS) await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
    const shift = await prisma.shift.upsert({
      where: { name: 'General 9-6' }, update: {},
      create: { name: 'General 9-6', startTime: '09:00', endTime: '18:00', breakMinutes: 60, graceMinutes: 10, weeklyOffDays: [0] },
    });
    const hq = await prisma.branch.upsert({
      where: { code: 'HQ' }, update: {},
      // Placeholder location (Dubai). Set the real GPS pin and radius in Portal → Branches & shifts.
      create: { code: 'HQ', name: `${company} - Head Office`, emirate: 'Dubai', latitude: 25.2048, longitude: 55.2708, radiusM: 150, address: 'Update address in portal' },
    });

    const existing = await prisma.user.findUnique({ where: { employeeCode: username } });
    if (existing) {
      console.log(`Admin "${username.toLowerCase()}" already exists — password left unchanged.`);
    } else {
      if (password.length < 8) throw new Error('Set ADMIN_PASSWORD (at least 8 characters) to create the admin account');
      const mgmt = await prisma.department.findUniqueOrThrow({ where: { name: 'Management' } });
      await prisma.user.create({
        data: {
          employeeCode: username, email, role: 'SUPER_ADMIN',
          passwordHash: await bcrypt.hash(password, 12),
          mustChangePwd: true,
          employee: {
            create: {
              firstName: 'System', lastName: 'Administrator', designation: 'Administrator', gender: 'MALE', nationality: 'UAE',
              branchId: hq.id, departmentId: mgmt.id, shiftId: shift.id, joiningDate: d(new Date().toISOString().slice(0, 10)),
            },
          },
        },
      });
      await prisma.auditLog.create({ data: { action: 'SYSTEM_SETUP', entity: 'User', newValue: { username, company } } });
      console.log(`Admin "${username.toLowerCase()}" created. Sign in to the portal and change the password.`);
    }
    console.log(`\n${company}: setup complete.`);
    console.log('Next: Portal → Branches & shifts → set Head Office GPS, add your other branches, then add employees.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Setup failed:', e.message);
  process.exit(1);
});
