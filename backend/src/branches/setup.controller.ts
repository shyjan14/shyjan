import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { AuditService } from '../common/audit.service';
import { AuthUser, CurrentUser, HR, MANAGERS, Roles } from '../common/decorators';
import { PrismaService } from '../common/prisma.service';
import { fmtDate, parseDate } from '../common/time';

export class BranchDto {
  @IsString() @MaxLength(20) code!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(40) emirate!: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @Type(() => Number) @IsLatitude() latitude!: number;
  @Type(() => Number) @IsLongitude() longitude!: number;
  @Type(() => Number) @IsInt() @Min(20) @Max(2000) radiusM!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) wifiBssids?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) managerUserIds?: string[];
}
export class UpdateBranchDto extends PartialType(BranchDto) {}

export class ShiftDto {
  @IsString() @MaxLength(60) name!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(240) breakMinutes!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(120) graceMinutes!: number;
  @IsArray() @IsInt({ each: true }) weeklyOffDays!: number[];
}

export class HolidayDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsUUID() branchId?: string;
}

@Controller()
export class SetupController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ---------- Branches ----------
  @Get('branches')
  async branches(@CurrentUser() u: AuthUser) {
    const where = u.scopeBranchIds === null ? {} : { id: { in: u.scopeBranchIds } };
    const list = await this.prisma.branch.findMany({
      where, orderBy: { name: 'asc' },
      include: { managers: { select: { id: true, employeeCode: true, employee: { select: { firstName: true, lastName: true } } } }, _count: { select: { employees: true } } },
    });
    return list.map(({ _count, ...b }) => ({ ...b, employeeCount: _count.employees }));
  }

  @Roles(...HR) @Post('branches')
  async createBranch(@CurrentUser() u: AuthUser, @Body() dto: BranchDto, @Req() req: any) {
    const { managerUserIds, ...data } = dto;
    const b = await this.prisma.branch.create({
      data: { ...data, code: data.code.toUpperCase(), managers: managerUserIds ? { connect: managerUserIds.map((id) => ({ id })) } : undefined },
    });
    await this.audit.log({ actorId: u.userId, action: 'BRANCH_CREATED', entity: 'Branch', entityId: b.id, newValue: b, req });
    return b;
  }

  @Roles(...HR) @Patch('branches/:id')
  async updateBranch(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBranchDto, @Req() req: any) {
    const before = await this.prisma.branch.findUniqueOrThrow({ where: { id } });
    const { managerUserIds, ...data } = dto;
    const b = await this.prisma.branch.update({
      where: { id },
      data: { ...data, ...(data.code ? { code: data.code.toUpperCase() } : {}), managers: managerUserIds ? { set: managerUserIds.map((x) => ({ id: x })) } : undefined },
    });
    await this.audit.log({ actorId: u.userId, action: 'BRANCH_UPDATED', entity: 'Branch', entityId: id, oldValue: before, newValue: b, req });
    return b;
  }

  // ---------- Departments ----------
  @Get('departments')
  departments() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  @Roles(...HR) @Post('departments')
  createDepartment(@Body() dto: { name: string }) {
    if (!dto?.name || typeof dto.name !== 'string') return { error: 'name required' };
    return this.prisma.department.create({ data: { name: dto.name.slice(0, 80) } });
  }

  // ---------- Shifts ----------
  @Roles(...MANAGERS) @Get('shifts')
  shifts() {
    return this.prisma.shift.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { employees: true } } } });
  }

  @Roles(...HR) @Post('shifts')
  async createShift(@CurrentUser() u: AuthUser, @Body() dto: ShiftDto, @Req() req: any) {
    const s = await this.prisma.shift.create({ data: dto });
    await this.audit.log({ actorId: u.userId, action: 'SHIFT_CREATED', entity: 'Shift', entityId: s.id, newValue: s, req });
    return s;
  }

  @Roles(...HR) @Patch('shifts/:id')
  async updateShift(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ShiftDto, @Req() req: any) {
    const before = await this.prisma.shift.findUniqueOrThrow({ where: { id } });
    const s = await this.prisma.shift.update({ where: { id }, data: dto });
    await this.audit.log({ actorId: u.userId, action: 'SHIFT_UPDATED', entity: 'Shift', entityId: id, oldValue: before, newValue: s, req });
    return s;
  }

  // ---------- Holidays ----------
  @Get('holidays')
  async holidays() {
    const list = await this.prisma.holiday.findMany({ orderBy: { date: 'asc' }, include: { branch: { select: { name: true } } } });
    return list.map((h) => ({ ...h, date: fmtDate(h.date) }));
  }

  @Roles(...HR) @Post('holidays')
  async createHoliday(@CurrentUser() u: AuthUser, @Body() dto: HolidayDto, @Req() req: any) {
    const h = await this.prisma.holiday.create({ data: { date: parseDate(dto.date), name: dto.name, branchId: dto.branchId } });
    await this.audit.log({ actorId: u.userId, action: 'HOLIDAY_CREATED', entity: 'Holiday', entityId: h.id, newValue: dto, req });
    return h;
  }

  @Roles(...HR) @Delete('holidays/:id')
  async deleteHoliday(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const h = await this.prisma.holiday.delete({ where: { id } });
    await this.audit.log({ actorId: u.userId, action: 'HOLIDAY_DELETED', entity: 'Holiday', entityId: id, oldValue: h, req });
    return { ok: true };
  }

  // ---------- Announcements ----------
  @Get('announcements')
  announcements(@CurrentUser() u: AuthUser) {
    const branchFilter = u.scopeBranchIds === null ? {} : { OR: [{ branchId: null }, { branchId: { in: u.scopeBranchIds } }] };
    return this.prisma.announcement.findMany({ where: branchFilter, orderBy: { createdAt: 'desc' }, take: 20 });
  }

  @Roles(...HR) @Post('announcements')
  async announce(@CurrentUser() u: AuthUser, @Body() dto: { title: string; body: string; branchId?: string }) {
    if (typeof dto?.title !== 'string' || typeof dto?.body !== 'string') return { error: 'title and body required' };
    const a = await this.prisma.announcement.create({ data: { title: dto.title.slice(0, 150), body: dto.body.slice(0, 3000), branchId: dto.branchId || null, createdBy: u.userId } });
    const users = await this.prisma.employee.findMany({ where: { ...(dto.branchId ? { branchId: dto.branchId } : {}), user: { status: 'ACTIVE' } }, select: { userId: true } });
    await this.prisma.notification.createMany({ data: users.map((x) => ({ userId: x.userId, title: a.title, body: a.body.slice(0, 200) })) });
    return a;
  }

  // ---------- Leave policy ----------
  @Roles(...HR) @Get('leave-types/all')
  allLeaveTypes() {
    return this.prisma.leaveType.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  @Roles(...HR) @Patch('leave-types/:id')
  async updateLeaveType(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: Record<string, unknown>, @Req() req: any) {
    const allowed = ['name', 'description', 'yearlyDays', 'countsCalendarDays', 'attachmentAfterDays', 'minServiceMonths', 'requiresProbationDone', 'carryForwardMax', 'allowHalfDay', 'active'];
    const data = Object.fromEntries(Object.entries(dto ?? {}).filter(([k]) => allowed.includes(k)));
    const before = await this.prisma.leaveType.findUniqueOrThrow({ where: { id } });
    const t = await this.prisma.leaveType.update({ where: { id }, data });
    await this.audit.log({ actorId: u.userId, action: 'LEAVE_POLICY_UPDATED', entity: 'LeaveType', entityId: id, oldValue: before, newValue: t, req });
    return t;
  }

  // ---------- Audit ----------
  @Roles('SUPER_ADMIN', 'HR_ADMIN') @Get('audit-logs')
  auditLogs() {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 300, include: { actor: { select: { employeeCode: true, email: true } } } });
  }

  // ---------- Notifications ----------
  @Get('notifications')
  notifications(@CurrentUser() u: AuthUser) {
    return this.prisma.notification.findMany({ where: { userId: u.userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  @Post('notifications/read-all')
  async readAll(@CurrentUser() u: AuthUser) {
    await this.prisma.notification.updateMany({ where: { userId: u.userId, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }
}
