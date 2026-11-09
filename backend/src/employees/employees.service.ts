import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { AuditService } from '../common/audit.service';
import { AuthUser, isHr } from '../common/decorators';
import { PrismaService } from '../common/prisma.service';
import { assertBranchInScope, employeeScope } from '../common/scope';
import { StorageService } from '../common/storage.service';
import { fmtDate, localDate, parseDate } from '../common/time';
import { gratuityEstimate } from '../leave/leave-policy';
import { CreateEmployeeDto, DocumentDto, SelfUpdateDto, UpdateEmployeeDto } from './employees.dto';

const DATE_FIELDS = ['dateOfBirth', 'joiningDate', 'probationEnd', 'contractEnd'] as const;
const SALARY_FIELDS = ['basicSalary', 'housingAllow', 'transportAllow', 'otherAllow', 'iban', 'bankName'] as const;

function maskIban(iban: string | null) {
  return iban ? `${iban.slice(0, 4)}••••••••••••••${iban.slice(-4)}` : null;
}

/** Temporary password shown once to HR; user must change it at first login. */
function tempPassword() {
  return `Tmp-${randomBytes(6).toString('base64url')}9a`;
}

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService, private audit: AuditService, private storage: StorageService) {}

  async list(u: AuthUser, q: { search?: string; branchId?: string; status?: string }) {
    if (q.branchId) assertBranchInScope(u, q.branchId);
    const where: Prisma.EmployeeWhereInput = {
      ...employeeScope(u),
      ...(q.branchId ? { branchId: q.branchId } : {}),
      ...(q.status ? { user: { status: q.status as any } } : {}),
      ...(q.search
        ? { OR: [
            { firstName: { contains: q.search, mode: 'insensitive' } },
            { lastName: { contains: q.search, mode: 'insensitive' } },
            { designation: { contains: q.search, mode: 'insensitive' } },
            { user: { employeeCode: { contains: q.search, mode: 'insensitive' } } },
          ] }
        : {}),
    };
    const rows = await this.prisma.employee.findMany({
      where, orderBy: { firstName: 'asc' },
      select: {
        id: true, firstName: true, lastName: true, designation: true, nationality: true, photoUrl: true, joiningDate: true, workMode: true,
        user: { select: { id: true, employeeCode: true, email: true, phone: true, role: true, status: true } },
        branch: { select: { id: true, name: true } }, department: { select: { name: true } },
        documents: { where: { expiryDate: { not: null } }, select: { type: true, expiryDate: true } },
      },
    });
    const soon = new Date(localDate().getTime() + 30 * 86_400_000);
    return rows.map(({ documents, ...e }) => ({
      ...e,
      joiningDate: fmtDate(e.joiningDate),
      expiringDocs: documents.filter((d) => d.expiryDate! <= soon).length,
    }));
  }

  async get(u: AuthUser, id: string) {
    const e = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, employeeCode: true, email: true, phone: true, role: true, status: true, lastLoginAt: true, mfaEnabled: true, devices: true } },
        branch: { select: { id: true, name: true, emirate: true } },
        department: true, shift: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
        documents: { orderBy: { type: 'asc' } },
      },
    });
    if (!e) throw new NotFoundException();
    const self = e.id === u.employeeId;
    if (!self) {
      if (u.role === 'EMPLOYEE') throw new ForbiddenException();
      assertBranchInScope(u, e.branchId);
    }
    const out: any = {
      ...e,
      ...Object.fromEntries(DATE_FIELDS.map((k) => [k, e[k] ? fmtDate(e[k] as Date) : null])),
      documents: e.documents.map((d) => ({ ...d, issueDate: d.issueDate ? fmtDate(d.issueDate) : null, expiryDate: d.expiryDate ? fmtDate(d.expiryDate) : null })),
    };
    // Salary is visible to HR and to the employee themself only. IBAN is masked except for HR.
    if (!isHr(u) && !self) for (const k of SALARY_FIELDS) delete out[k];
    if (!isHr(u)) out.iban = maskIban(e.iban);
    if (isHr(u) || self) {
      out.gratuityEstimate = e.basicSalary ? gratuityEstimate(Number(e.basicSalary), e.joiningDate, localDate()) : null;
    }
    if (!isHr(u)) delete out.user.devices;
    return out;
  }

  private toData(dto: Partial<CreateEmployeeDto>) {
    const { employeeCode, email, phone, role, ...rest } = dto as any;
    void employeeCode; void email; void phone; void role;
    for (const k of DATE_FIELDS) if (rest[k] !== undefined) rest[k] = rest[k] ? parseDate(rest[k]) : null;
    delete rest.status;
    return rest;
  }

  async create(u: AuthUser, dto: CreateEmployeeDto, req: any) {
    if (dto.role === 'SUPER_ADMIN' && u.role !== 'SUPER_ADMIN') throw new ForbiddenException('Only Super Admin can create Super Admins');
    const exists = await this.prisma.user.findFirst({ where: { OR: [{ employeeCode: dto.employeeCode.toUpperCase() }, { email: dto.email.toLowerCase() }] } });
    if (exists) throw new ConflictException('Employee code or email already exists');
    const password = tempPassword();
    const user = await this.prisma.user.create({
      data: {
        employeeCode: dto.employeeCode.toUpperCase(), email: dto.email.toLowerCase(), phone: dto.phone,
        role: dto.role ?? 'EMPLOYEE', passwordHash: await bcrypt.hash(password, 10), mustChangePwd: true,
        employee: { create: this.toData(dto) },
      },
      include: { employee: true },
    });
    if (user.role === 'BRANCH_MANAGER') {
      await this.prisma.branch.update({ where: { id: dto.branchId }, data: { managers: { connect: { id: user.id } } } });
    }
    await this.audit.log({ actorId: u.userId, action: 'EMPLOYEE_CREATED', entity: 'Employee', entityId: user.employee!.id, newValue: { ...dto, iban: undefined }, req });
    return { id: user.employee!.id, employeeCode: user.employeeCode, temporaryPassword: password };
  }

  async update(u: AuthUser, id: string, dto: UpdateEmployeeDto, req: any) {
    const before = await this.prisma.employee.findUnique({ where: { id }, include: { user: true } });
    if (!before) throw new NotFoundException();
    if ((dto.role === 'SUPER_ADMIN' || before.user.role === 'SUPER_ADMIN') && u.role !== 'SUPER_ADMIN') throw new ForbiddenException('Only Super Admin can change a Super Admin');
    if (dto.managerId === id) throw new BadRequestException('Employee cannot be their own manager');
    const userData: Prisma.UserUpdateInput = {};
    if (dto.email) userData.email = dto.email.toLowerCase();
    if (dto.phone !== undefined) userData.phone = dto.phone;
    if (dto.role) userData.role = dto.role;
    if (dto.status) userData.status = dto.status;
    if (dto.employeeCode) userData.employeeCode = dto.employeeCode.toUpperCase();
    const updated = await this.prisma.employee.update({ where: { id }, data: { ...this.toData(dto), user: { update: userData } } });
    if (dto.status === 'INACTIVE') {
      await this.prisma.refreshToken.updateMany({ where: { userId: before.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.log({ actorId: u.userId, action: 'EMPLOYEE_UPDATED', entity: 'Employee', entityId: id, oldValue: before, newValue: updated, req });
    return this.get(u, id);
  }

  async resetPassword(u: AuthUser, id: string, req: any) {
    const e = await this.prisma.employee.findUnique({ where: { id }, include: { user: true } });
    if (!e) throw new NotFoundException();
    if (e.user.role === 'SUPER_ADMIN' && u.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    const password = tempPassword();
    await this.prisma.user.update({ where: { id: e.userId }, data: { passwordHash: await bcrypt.hash(password, 10), mustChangePwd: true, failedLogins: 0, lockedUntil: null } });
    await this.prisma.refreshToken.updateMany({ where: { userId: e.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ actorId: u.userId, action: 'PASSWORD_RESET', entity: 'User', entityId: e.userId, req });
    return { temporaryPassword: password };
  }

  async selfUpdate(u: AuthUser, dto: SelfUpdateDto, req: any) {
    if (!u.employeeId) throw new ForbiddenException();
    const { phone, ...rest } = dto;
    const before = await this.prisma.employee.findUniqueOrThrow({ where: { id: u.employeeId } });
    await this.prisma.employee.update({ where: { id: u.employeeId }, data: { ...rest, ...(phone ? { user: { update: { phone } } } : {}) } });
    await this.audit.log({ actorId: u.userId, action: 'PROFILE_SELF_UPDATED', entity: 'Employee', entityId: u.employeeId, oldValue: before, newValue: dto, req });
    return this.get(u, u.employeeId);
  }

  // ---------- Documents ----------
  async addDocument(u: AuthUser, employeeId: string, dto: DocumentDto, file: Express.Multer.File | undefined, req: any) {
    const e = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!e) throw new NotFoundException();
    const fileUrl = file ? await this.storage.save(employeeId, file) : null;
    const doc = await this.prisma.employeeDocument.create({
      data: {
        employeeId, type: dto.type, number: dto.number, notes: dto.notes, fileUrl,
        issueDate: dto.issueDate ? parseDate(dto.issueDate) : null, expiryDate: dto.expiryDate ? parseDate(dto.expiryDate) : null,
      },
    });
    await this.audit.log({ actorId: u.userId, action: 'DOCUMENT_ADDED', entity: 'EmployeeDocument', entityId: doc.id, newValue: { ...dto, hasFile: !!file }, req });
    return doc;
  }

  async updateDocument(u: AuthUser, docId: string, dto: Partial<DocumentDto>, file: Express.Multer.File | undefined, req: any) {
    const before = await this.prisma.employeeDocument.findUnique({ where: { id: docId } });
    if (!before) throw new NotFoundException();
    const fileUrl = file ? await this.storage.save(before.employeeId, file) : undefined;
    const doc = await this.prisma.employeeDocument.update({
      where: { id: docId },
      data: {
        type: dto.type, number: dto.number, notes: dto.notes, fileUrl,
        issueDate: dto.issueDate ? parseDate(dto.issueDate) : undefined, expiryDate: dto.expiryDate ? parseDate(dto.expiryDate) : undefined,
      },
    });
    await this.audit.log({ actorId: u.userId, action: 'DOCUMENT_UPDATED', entity: 'EmployeeDocument', entityId: docId, oldValue: before, newValue: doc, req });
    return doc;
  }

  async deleteDocument(u: AuthUser, docId: string, req: any) {
    const doc = await this.prisma.employeeDocument.delete({ where: { id: docId } });
    await this.audit.log({ actorId: u.userId, action: 'DOCUMENT_DELETED', entity: 'EmployeeDocument', entityId: docId, oldValue: doc, req });
    return { ok: true };
  }

  // ---------- Devices ----------
  async pendingDevices(u: AuthUser) {
    return this.prisma.device.findMany({
      where: { status: 'PENDING', user: { employee: employeeScope(u) } },
      include: { user: { select: { employeeCode: true, employee: { select: { firstName: true, lastName: true, branch: { select: { name: true } } } } } } },
      orderBy: { registeredAt: 'asc' },
    });
  }

  /** Approving a new phone revokes the old one: one active device per employee. */
  async decideDevice(u: AuthUser, deviceId: string, action: 'APPROVE' | 'REVOKE', req: any) {
    const d = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!d) throw new NotFoundException();
    if (action === 'APPROVE') {
      await this.prisma.$transaction([
        this.prisma.device.updateMany({ where: { userId: d.userId, status: 'ACTIVE' }, data: { status: 'REVOKED' } }),
        this.prisma.device.update({ where: { id: deviceId }, data: { status: 'ACTIVE', approvedAt: new Date() } }),
      ]);
    } else {
      await this.prisma.device.update({ where: { id: deviceId }, data: { status: 'REVOKED' } });
      await this.prisma.refreshToken.updateMany({ where: { userId: d.userId, deviceId: d.deviceId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.log({ actorId: u.userId, action: `DEVICE_${action}`, entity: 'Device', entityId: deviceId, oldValue: { status: d.status }, req });
    return { ok: true };
  }
}
