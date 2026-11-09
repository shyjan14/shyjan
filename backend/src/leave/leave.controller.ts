import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthUser, CurrentUser, HR, MANAGERS, Roles } from '../common/decorators';
import { localDate } from '../common/time';
import { AdjustBalanceDto, ApplyLeaveDto, LeaveDecisionDto } from './leave.dto';
import { LeaveService } from './leave.service';

@Controller('leave')
export class LeaveController {
  constructor(private svc: LeaveService) {}

  @Get('types')
  types(@CurrentUser() u: AuthUser) {
    return this.svc.types(u);
  }

  @Get('balances')
  balances(@CurrentUser() u: AuthUser, @Query('employeeId') employeeId?: string, @Query('year') year?: string) {
    return this.svc.balances(u, employeeId || u.employeeId || '-', Number(year) || localDate().getUTCFullYear());
  }

  @Post('requests')
  @UseInterceptors(FileInterceptor('attachment', { limits: { fileSize: 5 * 1024 * 1024 } }))
  apply(@CurrentUser() u: AuthUser, @Body() dto: ApplyLeaveDto, @UploadedFile() file?: Express.Multer.File) {
    return this.svc.apply(u, dto, file);
  }

  @Get('requests/mine')
  mine(@CurrentUser() u: AuthUser) {
    return this.svc.mine(u);
  }

  @Roles(...MANAGERS) @Get('requests')
  queue(@CurrentUser() u: AuthUser, @Query('status') status?: string) {
    return this.svc.queue(u, status);
  }

  @Roles(...MANAGERS) @Patch('requests/:id/decision')
  decide(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaveDecisionDto, @Req() req: any) {
    return this.svc.decide(u, id, dto, req);
  }

  @Patch('requests/:id/cancel')
  cancel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.svc.cancel(u, id, req);
  }

  @Get('calendar')
  calendar(@CurrentUser() u: AuthUser, @Query('month') month?: string, @Query('branchId') branchId?: string) {
    return this.svc.calendar(u, month ?? new Date().toISOString().slice(0, 7), branchId || undefined);
  }

  @Roles(...HR) @Post('balances/adjust')
  adjust(@CurrentUser() u: AuthUser, @Body() dto: AdjustBalanceDto, @Req() req: any) {
    return this.svc.adjust(u, dto, req);
  }
}
