import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthUser, CurrentUser, HR, MANAGERS, Roles } from '../common/decorators';
import { PrismaService } from '../common/prisma.service';
import { assertBranchInScope, employeeScope } from '../common/scope';
import { addDays, fmtDate, localDate, parseDate } from '../common/time';
import { AttendanceService } from '../attendance/attendance.service';

function csv(rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // prevent spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n');
}

@Roles(...MANAGERS)
@Controller('reports')
export class ReportsController {
  constructor(private prisma: PrismaService, private attendance: AttendanceService) {}

  @Get('dashboard')
  async dashboard(@CurrentUser() u: AuthUser) {
    const reg = await this.attendance.register(u, undefined);
    const branches = await this.prisma.branch.findMany({
      where: u.scopeBranchIds === null ? { active: true } : { id: { in: u.scopeBranchIds } },
      select: { id: true, name: true }, orderBy: { name: 'asc' },
    });
    const byBranch = branches.map((b) => {
      const rows = reg.rows.filter((r) => r.branch.id === b.id);
      const c = (s: string) => rows.filter((r) => r.status === s).length;
      return {
        branchId: b.id, name: b.name, total: rows.length,
        present: c('PRESENT') + c('LATE') + c('ON_BREAK') + c('HALF_DAY'), late: c('LATE'), onBreak: c('ON_BREAK'), onLeave: c('ON_LEAVE'), notIn: c('NOT_IN'),
      };
    });
    const in30 = addDays(localDate(), 30);
    const [pendingLeaves, pendingRegs, pendingDevices, expiringDocs, recentPunches] = await Promise.all([
      this.prisma.leaveRequest.count({ where: { employee: employeeScope(u), status: u.scopeBranchIds === null ? { in: ['PENDING_MANAGER', 'PENDING_HR'] } : 'PENDING_MANAGER' } }),
      this.prisma.regularization.count({ where: { employee: employeeScope(u), status: { in: ['PENDING_MANAGER', 'PENDING_HR'] } } }),
      this.prisma.device.count({ where: { status: 'PENDING', user: { employee: employeeScope(u) } } }),
      this.prisma.employeeDocument.count({ where: { expiryDate: { lte: in30 }, employee: { ...employeeScope(u), user: { status: 'ACTIVE' } } } }),
      this.prisma.punch.findMany({
        where: { employee: employeeScope(u), serverTime: { gte: addDays(new Date(), -1) } },
        orderBy: { serverTime: 'desc' }, take: 15,
        select: { id: true, type: true, serverTime: true, flags: true, distanceM: true, employee: { select: { firstName: true, lastName: true, branch: { select: { name: true } } } } },
      }),
    ]);
    const present = byBranch.reduce((s, b) => s + b.present, 0);
    return {
      date: reg.date,
      totals: {
        employees: reg.total, present, late: reg.counts.LATE ?? 0, onBreak: reg.counts.ON_BREAK ?? 0,
        onLeave: reg.counts.ON_LEAVE ?? 0, notIn: reg.counts.NOT_IN ?? 0,
      },
      byBranch,
      pending: { leaves: pendingLeaves, regularizations: pendingRegs, devices: pendingDevices },
      expiringDocs,
      recentPunches,
    };
  }

  @Get('document-expiry')
  async documentExpiry(@CurrentUser() u: AuthUser, @Query('days') days?: string) {
    const until = addDays(localDate(), Math.min(Number(days) || 90, 365));
    const docs = await this.prisma.employeeDocument.findMany({
      where: { expiryDate: { lte: until }, employee: { ...employeeScope(u), user: { status: 'ACTIVE' } } },
      orderBy: { expiryDate: 'asc' },
      include: { employee: { select: { id: true, firstName: true, lastName: true, user: { select: { employeeCode: true } }, branch: { select: { name: true } } } } },
    });
    const today = localDate().getTime();
    return docs.map((d) => ({
      id: d.id, type: d.type, number: d.number, expiryDate: fmtDate(d.expiryDate!),
      daysLeft: Math.round((d.expiryDate!.getTime() - today) / 86_400_000),
      employee: { id: d.employee.id, name: `${d.employee.firstName} ${d.employee.lastName}`, code: d.employee.user.employeeCode, branch: d.employee.branch.name },
    }));
  }

  /** Monthly attendance summary per employee — JSON or CSV (Excel). */
  @Get('attendance-summary')
  async attendanceSummary(@CurrentUser() u: AuthUser, @Res({ passthrough: true }) res: Response, @Query('month') month?: string, @Query('branchId') branchId?: string, @Query('format') format?: string) {
    month = month ?? fmtDate(localDate()).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('month must be YYYY-MM');
    if (branchId) assertBranchInScope(u, branchId);
    const from = parseDate(`${month}-01`);
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0));
    const emps = await this.prisma.employee.findMany({
      where: { ...employeeScope(u), ...(branchId ? { branchId } : {}) },
      orderBy: [{ branch: { name: 'asc' } }, { firstName: 'asc' }],
      select: {
        id: true, firstName: true, lastName: true, designation: true,
        user: { select: { employeeCode: true } }, branch: { select: { name: true } },
        attendanceDays: { where: { date: { gte: from, lte: to } } },
      },
    });
    const rows = emps.map((e) => {
      const d = e.attendanceDays;
      const c = (s: string) => d.filter((x) => x.status === s).length;
      return {
        code: e.user.employeeCode, name: `${e.firstName} ${e.lastName}`, designation: e.designation, branch: e.branch.name,
        present: c('PRESENT') + c('LATE'), late: c('LATE'), halfDay: c('HALF_DAY'), absent: c('ABSENT'), onLeave: c('ON_LEAVE'),
        missedPunch: c('MISSED_PUNCH'), holidays: c('HOLIDAY'), weeklyOff: c('WEEKLY_OFF'),
        workHours: +(d.reduce((s, x) => s + x.workMinutes, 0) / 60).toFixed(2),
        overtimeHours: +(d.reduce((s, x) => s + x.overtimeMinutes, 0) / 60).toFixed(2),
        lateMinutes: d.reduce((s, x) => s + x.lateMinutes, 0),
      };
    });
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-${month}.csv"`);
      const head = ['Code', 'Name', 'Designation', 'Branch', 'Present', 'Late', 'Half day', 'Absent', 'On leave', 'Missed punch', 'Holidays', 'Weekly off', 'Work hours', 'Overtime hours', 'Late minutes'];
      return csv([head, ...rows.map((r) => Object.values(r) as (string | number)[])]);
    }
    return { month, rows };
  }

  /** Payroll input (HR only): unpaid days + overtime per employee, for WPS payroll processing. */
  @Roles(...HR) @Get('payroll-export')
  async payroll(@Res({ passthrough: true }) res: Response, @Query('month') month?: string) {
    month = month ?? fmtDate(localDate()).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('month must be YYYY-MM');
    const from = parseDate(`${month}-01`);
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0));
    const emps = await this.prisma.employee.findMany({
      where: { user: { status: 'ACTIVE' } },
      orderBy: { firstName: 'asc' },
      include: {
        user: { select: { employeeCode: true } },
        attendanceDays: { where: { date: { gte: from, lte: to } } },
        leaveRequests: { where: { status: 'APPROVED', fromDate: { lte: to }, toDate: { gte: from }, leaveType: { paid: false } } },
      },
    });
    const rows: (string | number | null)[][] = [['Employee Code', 'Name', 'IBAN', 'Bank', 'Basic', 'Housing', 'Transport', 'Other', 'Absent days', 'Unpaid leave days', 'Overtime hours']];
    for (const e of emps) {
      rows.push([
        e.user.employeeCode, `${e.firstName} ${e.lastName}`, e.iban, e.bankName,
        Number(e.basicSalary ?? 0), Number(e.housingAllow ?? 0), Number(e.transportAllow ?? 0), Number(e.otherAllow ?? 0),
        e.attendanceDays.filter((d) => d.status === 'ABSENT').length,
        e.leaveRequests.reduce((s, l) => s + l.days, 0),
        +(e.attendanceDays.reduce((s, d) => s + d.overtimeMinutes, 0) / 60).toFixed(2),
      ]);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-input-${month}.csv"`);
    return csv(rows);
  }
}
