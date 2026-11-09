/**
 * Demo / initial data: 8 UAE branches, shifts, UAE leave policy, 2026 public holidays,
 * Super Admin, HR Admin, 8 Branch Managers and sample employees.
 *
 *   npm run db:seed
 *
 * ⚠️ Change every password after first login. Islamic holiday dates depend on moon sighting —
 * HR must confirm them each year in the portal.
 */
import { PrismaClient, Role, Gender } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const d = (s: string) => new Date(`${s}T00:00:00Z`);

const BRANCHES = [
  { code: 'DXB-HQ', name: 'Dubai Head Office (Business Bay)', emirate: 'Dubai', latitude: 25.1857, longitude: 55.2721 },
  { code: 'DXB-MALL', name: 'Dubai Mall Branch', emirate: 'Dubai', latitude: 25.1985, longitude: 55.2796 },
  { code: 'DXB-DEIRA', name: 'Deira Branch', emirate: 'Dubai', latitude: 25.2697, longitude: 55.3095 },
  { code: 'AUH-01', name: 'Abu Dhabi Branch', emirate: 'Abu Dhabi', latitude: 24.4539, longitude: 54.3773 },
  { code: 'AAN-01', name: 'Al Ain Branch', emirate: 'Abu Dhabi', latitude: 24.2075, longitude: 55.7447 },
  { code: 'SHJ-01', name: 'Sharjah Branch', emirate: 'Sharjah', latitude: 25.3463, longitude: 55.4209 },
  { code: 'AJM-01', name: 'Ajman Branch', emirate: 'Ajman', latitude: 25.4052, longitude: 55.5136 },
  { code: 'RAK-01', name: 'Ras Al Khaimah Branch', emirate: 'Ras Al Khaimah', latitude: 25.7895, longitude: 55.9432 },
];

const LEAVE_TYPES = [
  { code: 'ANNUAL', name: 'Annual Leave (Vacation)', yearlyDays: 30, accrualMonthly: true, countsCalendarDays: true, carryForwardMax: 15, sortOrder: 1,
    description: '2 days/month after 6 months of service; 30 calendar days per year after 1 year.' },
  { code: 'SICK', name: 'Sick / Medical Leave', yearlyDays: 90, countsCalendarDays: true, attachmentAfterDays: 1, requiresProbationDone: true, sortOrder: 2,
    paySlabs: [{ days: 15, pay: 'FULL' }, { days: 30, pay: 'HALF' }, { days: 45, pay: 'UNPAID' }],
    description: 'Up to 90 days/year after probation: 15 days full pay, 30 days half pay, 45 days unpaid. Medical certificate required for more than 1 day.' },
  { code: 'MATERNITY', name: 'Maternity Leave', yearlyDays: 60, countsCalendarDays: true, genderRule: 'FEMALE' as Gender, attachmentAfterDays: 0, allowHalfDay: false, sortOrder: 3,
    paySlabs: [{ days: 45, pay: 'FULL' }, { days: 15, pay: 'HALF' }], description: '60 days: 45 days full pay + 15 days half pay.' },
  { code: 'PARENTAL', name: 'Parental Leave', yearlyDays: 5, countsCalendarDays: false, allowHalfDay: false, attachmentAfterDays: 0, sortOrder: 4,
    description: '5 working days, within 6 months of the child\'s birth.' },
  { code: 'BEREAVEMENT', name: 'Bereavement Leave', yearlyDays: 0, countsCalendarDays: true, allowHalfDay: false, sortOrder: 5,
    description: '5 days for spouse; 3 days for parent, child, sibling, grandparent or grandchild.' },
  { code: 'STUDY', name: 'Study / Exam Leave', yearlyDays: 10, countsCalendarDays: false, minServiceMonths: 24, attachmentAfterDays: 0, sortOrder: 6,
    description: '10 working days per year for exams at a UAE-accredited institution, after 2 years of service.' },
  { code: 'HAJJ', name: 'Hajj Leave', yearlyDays: 0, countsCalendarDays: true, minServiceMonths: 12, paid: false, allowHalfDay: false, sortOrder: 7,
    description: 'Once during service, as per company policy.' },
  { code: 'UNPAID', name: 'Unpaid Leave', yearlyDays: 0, countsCalendarDays: true, paid: false, sortOrder: 8,
    description: 'Subject to approval. Affects salary and annual leave accrual.' },
];

const HOLIDAYS_2026 = [
  ['2026-01-01', "New Year's Day"],
  ['2026-03-19', 'Eid Al Fitr (est.)'], ['2026-03-20', 'Eid Al Fitr (est.)'], ['2026-03-21', 'Eid Al Fitr (est.)'],
  ['2026-05-26', 'Arafat Day (est.)'], ['2026-05-27', 'Eid Al Adha (est.)'], ['2026-05-28', 'Eid Al Adha (est.)'], ['2026-05-29', 'Eid Al Adha (est.)'],
  ['2026-06-16', 'Islamic New Year (est.)'],
  ['2026-08-25', "Prophet Muhammad's Birthday (est.)"],
  ['2026-12-01', 'Commemoration Day'],
  ['2026-12-02', 'UAE National Day'], ['2026-12-03', 'UAE National Day'],
];

const FIRST = ['Ahmed', 'Fatima', 'Mohammed', 'Aisha', 'Ravi', 'Priya', 'John', 'Maria', 'Omar', 'Sara', 'Arjun', 'Lakshmi', 'Ali', 'Mariam', 'Joseph', 'Anitha', 'Hassan', 'Noura', 'Suresh', 'Divya', 'Khalid', 'Reem', 'Vijay', 'Meena'];
const LAST = ['Al Mansoori', 'Khan', 'Nair', 'Kumar', 'Fernandes', 'Hussain', 'Pillai', 'Rahman', 'Thomas', 'Shah', 'Iyer', 'Ahmed'];
const NATIONALITIES = ['Emirati', 'Indian', 'Pakistani', 'Filipino', 'Egyptian', 'Indian', 'Bangladeshi', 'Indian'];

async function main() {
  const demoPw = process.env.SEED_PASSWORD ?? 'Welcome@2026';
  const hash = await bcrypt.hash(demoPw, 12);

  const general = await prisma.shift.upsert({
    where: { name: 'General 9-6' }, update: {},
    create: { name: 'General 9-6', startTime: '09:00', endTime: '18:00', breakMinutes: 60, graceMinutes: 10, weeklyOffDays: [0] },
  });
  const retail = await prisma.shift.upsert({
    where: { name: 'Retail 10-7' }, update: {},
    create: { name: 'Retail 10-7', startTime: '10:00', endTime: '19:00', breakMinutes: 60, graceMinutes: 10, weeklyOffDays: [5] },
  });

  for (const t of LEAVE_TYPES) await prisma.leaveType.upsert({ where: { code: t.code }, update: {}, create: t as any });
  for (const [date, name] of HOLIDAYS_2026) await prisma.holiday.upsert({ where: { date_name: { date: d(date), name } }, update: {}, create: { date: d(date), name } });

  const depts: Record<string, string> = {};
  for (const n of ['Management', 'Human Resources', 'Sales', 'Operations', 'Finance', 'Customer Service']) {
    depts[n] = (await prisma.department.upsert({ where: { name: n }, update: {}, create: { name: n } })).id;
  }

  const branches = [];
  for (const b of BRANCHES) branches.push(await prisma.branch.upsert({ where: { code: b.code }, update: {}, create: { ...b, radiusM: 150, address: `${b.name}, ${b.emirate}, UAE` } }));
  const hq = branches[0];

  let seq = 1;
  const code = () => `EMP${String(seq++).padStart(3, '0')}`;
  async function person(p: { role: Role; first: string; last: string; email?: string; designation: string; dept: string; branchId: string; managerId?: string; gender: Gender; nationality: string; joining: string; retail?: boolean }) {
    const employeeCode = code();
    const email = (p.email ?? `${p.first}.${p.last.replace(/\s/g, '')}.${employeeCode}@example.com`).toLowerCase();
    const existing = await prisma.user.findUnique({ where: { employeeCode }, include: { employee: true } });
    if (existing) return existing.employee!;
    const u = await prisma.user.create({
      data: {
        employeeCode, email, phone: `+9715${String(10000000 + seq * 7919).slice(0, 8)}`, role: p.role, passwordHash: hash, mustChangePwd: false,
        employee: {
          create: {
            firstName: p.first, lastName: p.last, designation: p.designation, gender: p.gender, nationality: p.nationality,
            branchId: p.branchId, departmentId: depts[p.dept], managerId: p.managerId, shiftId: p.retail ? retail.id : general.id,
            joiningDate: d(p.joining), probationEnd: new Date(d(p.joining).getTime() + 180 * 86_400_000), contractType: 'UNLIMITED',
            emirate: 'Dubai', basicSalary: 6000, housingAllow: 2500, transportAllow: 800, bankName: 'Emirates NBD',
            emergencyName: 'Family contact', emergencyRelation: 'Spouse', emergencyPhone: '+971500000000',
          },
        },
      },
      include: { employee: true },
    });
    const empId = u.employee!.id;
    const base = 400 + seq * 13;
    await prisma.employeeDocument.createMany({
      data: [
        { employeeId: empId, type: 'EMIRATES_ID', number: `784-1990-${String(1000000 + seq).slice(0, 7)}-1`, expiryDate: new Date(Date.now() + (base % 700) * 86_400_000) },
        { employeeId: empId, type: 'PASSPORT', number: `P${String(4000000 + seq)}`, expiryDate: new Date(Date.now() + (base * 3 % 1500) * 86_400_000) },
        { employeeId: empId, type: 'RESIDENCE_VISA', number: `201/2024/${seq}`, expiryDate: new Date(Date.now() + ((base * 7) % 500 + 5) * 86_400_000) },
        { employeeId: empId, type: 'LABOUR_CARD', number: `LC${100000 + seq}`, expiryDate: new Date(Date.now() + ((base * 7) % 500 + 5) * 86_400_000) },
        { employeeId: empId, type: 'MEDICAL_INSURANCE', number: `INS-${seq}`, expiryDate: new Date(Date.now() + ((base * 11) % 365 + 3) * 86_400_000) },
      ],
    });
    return u.employee!;
  }

  await person({ role: 'SUPER_ADMIN', first: 'Company', last: 'Owner', email: 'owner@example.com', designation: 'Managing Director', dept: 'Management', branchId: hq.id, gender: 'MALE', nationality: 'Emirati', joining: '2018-01-01' });
  await person({ role: 'HR_ADMIN', first: 'Hana', last: 'Rashid', email: 'hr@example.com', designation: 'HR Manager', dept: 'Human Resources', branchId: hq.id, gender: 'FEMALE', nationality: 'Jordanian', joining: '2019-03-10' });

  let n = 0;
  for (const [i, b] of branches.entries()) {
    const retail = b.code.includes('MALL') || i >= 5;
    const mgr = await person({
      role: 'BRANCH_MANAGER', first: FIRST[(i * 3) % FIRST.length], last: LAST[i % LAST.length],
      email: i === 1 ? 'manager.mall@example.com' : undefined,
      designation: 'Branch Manager', dept: 'Operations', branchId: b.id, gender: i % 2 ? 'FEMALE' : 'MALE', nationality: NATIONALITIES[i], joining: '2020-06-01', retail,
    });
    await prisma.branch.update({ where: { id: b.id }, data: { managers: { connect: { id: mgr.userId } } } });
    for (let k = 0; k < 3; k++) {
      n++;
      await person({
        role: 'EMPLOYEE', first: FIRST[(n * 5 + k) % FIRST.length], last: LAST[(n + k) % LAST.length],
        email: n === 4 ? 'employee@example.com' : undefined,
        designation: ['Sales Executive', 'Cashier', 'Customer Service Officer'][k], dept: ['Sales', 'Finance', 'Customer Service'][k],
        branchId: b.id, managerId: mgr.id, gender: (n + k) % 3 === 0 ? 'FEMALE' : 'MALE', nationality: NATIONALITIES[(n + k) % NATIONALITIES.length],
        joining: k === 2 ? '2026-04-01' : '2022-02-15', retail,
      });
    }
  }

  console.log('\nSeed complete. Demo logins (password for all: %s)', demoPw);
  console.log('  Super Admin   : owner@example.com');
  console.log('  HR Admin      : hr@example.com');
  console.log('  Branch Manager: manager.mall@example.com  (Dubai Mall Branch)');
  console.log('  Employee      : employee@example.com      (Dubai Mall Branch)');
  console.log('  Employee codes EMP001 … also work as login.\n');
}

main().finally(() => prisma.$disconnect());
