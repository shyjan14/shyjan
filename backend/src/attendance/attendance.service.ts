import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DayStatus, Punch, PunchType, Shift } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { AuthUser, isHr } from '../common/decorators';
import { distanceMeters } from '../common/geo';
import { PrismaService } from '../common/prisma.service';
import { assertBranchInScope, employeeScope } from '../common/scope';
import { StorageService } from '../common/storage.service';
import { addDays, fmtDate, localDate, localDateTime, minutesBetween, parseDate } from '../common/time';
import { DecisionDto, ManualPunchDto, PunchDto, RegularizationDto } from './attendance.dto';

const MAX_GPS_ACCURACY_M = 150;
const OVERTIME_MIN_THRESHOLD = 30;

export const DEFAULT_SHIFT = { startTime: '09:00', endTime: '18:00', breakMinutes: 60, graceMinutes: 10, weeklyOffDays: [0] };

/** Which punches are valid after the last one. */
export function nextActions(last: PunchType | undefined): PunchType[] {
  switch (last) {
    case undefined:
    case 'CHECK_OUT':
      return ['CHECK_IN'];
    case 'CHECK_IN':
    case 'BREAK_END':
      return ['BREAK_START', 'CHECK_OUT'];
    case 'BREAK_START':
      return ['BREAK_END'];
  }
}

/** Work and break minutes from an ordered list of punches. Open intervals run until `now`. */
export function computeMinutes(punches: Pick<Punch, 'type' | 'serverTime'>[], now?: Date) {
  let work = 0, brk = 0;
  let inAt: Date | null = null, breakAt: Date | null = null;
  for (const p of punches) {
    if (p.type === 'CHECK_IN') inAt = p.serverTime;
    else if (p.type === 'BREAK_START' && inAt) { work += minutesBetween(inAt, p.serverTime); inAt = null; breakAt = p.serverTime; }
    else if (p.type === 'BREAK_END' && breakAt) { brk += minutesBetween(breakAt, p.serverTime); breakAt = null; inAt = p.serverTime; }
    else if (p.type === 'CHECK_OUT' && inAt) { work += minutesBetween(inAt, p.serverTime); inAt = null; }
  }
  if (now) {
    if (inAt) work += minutesBetween(inAt, now);
    if (breakAt) brk += minutesBetween(breakAt, now);
  }
  return { work, brk };
}

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService, private storage: StorageService, private audit: AuditService) {}

  private async loadEmployee(employeeId: string) {
    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId }, include: { branch: true, shift: true } });
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  async punch(u: AuthUser, dto: PunchDto, selfie: Express.Multer.File | undefined, deviceId: string | undefined, req: any) {
    if (!u.employeeId) throw new ForbiddenException('No employee profile linked to this account');
    const emp = await this.loadEmployee(u.employeeId);
    const flags: string[] = [];

    // 1. Device binding
    if (!deviceId) throw new ForbiddenException('Punching is only allowed from the registered mobile app');
    const device = await this.prisma.device.findUnique({ where: { userId_deviceId: { userId: u.userId, deviceId } } });
    if (!device || device.status !== 'ACTIVE') {
      throw new ForbiddenException('This phone is not approved for attendance yet. Ask HR to approve your device.');
    }

    // 2. Device integrity / fake GPS
    if (dto.isMockLocation || dto.isRooted) {
      await this.audit.log({ actorId: u.userId, action: 'PUNCH_BLOCKED_TAMPER', entity: 'Employee', entityId: emp.id, newValue: dto, req });
      throw new ForbiddenException('Fake location or modified phone detected. Punch blocked and reported to HR.');
    }
    if (dto.accuracy > MAX_GPS_ACCURACY_M) {
      throw new BadRequestException(`GPS signal is weak (±${Math.round(dto.accuracy)} m). Move to an open area and try again.`);
    }

    // 3. Geofence (or branch Wi-Fi)
    const distance = distanceMeters(dto.latitude, dto.longitude, emp.branch.latitude, emp.branch.longitude);
    const wifiMatch = !!dto.wifiBssid && emp.branch.wifiBssids.map((b) => b.toLowerCase()).includes(dto.wifiBssid.toLowerCase());
    const inside = distance <= emp.branch.radiusM || wifiMatch;
    if (!inside) {
      if (!emp.allowRemotePunch) {
        throw new ForbiddenException(`You are ${Math.round(distance)} m away from ${emp.branch.name}. Please punch inside the branch.`);
      }
      flags.push('REMOTE');
    }
    if (wifiMatch) flags.push('WIFI_VERIFIED');

    // 4. Selfie (face match is done by the face-verification provider; stored for review)
    if (process.env.REQUIRE_SELFIE !== 'false' && !selfie) throw new BadRequestException('Selfie is required');
    const selfieUrl = selfie ? await this.storage.save(emp.id, selfie, ['image/jpeg']) : null;

    if (dto.offline) flags.push('OFFLINE');

    // 5. State machine — server time only
    const now = new Date();
    const date = localDate(now);
    const day = await this.prisma.attendanceDay.upsert({
      where: { employeeId_date: { employeeId: emp.id, date } },
      create: { employeeId: emp.id, branchId: emp.branchId, date },
      update: {},
      include: { punches: { orderBy: { serverTime: 'asc' } } },
    });
    const allowed = nextActions(day.punches.at(-1)?.type);
    if (!allowed.includes(dto.type)) {
      throw new BadRequestException(`You can't do ${dto.type.replace('_', ' ').toLowerCase()} now. Allowed: ${allowed.join(', ')}`);
    }

    const punch = await this.prisma.punch.create({
      data: {
        employeeId: emp.id, attendanceDayId: day.id, type: dto.type, serverTime: now,
        deviceTime: dto.deviceTime ? new Date(dto.deviceTime) : null,
        latitude: dto.latitude, longitude: dto.longitude, accuracyM: dto.accuracy,
        distanceM: Math.round(distance), insideGeofence: inside, wifiBssid: dto.wifiBssid,
        selfieUrl, deviceId, source: 'APP', isOffline: !!dto.offline, isRemote: !inside, flags, note: dto.note,
      },
    });
    await this.recompute(day.id);
    return { punch, today: await this.today(u) };
  }

  /** Recalculate totals, late / early / overtime and status for one day. */
  async recompute(dayId: string) {
    const day = await this.prisma.attendanceDay.findUniqueOrThrow({
      where: { id: dayId },
      include: { punches: { orderBy: { serverTime: 'asc' } }, employee: { include: { shift: true } } },
    });
    const shift: Pick<Shift, 'startTime' | 'endTime' | 'breakMinutes' | 'graceMinutes'> = day.employee.shift ?? DEFAULT_SHIFT;
    const { work, brk } = computeMinutes(day.punches);
    const firstIn = day.punches.find((p) => p.type === 'CHECK_IN')?.serverTime ?? null;
    const last = day.punches.at(-1);
    const lastOut = last?.type === 'CHECK_OUT' ? last.serverTime : null;

    const shiftStart = localDateTime(day.date, shift.startTime);
    const shiftEnd = localDateTime(day.date, shift.endTime);
    const required = minutesBetween(shiftStart, shiftEnd) - shift.breakMinutes;

    const late = firstIn && firstIn > new Date(shiftStart.getTime() + shift.graceMinutes * 60_000) ? minutesBetween(shiftStart, firstIn) : 0;
    const early = lastOut && lastOut < shiftEnd ? minutesBetween(lastOut, shiftEnd) : 0;
    const ot = work - required >= OVERTIME_MIN_THRESHOLD ? work - required : 0;

    let status: DayStatus = day.status;
    if (firstIn) status = late ? 'LATE' : 'PRESENT'; // includes working on an off day / holiday
    if (lastOut && work < required / 2) status = 'HALF_DAY';
    if (day.autoClosed) status = 'MISSED_PUNCH';

    return this.prisma.attendanceDay.update({
      where: { id: day.id },
      data: { firstIn, lastOut, workMinutes: work, breakMinutes: brk, lateMinutes: late, earlyMinutes: early, overtimeMinutes: ot, status },
    });
  }

  async today(u: AuthUser) {
    if (!u.employeeId) throw new ForbiddenException('No employee profile');
    const emp = await this.loadEmployee(u.employeeId);
    const date = localDate();
    const day = await this.prisma.attendanceDay.findUnique({
      where: { employeeId_date: { employeeId: emp.id, date } },
      include: { punches: { orderBy: { serverTime: 'asc' }, select: { id: true, type: true, serverTime: true, distanceM: true, flags: true } } },
    });
    const punches = day?.punches ?? [];
    const last = punches.at(-1)?.type;
    const live = computeMinutes(punches as any, new Date());
    const shift = emp.shift ?? DEFAULT_SHIFT;
    const state = !last || last === 'CHECK_OUT' ? (last ? 'CHECKED_OUT' : 'NOT_STARTED') : last === 'BREAK_START' ? 'ON_BREAK' : 'WORKING';
    return {
      date: fmtDate(date),
      state,
      nextActions: nextActions(last),
      workMinutes: live.work,
      breakMinutes: live.brk,
      status: day?.status ?? null,
      lateMinutes: day?.lateMinutes ?? 0,
      punches,
      shift: { name: (shift as any).name ?? 'General', startTime: shift.startTime, endTime: shift.endTime, breakMinutes: shift.breakMinutes },
      branch: { id: emp.branch.id, name: emp.branch.name, latitude: emp.branch.latitude, longitude: emp.branch.longitude, radiusM: emp.branch.radiusM },
      serverTime: new Date().toISOString(),
    };
  }

  /** Month view for an employee (self, or an employee in scope). */
  async month(u: AuthUser, employeeId: string, month: string) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('month must be YYYY-MM');
    const emp = await this.loadEmployee(employeeId);
    if (employeeId !== u.employeeId) assertBranchInScope(u, emp.branchId);
    if (employeeId !== u.employeeId && u.role === 'EMPLOYEE') throw new ForbiddenException();
    const from = parseDate(`${month}-01`);
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0));
    const days = await this.prisma.attendanceDay.findMany({
      where: { employeeId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
      include: { punches: { orderBy: { serverTime: 'asc' }, select: { type: true, serverTime: true, distanceM: true, insideGeofence: true, flags: true, selfieUrl: true } } },
    });
    const summary = { PRESENT: 0, LATE: 0, HALF_DAY: 0, ABSENT: 0, ON_LEAVE: 0, HOLIDAY: 0, WEEKLY_OFF: 0, MISSED_PUNCH: 0, workMinutes: 0, overtimeMinutes: 0, lateMinutes: 0 };
    for (const d of days) {
      summary[d.status]++;
      summary.workMinutes += d.workMinutes;
      summary.overtimeMinutes += d.overtimeMinutes;
      summary.lateMinutes += d.lateMinutes;
    }
    return { month, summary, days: days.map((d) => ({ ...d, date: fmtDate(d.date) })) };
  }

  /** Daily register for managers / HR. */
  async register(u: AuthUser, dateStr: string | undefined, branchId?: string) {
    const date = dateStr ? parseDate(dateStr) : localDate();
    if (branchId) assertBranchInScope(u, branchId);
    const employees = await this.prisma.employee.findMany({
      where: { ...employeeScope(u), ...(branchId ? { branchId } : {}), user: { status: 'ACTIVE' } },
      orderBy: [{ branch: { name: 'asc' } }, { firstName: 'asc' }],
      select: {
        id: true, firstName: true, lastName: true, designation: true, photoUrl: true,
        user: { select: { employeeCode: true } }, branch: { select: { id: true, name: true } },
        attendanceDays: { where: { date }, include: { punches: { orderBy: { serverTime: 'asc' }, select: { type: true, serverTime: true, flags: true, distanceM: true } } } },
      },
    });
    const onLeave = await this.prisma.leaveRequest.findMany({
      where: { status: 'APPROVED', fromDate: { lte: date }, toDate: { gte: date }, employeeId: { in: employees.map((e) => e.id) } },
      select: { employeeId: true, leaveType: { select: { name: true } } },
    });
    const leaveMap = new Map(onLeave.map((l) => [l.employeeId, l.leaveType.name]));
    const rows = employees.map((e) => {
      const day = e.attendanceDays[0];
      const last = day?.punches.at(-1)?.type;
      const live = day?.punches.length ? computeMinutes(day.punches as any, fmtDate(date) === fmtDate(localDate()) ? new Date() : undefined) : { work: 0, brk: 0 };
      const status = leaveMap.has(e.id) ? 'ON_LEAVE' : day ? (last === 'BREAK_START' ? 'ON_BREAK' : day.status) : 'NOT_IN';
      return {
        employeeId: e.id, code: e.user.employeeCode, name: `${e.firstName} ${e.lastName}`, designation: e.designation,
        branch: e.branch, status, leaveType: leaveMap.get(e.id) ?? null,
        firstIn: day?.firstIn ?? null, lastOut: day?.lastOut ?? null, workMinutes: live.work, breakMinutes: live.brk,
        lateMinutes: day?.lateMinutes ?? 0, overtimeMinutes: day?.overtimeMinutes ?? 0,
        flags: [...new Set(day?.punches.flatMap((p) => p.flags) ?? [])],
      };
    });
    const counts = rows.reduce<Record<string, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
    return { date: fmtDate(date), total: rows.length, counts, rows };
  }

  /** HR manual correction — always audited, never silently overwrites. */
  async manualPunch(u: AuthUser, dto: ManualPunchDto, req: any) {
    const emp = await this.loadEmployee(dto.employeeId);
    assertBranchInScope(u, emp.branchId);
    const time = new Date(dto.time);
    if (time > new Date()) throw new BadRequestException('Time cannot be in the future');
    const date = localDate(time);
    const day = await this.prisma.attendanceDay.upsert({
      where: { employeeId_date: { employeeId: emp.id, date } },
      create: { employeeId: emp.id, branchId: emp.branchId, date },
      update: {},
    });
    const punch = await this.prisma.punch.create({
      data: { employeeId: emp.id, attendanceDayId: day.id, type: dto.type, serverTime: time, source: 'MANUAL', note: dto.reason, flags: ['MANUAL'], insideGeofence: true },
    });
    await this.prisma.attendanceDay.update({ where: { id: day.id }, data: { regularized: true, autoClosed: false } });
    await this.audit.log({ actorId: u.userId, action: 'MANUAL_PUNCH', entity: 'Punch', entityId: punch.id, newValue: dto, req });
    return this.recompute(day.id);
  }

  // ---------------- Regularization ----------------
  async requestRegularization(u: AuthUser, dto: RegularizationDto) {
    if (!u.employeeId) throw new ForbiddenException();
    const date = parseDate(dto.date);
    if (date > localDate()) throw new BadRequestException('Cannot regularize a future date');
    if (date < addDays(localDate(), -30)) throw new BadRequestException('Regularization allowed only for the last 30 days');
    if (!dto.checkIn && !dto.checkOut) throw new BadRequestException('Provide check-in and/or check-out time');
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: u.employeeId } });
    return this.prisma.regularization.create({
      data: {
        employeeId: u.employeeId, date, reason: dto.reason,
        checkIn: dto.checkIn ? new Date(dto.checkIn) : null, checkOut: dto.checkOut ? new Date(dto.checkOut) : null,
        status: emp.managerId ? 'PENDING_MANAGER' : 'PENDING_HR',
      },
    });
  }

  async listRegularizations(u: AuthUser, mine: boolean) {
    const where = mine || u.role === 'EMPLOYEE'
      ? { employeeId: u.employeeId ?? '-' }
      : { employee: employeeScope(u), status: { in: isHr(u) ? ['PENDING_MANAGER', 'PENDING_HR'] as const : ['PENDING_MANAGER'] as const } as any };
    return this.prisma.regularization.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 200,
      include: { employee: { select: { firstName: true, lastName: true, user: { select: { employeeCode: true } }, branch: { select: { name: true } } } } },
    });
  }

  async decideRegularization(u: AuthUser, id: string, dto: DecisionDto, req: any) {
    const r = await this.prisma.regularization.findUnique({ where: { id }, include: { employee: true } });
    if (!r) throw new NotFoundException();
    assertBranchInScope(u, r.employee.branchId);
    if (r.employeeId === u.employeeId) throw new ForbiddenException('You cannot approve your own request');
    if (r.status === 'PENDING_HR' && !isHr(u)) throw new ForbiddenException('Waiting for HR approval');
    if (!['PENDING_MANAGER', 'PENDING_HR'].includes(r.status)) throw new BadRequestException('Request already closed');

    await this.prisma.approval.create({
      data: { entityType: 'REGULARIZATION', entityId: id, level: isHr(u) ? 'HR' : 'MANAGER', approverId: u.userId, action: dto.action === 'APPROVE' ? 'APPROVED' : 'REJECTED', comment: dto.comment },
    });
    let status: typeof r.status = dto.action === 'REJECT' ? 'REJECTED' : isHr(u) ? 'APPROVED' : 'PENDING_HR';
    const updated = await this.prisma.regularization.update({ where: { id }, data: { status } });
    if (status === 'APPROVED') {
      const day = await this.prisma.attendanceDay.upsert({
        where: { employeeId_date: { employeeId: r.employeeId, date: r.date } },
        create: { employeeId: r.employeeId, branchId: r.employee.branchId, date: r.date },
        update: { autoClosed: false, regularized: true },
      });
      const existing = await this.prisma.punch.findMany({ where: { attendanceDayId: day.id } });
      const hasIn = existing.some((p) => p.type === 'CHECK_IN');
      const hasOut = existing.some((p) => p.type === 'CHECK_OUT');
      const data: any[] = [];
      if (r.checkIn && !hasIn) data.push({ type: 'CHECK_IN', serverTime: r.checkIn });
      if (r.checkOut && !hasOut) data.push({ type: 'CHECK_OUT', serverTime: r.checkOut });
      // If the day was auto-closed, replace the system check-out with the approved one.
      if (r.checkOut && hasOut) {
        await this.prisma.punch.updateMany({ where: { attendanceDayId: day.id, type: 'CHECK_OUT', flags: { has: 'AUTO_CLOSED' } }, data: { serverTime: r.checkOut, flags: ['REGULARIZED'] } });
      }
      for (const p of data) {
        await this.prisma.punch.create({ data: { ...p, employeeId: r.employeeId, attendanceDayId: day.id, source: 'MANUAL', flags: ['REGULARIZED'], note: r.reason, insideGeofence: true } });
      }
      await this.prisma.attendanceDay.update({ where: { id: day.id }, data: { regularized: true, autoClosed: false, status: 'PRESENT' } });
      await this.recompute(day.id);
    }
    await this.audit.log({ actorId: u.userId, action: `REGULARIZATION_${dto.action}`, entity: 'Regularization', entityId: id, oldValue: { status: r.status }, newValue: { status }, req });
    return updated;
  }

  // ---------------- Scheduled jobs ----------------
  /** Close sessions still open 4 h after shift end; mark as missed punch. */
  async autoCloseOpenDays() {
    const open = await this.prisma.attendanceDay.findMany({
      where: { date: { gte: addDays(localDate(), -2) }, autoClosed: false, lastOut: null, firstIn: { not: null } },
      include: { punches: { orderBy: { serverTime: 'asc' } }, employee: { include: { shift: true } } },
    });
    let closed = 0;
    for (const day of open) {
      const last = day.punches.at(-1);
      if (!last || last.type === 'CHECK_OUT') continue;
      const shift = day.employee.shift ?? DEFAULT_SHIFT;
      const end = localDateTime(day.date, shift.endTime);
      if (Date.now() < end.getTime() + 4 * 3_600_000) continue;
      const closeAt = last.serverTime > end ? last.serverTime : end;
      if (last.type === 'BREAK_START') {
        await this.prisma.punch.create({ data: { employeeId: day.employeeId, attendanceDayId: day.id, type: 'BREAK_END', serverTime: closeAt, source: 'MANUAL', flags: ['AUTO_CLOSED'] } });
      }
      await this.prisma.punch.create({ data: { employeeId: day.employeeId, attendanceDayId: day.id, type: 'CHECK_OUT', serverTime: closeAt, source: 'MANUAL', flags: ['AUTO_CLOSED'] } });
      await this.prisma.attendanceDay.update({ where: { id: day.id }, data: { autoClosed: true } });
      await this.recompute(day.id);
      closed++;
    }
    return closed;
  }

  /** Create ABSENT / HOLIDAY / WEEKLY_OFF / ON_LEAVE rows for everyone without a record on `date`. */
  async finalizeDay(date: Date) {
    const employees = await this.prisma.employee.findMany({
      where: { user: { status: 'ACTIVE' }, joiningDate: { lte: date }, attendanceDays: { none: { date } } },
      include: { shift: true },
    });
    const holidays = await this.prisma.holiday.findMany({ where: { date } });
    const leaves = await this.prisma.leaveRequest.findMany({ where: { status: 'APPROVED', fromDate: { lte: date }, toDate: { gte: date } } });
    const onLeave = new Set(leaves.map((l) => l.employeeId));
    let n = 0;
    for (const e of employees) {
      const offDays = e.shift?.weeklyOffDays ?? DEFAULT_SHIFT.weeklyOffDays;
      const isHoliday = holidays.some((h) => !h.branchId || h.branchId === e.branchId);
      const status: DayStatus = onLeave.has(e.id) ? 'ON_LEAVE' : isHoliday ? 'HOLIDAY' : offDays.includes(date.getUTCDay()) ? 'WEEKLY_OFF' : 'ABSENT';
      await this.prisma.attendanceDay.create({ data: { employeeId: e.id, branchId: e.branchId, date, status } });
      n++;
    }
    return n;
  }
}
