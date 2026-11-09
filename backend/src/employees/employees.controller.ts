import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { existsSync } from 'fs';
import { AuthUser, CurrentUser, HR, MANAGERS, Roles } from '../common/decorators';
import { PrismaService } from '../common/prisma.service';
import { assertBranchInScope } from '../common/scope';
import { StorageService } from '../common/storage.service';
import { CreateEmployeeDto, DocumentDto, SelfUpdateDto, UpdateEmployeeDto } from './employees.dto';
import { EmployeesService } from './employees.service';

const upload = FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } });

@Controller()
export class EmployeesController {
  constructor(private svc: EmployeesService, private storage: StorageService, private prisma: PrismaService) {}

  @Get('profile')
  profile(@CurrentUser() u: AuthUser) {
    if (!u.employeeId) throw new NotFoundException('No employee profile');
    return this.svc.get(u, u.employeeId);
  }

  @Patch('profile')
  selfUpdate(@CurrentUser() u: AuthUser, @Body() dto: SelfUpdateDto, @Req() req: any) {
    return this.svc.selfUpdate(u, dto, req);
  }

  @Roles(...MANAGERS) @Get('employees')
  list(@CurrentUser() u: AuthUser, @Query('search') search?: string, @Query('branchId') branchId?: string, @Query('status') status?: string) {
    return this.svc.list(u, { search, branchId: branchId || undefined, status: status || undefined });
  }

  @Roles(...MANAGERS) @Get('employees/:id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.get(u, id);
  }

  @Roles(...HR) @Post('employees')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateEmployeeDto, @Req() req: any) {
    return this.svc.create(u, dto, req);
  }

  @Roles(...HR) @Patch('employees/:id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto, @Req() req: any) {
    return this.svc.update(u, id, dto, req);
  }

  @Roles(...HR) @Post('employees/:id/reset-password')
  resetPassword(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.svc.resetPassword(u, id, req);
  }

  @Roles(...HR) @Post('employees/:id/documents') @UseInterceptors(upload)
  addDoc(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DocumentDto, @UploadedFile() file: Express.Multer.File | undefined, @Req() req: any) {
    return this.svc.addDocument(u, id, dto, file, req);
  }

  @Roles(...HR) @Patch('documents/:id') @UseInterceptors(upload)
  updateDoc(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DocumentDto, @UploadedFile() file: Express.Multer.File | undefined, @Req() req: any) {
    return this.svc.updateDocument(u, id, dto, file, req);
  }

  @Roles(...HR) @Delete('documents/:id')
  deleteDoc(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.svc.deleteDocument(u, id, req);
  }

  @Roles(...MANAGERS) @Get('devices/pending')
  pendingDevices(@CurrentUser() u: AuthUser) {
    return this.svc.pendingDevices(u);
  }

  @Roles(...HR) @Patch('devices/:id')
  decideDevice(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: { action: 'APPROVE' | 'REVOKE' }, @Req() req: any) {
    if (body?.action !== 'APPROVE' && body?.action !== 'REVOKE') throw new ForbiddenException('action must be APPROVE or REVOKE');
    return this.svc.decideDevice(u, id, body.action, req);
  }

  /** Private files (selfies, documents, certificates): owner, in-scope managers and HR only. */
  @Get('files/:employeeId/:name')
  async file(@CurrentUser() u: AuthUser, @Param('employeeId', ParseUUIDPipe) employeeId: string, @Param('name') name: string, @Res() res: Response) {
    if (employeeId !== u.employeeId) {
      if (u.role === 'EMPLOYEE') throw new ForbiddenException();
      const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
      if (!emp) throw new NotFoundException();
      assertBranchInScope(u, emp.branchId);
    }
    const path = this.storage.resolve(`${employeeId}/${name}`);
    if (!existsSync(path)) throw new NotFoundException();
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(path);
  }
}
