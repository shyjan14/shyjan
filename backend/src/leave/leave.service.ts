import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveType, Prisma, RequestStatus } from '@prisma/client';
import { DEFAULT_SHIFT } from '../attendance/attendance.service';
import { AuditService } from '../common/audit.service';
import { AuthUser, isHr } from '../common/decorators';
import { PrismaService } from '../common/prisma.service';
import { assertBranchInScope, employeeScope } from '../common/scope';
import { StorageService } from '../common/storage.service';
import { addDays, completedMonths, fmtDate, localDate, parseDate } from '../common/time';
import { AdjustBalanceDto, ApplyLeaveDto, LeaveDecisionDto } from './leave.dto';
import { annualLeaveAccrued, countLeaveDays, PaySlab, splitBySlabs } from './leave-policy';

const OPEN: RequestStatus[] = ['PENDING_MANAGER', 'PENDING_HR'];

@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService, private storage: StorageService, private audit: AuditService) {}

  async types(u: AuthUser) {
    const emp = u.employeeId ? await this.prisma.employee.findUnique({ where: { id: u.employeeId } }) : null;
    const types = await this.prisma.leaveType.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
    return types.filter((t) => !t.genderRule || !emp || t.genderRule === emp.gender);
  }

  private entitlementFor(t: LeaveType, joining: Date, year: number) {
    if (!t.accrualMonthly) return t.yearlyDays;
    const yearEnd = new Date(Date.UTC(year, 11, 31));
    const today = localDate();
    return annualLeaveAccrued(joining, year, today < yearEnd ? today : yearEnd, t.yearlyDays);
  }

  /** Create missing balance rows and refresh accrued entitlement. */
  async ensureBalances(employeeId: string, year: number) {
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const types = await this.prisma.leaveType.findMany({ where: { active: true } });
    for (const t of types) {
      if (t.genderRule && t.genderRule !== emp.gender) continue;
      const entitled = this.entitlementFor(t, emp.joiningDate, year);
      await this.prisma.leaveBalance.upsert({
        where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: t.id, year } },
        create: { employeeId, leaveTypeId: t.id, year, entitled },
        update: { entitled },
      });
    }
  }

  async balances(u: AuthUser, employeeId: string, year: number) {
    if (employeeId !== u.employeeId) {
      if (u.role === 'EMPLOYEE') throw new ForbiddenException();
      const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
      if (!emp) throw new NotFoundException();
      assertBranchInScope(u, emp.branchId);
    }
    await this.ensureBalances(employeeId, year);
    const rows = await this.prisma.leaveBalance.findMany({ where: { employeeId, year }, include: { leaveType: true }, orderBy: { leaveType: { sortOrder: 'asc' } } });
    return rows.map((b) => {
      const limited = b.leaveType.yearlyDays > 0;
      const total = b.entitled + b.carriedForward + b.adjustment;
      return {
        leaveTypeId: b.leaveTypeId, code: b.leaveType.code, name: b.leaveType.name, year,
        entitled: b.entitled, carriedForward: b.carriedForward, adjustment: b.adjustment,
        taken: b.taken, pending: b.pending,
        available: limited ? Math.max(0, total - b.taken - b.pending) : null,
        yearlyDays: b.leaveType.yearlyDays, paySlabs: b.leaveType.paySlabs,
      };
    });
  }

  async apply(u: AuthUser, dto: ApplyLeaveDto, file: Express.Multer.File | undefined) {
    if (!u.employeeId) throw new ForbiddenException('No employee profile');
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: u.employeeId }, include: { shift: true } });
    const type = await this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
    if (!type || !type.active) throw new BadRequestException('Leave type not available');

    const from = parseDate(dto.fromDate);
    const to = parseDate(dto.toDate);
    const today = localDate();
    if (to < from) throw new BadRequestException('End date is before start date');
    if (from.getUTCFullYear() !== to.getUTCFullYear()) throw new BadRequestException('Leave cannot cross the year end. Please split it into two requests.');
    const backDays = type.code === 'SICK' ? 7 : 0;
    if (from < addDays(today, -backDays)) throw new BadRequestException(backDays ? `Sick leave can be applied up to ${backDays} days back` : 'Start date cannot be in the past');
    if (dto.halfDay && !type.allowHalfDay) throw new BadRequestException(`${type.name} cannot be taken as half day`);

    // Eligibility
    if (type.genderRule && type.genderRule !== emp.gender) throw new BadRequestException(`${type.name} is not applicable`);
    const service = completedMonths(emp.joiningDate, from);
    if (service < type.minServiceMonths) throw new BadRequestException(`${type.name} needs at least ${type.minServiceMonths} months of service`);
    if (type.requiresProbationDone && emp.probationEnd && from <= emp.probationEnd) throw new BadRequestException(`${type.name} is available after probation (${fmtDate(emp.probationEnd)})`);

    // Day count
    const holidays = await this.prisma.holiday.findMany({ where: { date: { gte: from, lte: to }, OR: [{ branchId: null }, { branchId: emp.branchId }] } });
    let days: number;
    try {
      days = countLeaveDays({
        from, to, halfDay: dto.halfDay, countsCalendarDays: type.countsCalendarDays,
        weeklyOffDays: emp.shift?.weeklyOffDays ?? DEFAULT_SHIFT.weeklyOffDays,
        holidays: new Set(holidays.map((h) => fmtDate(h.date))),
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (days <= 0) throw new BadRequestException('Selected dates are all off days / holidays');

    // Attachment
    if (type.attachmentAfterDays !== null && days > type.attachmentAfterDays && !file) {
      throw new BadRequestException(type.attachmentAfterDays === 0 ? `${type.name} needs a supporting document` : `A supporting document (e.g. medical certificate) is required for more than ${type.attachmentAfterDays} day(s)`);
    }

    // Overlap
    const overlap = await this.prisma.leaveRequest.findFirst({
      where: { employeeId: emp.id, status: { in: [...OPEN, 'APPROVED'] }, fromDate: { lte: to }, toDate: { gte: from } },
    });
    if (overlap) throw new BadRequestException(`You already have leave from ${fmtDate(overlap.fromDate)} to ${fmtDate(overlap.toDate)}`);

    // Balance
    const year = from.getUTCFullYear();
    await this.ensureBalances(emp.id, year);
    const bal = await this.prisma.leaveBalance.findUniqueOrThrow({ where: { employeeId_leaveTypeId_year: { employeeId: emp.id, leaveTypeId: type.id, year } } });
    if (type.yearlyDays > 0) {
      const available = bal.entitled + bal.carriedForward + bal.adjustment - bal.taken - bal.pending;
      if (days > available) throw new BadRequestException(`Not enough ${type.name} balance. Available: ${available} day(s), requested: ${days}`);
    }

    const attachmentUrl = file ? await this.storage.save(emp.id, file) : null;
    const status: RequestStatus = emp.managerId ? 'PENDING_MANAGER' : 'PENDING_HR';
    const [request] = await this.prisma.$transaction([
      this.prisma.leaveRequest.create({
        data: { employeeId: emp.id, leaveTypeId: type.id, fromDate: from, toDate: to, halfDay: dto.halfDay ?? null, days, reason: dto.reason, attachmentUrl, status },
        include: { leaveType: { select: { name: true, code: true } } },
      }),
      this.prisma.leaveBalance.update({ where: { id: bal.id }, data: { pending: { increment: days } } }),
    ]);
    const payBreakdown = type.paySlabs ? splitBySlabs(bal.taken + bal.pending, days, type.paySlabs as PaySlab[]) : null;
    await this.notifyApprovers(emp.id, `Leave request: ${type.name}`, `${emp.firstName} ${emp.lastName} requested ${days} day(s) from ${dto.fromDate}`);
    return { ...request, payBreakdown };
  }

  private async notifyApprovers(employeeId: string, title: string, body: string) {
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { manager: true } });
    const ids = new Set<string>();
    if (emp.manager) ids.add(emp.manager.userId);
    const hrs = await this.prisma.user.findMany({ where: { role: { in: ['HR_ADMIN'] }, status: 'ACTIVE' }, select: { id: true } });
    hrs.forEach((h) => ids.add(h.id));
    await this.prisma.notification.createMany({ data: [...ids].map((userId) => ({ userId, title, body })) });
  }

  async mine(u: AuthUser) {
    return this.prisma.leaveRequest.findMany({
      where: { employeeId: u.employeeId ?? '-' },
      orderBy: { createdAt: 'desc' }, take: 100,
      include: { leaveType: { select: { name: true, code: true } } },
    });
  }

  /** Requests waiting for the caller's decision. */
  async queue(u: AuthUser, status?: string) {
    const where: Prisma.LeaveRequestWhereInput = { employee: employeeScope(u) };
    if (status === 'ALL') {
      // history view
    } else if (isHr(u)) where.status = { in: OPEN };
    else where.status = 'PENDING_MANAGER';
    return this.prisma.leaveRequest.findMany({
      where, orderBy: { createdAt: status === 'ALL' ? 'desc' : 'asc' }, take: 300,
      include: {
        leaveType: { select: { name: true, code: true } },
        employee: { select: { id: true, firstName: true, lastName: true, designation: true, user: { select: { employeeCode: true } }, branch: { select: { name: true } } } },
      },
    });
  }

  async decide(u: AuthUser, id: string, dto: LeaveDecisionDto, req: any) {
    const r = await this.prisma.leaveRequest.findUnique({ where: { id }, include: { employee: true, leaveType: true } });
    if (!r) throw new NotFoundException();
    assertBranchInScope(u, r.employee.branchId);
    if (r.employeeId === u.employeeId) throw new ForbiddenException('You cannot approve your own leave');
    if (!OPEN.includes(r.status)) throw new BadRequestException('Request is already closed');
    if (r.status === 'PENDING_HR' && !isHr(u)) throw new ForbiddenException('Waiting for HR approval');

    const next: RequestStatus = dto.action === 'REJECT' ? 'REJECTED' : isHr(u) ? 'APPROVED' : 'PENDING_HR';
    const year = r.fromDate.getUTCFullYear();
    const balWhere = { employeeId_leaveTypeId_year: { employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, year } };

    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.leaveRequest.update({ where: { id }, data: { status: next } }),
      this.prisma.approval.create({ data: { entityType: 'LEAVE', entityId: id, level: isHr(u) ? 'HR' : 'MANAGER', approverId: u.userId, action: dto.action === 'APPROVE' ? 'APPROVED' : 'REJECTED', comment: dto.comment } }),
    ];
    if (next === 'APPROVED') ops.push(this.prisma.leaveBalance.update({ where: balWhere, data: { pending: { decrement: r.days }, taken: { increment: r.days } } }));
    if (next === 'REJECTED') ops.push(this.prisma.leaveBalance.update({ where: balWhere, data: { pending: { decrement: r.days } } }));
    await this.prisma.$transaction(ops);

    if (next === 'APPROVED') await this.markLeaveDays(r.employeeId, r.employee.branchId, r.fromDate, r.toDate);
    await this.prisma.notification.create({
      data: {
        userId: r.employee.userId,
        title: `Leave ${next === 'APPROVED' ? 'approved' : next === 'REJECTED' ? 'rejected' : 'approved by manager'}`,
        body: `${r.leaveType.name} ${fmtDate(r.fromDate)} → ${fmtDate(r.toDate)}${dto.comment ? `: ${dto.comment}` : ''}`,
      },
    });
    await this.audit.log({ actorId: u.userId, action: `LEAVE_${dto.action}`, entity: 'LeaveRequest', entityId: id, oldValue: { status: r.status }, newValue: { status: next, comment: dto.comment }, req });
    return this.prisma.leaveRequest.findUnique({ where: { id }, include: { leaveType: { select: { name: true } } } });
  }

  private async markLeaveDays(employeeId: string, branchId: string, from: Date, to: Date) {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const existing = await this.prisma.attendanceDay.findUnique({ where: { employeeId_date: { employeeId, date: d } } });
      if (existing?.firstIn) continue; // employee actually worked that day
      await this.prisma.attendanceDay.upsert({
        where: { employeeId_date: { employeeId, date: d } },
        create: { employeeId, branchId, date: d, status: 'ON_LEAVE' },
        update: { status: 'ON_LEAVE' },
      });
    }
  }

  async cancel(u: AuthUser, id: string, req: any) {
    const r = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!r || r.employeeId !== u.employeeId) throw new NotFoundException();
    const year = r.fromDate.getUTCFullYear();
    const balWhere = { employeeId_leaveTypeId_year: { employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, year } };
    if (OPEN.includes(r.status)) {
      await this.prisma.$transaction([
        this.prisma.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } }),
        this.prisma.leaveBalance.update({ where: balWhere, data: { pending: { decrement: r.days } } }),
      ]);
    } else if (r.status === 'APPROVED') {
      if (r.fromDate <= localDate()) throw new BadRequestException('Leave has already started. Ask HR to modify it.');
      await this.prisma.$transaction([
        this.prisma.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } }),
        this.prisma.leaveBalance.update({ where: balWhere, data: { taken: { decrement: r.days } } }),
        this.prisma.attendanceDay.deleteMany({ where: { employeeId: r.employeeId, date: { gte: r.fromDate, lte: r.toDate }, status: 'ON_LEAVE', firstIn: null } }),
      ]);
    } else throw new BadRequestException('Request is already closed');
    await this.audit.log({ actorId: u.userId, action: 'LEAVE_CANCELLED', entity: 'LeaveRequest', entityId: id, oldValue: { status: r.status }, req });
    return { ok: true };
  }

  async calendar(u: AuthUser, month: string, branchId?: string) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('month must be YYYY-MM');
    if (branchId) assertBranchInScope(u, branchId);
    const from = parseDate(`${month}-01`);
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0));
    const scope = u.role === 'EMPLOYEE' ? { branchId: u.branchId ?? '-' } : employeeScope(u);
    const leaves = await this.prisma.leaveRequest.findMany({
      where: { status: { in: ['APPROVED', ...OPEN] }, fromDate: { lte: to }, toDate: { gte: from }, employee: { ...scope, ...(branchId ? { branchId } : {}) } },
      orderBy: { fromDate: 'asc' },
      include: { leaveType: { select: { name: true, code: true } }, employee: { select: { firstName: true, lastName: true, branch: { select: { name: true } } } } },
    });
    const holidays = await this.prisma.holiday.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { date: 'asc' } });
    return {
      month,
      holidays: holidays.map((h) => ({ date: fmtDate(h.date), name: h.name })),
      leaves: leaves.map((l) => ({
        id: l.id, employee: `${l.employee.firstName} ${l.employee.lastName}`, branch: l.employee.branch.name,
        type: l.leaveType.name, code: l.leaveType.code, from: fmtDate(l.fromDate), to: fmtDate(l.toDate), days: l.days, status: l.status,
      })),
    };
  }

  async adjust(u: AuthUser, dto: AdjustBalanceDto, req: any) {
    const emp = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!emp) throw new NotFoundException();
    await this.ensureBalances(dto.employeeId, dto.year);
    const where = { employeeId_leaveTypeId_year: { employeeId: dto.employeeId, leaveTypeId: dto.leaveTypeId, year: dto.year } };
    const before = await this.prisma.leaveBalance.findUniqueOrThrow({ where });
    const after = await this.prisma.leaveBalance.update({ where, data: { adjustment: { increment: dto.days } } });
    await this.audit.log({ actorId: u.userId, action: 'LEAVE_BALANCE_ADJUSTED', entity: 'LeaveBalance', entityId: after.id, oldValue: { adjustment: before.adjustment }, newValue: { adjustment: after.adjustment, reason: dto.reason }, req });
    return after;
  }
}
