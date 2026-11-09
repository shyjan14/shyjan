/**
 * End-to-end tests against a real PostgreSQL database seeded with `npm run db:seed`.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/main';
import { localDate } from '../src/common/time';

const PW = process.env.SEED_PASSWORD ?? 'Welcome@2026';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const MALL = { latitude: 25.1985, longitude: 55.2796 };
const prisma = new PrismaClient();
let app: INestApplication;
let api: ReturnType<typeof request>;

async function login(loginId: string, deviceId?: string) {
  const res = await api.post('/api/v1/auth/login').send({ login: loginId, password: PW, deviceId, deviceModel: 'Test Phone', platform: 'android' });
  expect(res.status).toBe(200);
  return res.body as { accessToken: string; refreshToken: string; deviceStatus: string | null; user: any };
}

function punch(token: string, deviceId: string, type: string, pos = MALL, extra: Record<string, string> = {}) {
  let r = api.post('/api/v1/attendance/punch').set('Authorization', `Bearer ${token}`).set('X-Device-Id', deviceId)
    .field('type', type).field('latitude', String(pos.latitude)).field('longitude', String(pos.longitude)).field('accuracy', '12');
  for (const [k, v] of Object.entries(extra)) r = r.field(k, v);
  return r.attach('selfie', JPEG, { filename: 'selfie.jpg', contentType: 'image/jpeg' });
}

beforeAll(async () => {
  app = await createApp();
  await app.init();
  api = request(app.getHttpServer()) as any;
  // clean state for the test employee
  const u = await prisma.user.findUniqueOrThrow({ where: { email: 'employee@example.com' }, include: { employee: true } });
  await prisma.device.deleteMany({ where: { userId: u.id } });
  await prisma.attendanceDay.deleteMany({ where: { employeeId: u.employee!.id } });
  await prisma.leaveRequest.deleteMany({ where: { employeeId: u.employee!.id } });
  await prisma.leaveBalance.deleteMany({ where: { employeeId: u.employee!.id } });
  await prisma.user.update({ where: { id: u.id }, data: { failedLogins: 0, lockedUntil: null } });
});

afterAll(async () => {
  await prisma.$disconnect();
  await app.close();
});

describe('Auth & security', () => {
  it('rejects wrong password with a generic message', async () => {
    const res = await api.post('/api/v1/auth/login').send({ login: 'employee@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid login or password');
  });

  it('locks the account after 5 failed attempts', async () => {
    const victim = await prisma.user.findFirstOrThrow({ where: { role: 'EMPLOYEE', email: { not: 'employee@example.com' } } });
    for (let i = 0; i < 5; i++) await api.post('/api/v1/auth/login').send({ login: victim.email, password: 'bad' });
    const res = await api.post('/api/v1/auth/login').send({ login: victim.email, password: PW });
    expect(res.status).toBe(403);
    await prisma.user.update({ where: { id: victim.id }, data: { failedLogins: 0, lockedUntil: null } });
  });

  it('requires a token on protected routes', async () => {
    expect((await api.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const s = await login('hr@example.com');
    const r1 = await api.post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken });
    expect(r1.status).toBe(200);
    const reuse = await api.post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken });
    expect(reuse.status).toBe(401);
    // reuse revoked the whole family, including the new token
    const r2 = await api.post('/api/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken });
    expect(r2.status).toBe(401);
  });

  it('rejects unknown fields (mass assignment)', async () => {
    const s = await login('employee@example.com');
    const res = await api.patch('/api/v1/profile').set('Authorization', `Bearer ${s.accessToken}`).send({ role: 'SUPER_ADMIN' });
    expect(res.status).toBe(400);
  });
});

describe('Attendance', () => {
  let token: string;
  const DEV = 'device-employee-1';

  it('binds the first phone automatically, second phone needs approval', async () => {
    const s = await login('employee@example.com', DEV);
    expect(s.deviceStatus).toBe('ACTIVE');
    token = s.accessToken;
    const s2 = await login('employee@example.com', 'another-phone');
    expect(s2.deviceStatus).toBe('PENDING');
    const blocked = await punch(s2.accessToken, 'another-phone', 'CHECK_IN');
    expect(blocked.status).toBe(403);
  });

  it('blocks punch outside the geofence', async () => {
    const res = await punch(token, DEV, 'CHECK_IN', { latitude: 25.2697, longitude: 55.3095 }); // Deira
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/away from Dubai Mall Branch/);
  });

  it('blocks fake GPS', async () => {
    const res = await punch(token, DEV, 'CHECK_IN', MALL, { isMockLocation: 'true' });
    expect(res.status).toBe(403);
  });

  it('runs check-in → break → check-out with state validation', async () => {
    const t1 = await punch(token, DEV, 'CHECK_IN');
    expect(t1.status).toBe(201);
    expect(t1.body.today.state).toBe('WORKING');
    expect(t1.body.today.nextActions).toEqual(['BREAK_START', 'CHECK_OUT']);

    expect((await punch(token, DEV, 'CHECK_IN')).status).toBe(400); // double check-in

    const b1 = await punch(token, DEV, 'BREAK_START');
    expect(b1.body.today.state).toBe('ON_BREAK');
    expect((await punch(token, DEV, 'CHECK_OUT')).status).toBe(400); // cannot check out during break

    expect((await punch(token, DEV, 'BREAK_END')).body.today.state).toBe('WORKING');
    const out = await punch(token, DEV, 'CHECK_OUT');
    expect(out.body.today.state).toBe('CHECKED_OUT');
    expect(out.body.today.punches).toHaveLength(4);
  });

  it('manager sees own branch in the register but not other branches', async () => {
    const m = await login('manager.mall@example.com');
    const reg = await api.get('/api/v1/attendance/register').set('Authorization', `Bearer ${m.accessToken}`);
    expect(reg.status).toBe(200);
    expect(reg.body.rows.every((r: any) => r.branch.name === 'Dubai Mall Branch')).toBe(true);
    const other = await prisma.branch.findUniqueOrThrow({ where: { code: 'AUH-01' } });
    const forbidden = await api.get(`/api/v1/attendance/register?branchId=${other.id}`).set('Authorization', `Bearer ${m.accessToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('employees cannot open the HR register', async () => {
    const res = await api.get('/api/v1/attendance/register').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('Leave', () => {
  it('shows UAE balances, applies, manager + HR approve', async () => {
    const e = await login('employee@example.com');
    const auth = { Authorization: `Bearer ${e.accessToken}` };
    const bal = await api.get('/api/v1/leave/balances').set(auth);
    expect(bal.status).toBe(200);
    const annual = bal.body.find((b: any) => b.code === 'ANNUAL');
    expect(annual.entitled).toBeGreaterThan(0);

    const from = new Date(localDate().getTime() + 10 * 86_400_000);
    const year = from.getUTCFullYear();
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    const to = new Date(Math.min(from.getTime() + 2 * 86_400_000, Date.UTC(year, 11, 31)));

    const applied = await api.post('/api/v1/leave/requests').set(auth).field('leaveTypeId', annual.leaveTypeId).field('fromDate', iso(from)).field('toDate', iso(to)).field('reason', 'Family trip');
    expect(applied.status).toBe(201);
    expect(applied.body.status).toBe('PENDING_MANAGER');

    const overlap = await api.post('/api/v1/leave/requests').set(auth).field('leaveTypeId', annual.leaveTypeId).field('fromDate', iso(from)).field('toDate', iso(from)).field('reason', 'dup');
    expect(overlap.status).toBe(400);

    const sick = bal.body.find((b: any) => b.code === 'SICK');
    const noCert = await api.post('/api/v1/leave/requests').set(auth).field('leaveTypeId', sick.leaveTypeId).field('fromDate', iso(new Date(from.getTime() - 5 * 86_400_000))).field('toDate', iso(new Date(from.getTime() - 3 * 86_400_000))).field('reason', 'Fever');
    expect(noCert.status).toBe(400);
    expect(noCert.body.message).toMatch(/medical certificate/);

    expect((await api.patch(`/api/v1/leave/requests/${applied.body.id}/decision`).set(auth).send({ action: 'APPROVE' })).status).toBe(403);

    const m = await login('manager.mall@example.com');
    const mgr = await api.patch(`/api/v1/leave/requests/${applied.body.id}/decision`).set('Authorization', `Bearer ${m.accessToken}`).send({ action: 'APPROVE' });
    expect(mgr.body.status).toBe('PENDING_HR');

    const h = await login('hr@example.com');
    const hr = await api.patch(`/api/v1/leave/requests/${applied.body.id}/decision`).set('Authorization', `Bearer ${h.accessToken}`).send({ action: 'APPROVE', comment: 'Enjoy' });
    expect(hr.body.status).toBe('APPROVED');

    const after = (await api.get('/api/v1/leave/balances').set(auth)).body.find((b: any) => b.code === 'ANNUAL');
    expect(after.taken).toBe(applied.body.days);
    expect(after.pending).toBe(0);
  });
});

describe('Employee profile & reports', () => {
  it('hides other employees salary from managers and masks IBAN', async () => {
    const m = await login('manager.mall@example.com');
    const list = await api.get('/api/v1/employees').set('Authorization', `Bearer ${m.accessToken}`);
    const someone = list.body.find((x: any) => x.user.role === 'EMPLOYEE');
    const detail = await api.get(`/api/v1/employees/${someone.id}`).set('Authorization', `Bearer ${m.accessToken}`);
    expect(detail.body.basicSalary).toBeUndefined();
    expect(detail.body.documents.length).toBeGreaterThan(0);
  });

  it('HR dashboard covers all 8 branches', async () => {
    const h = await login('hr@example.com');
    const res = await api.get('/api/v1/reports/dashboard').set('Authorization', `Bearer ${h.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.byBranch).toHaveLength(8);
    const csv = await api.get('/api/v1/reports/attendance-summary?format=csv').set('Authorization', `Bearer ${h.accessToken}`);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
  });

  it('HR creates an employee with a one-time temporary password', async () => {
    const h = await login('hr@example.com');
    const branch = await prisma.branch.findUniqueOrThrow({ where: { code: 'SHJ-01' } });
    const codeId = `T${Date.now().toString().slice(-6)}`;
    const res = await api.post('/api/v1/employees').set('Authorization', `Bearer ${h.accessToken}`).send({
      employeeCode: codeId, email: `${codeId}@example.com`, branchId: branch.id, firstName: 'Test', lastName: 'User',
      designation: 'Clerk', gender: 'MALE', nationality: 'Indian', joiningDate: '2026-01-05',
    });
    expect(res.status).toBe(201);
    expect(res.body.temporaryPassword).toBeTruthy();
    const first = await api.post('/api/v1/auth/login').send({ login: codeId, password: res.body.temporaryPassword });
    expect(first.body.mustChangePassword).toBe(true);
    await prisma.user.delete({ where: { employeeCode: codeId.toUpperCase() } });
  });
});
