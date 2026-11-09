import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthUser, CurrentUser, HR, MANAGERS, Roles } from '../common/decorators';
import { localDate } from '../common/time';
import { DecisionDto, ManualPunchDto, PunchDto, RegularizationDto } from './attendance.dto';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private svc: AttendanceService) {}

  @Get('today')
  today(@CurrentUser() u: AuthUser) {
    return this.svc.today(u);
  }

  @Post('punch')
  @UseInterceptors(FileInterceptor('selfie', { limits: { fileSize: 5 * 1024 * 1024 } }))
  punch(@CurrentUser() u: AuthUser, @Body() dto: PunchDto, @UploadedFile() selfie: Express.Multer.File | undefined, @Headers('x-device-id') deviceId: string | undefined, @Req() req: any) {
    return this.svc.punch(u, dto, selfie, deviceId, req);
  }

  @Get('me')
  myMonth(@CurrentUser() u: AuthUser, @Query('month') month?: string) {
    return this.svc.month(u, u.employeeId ?? '-', month ?? new Date().toISOString().slice(0, 7));
  }

  @Roles(...MANAGERS) @Get('employee/:id')
  employeeMonth(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('month') month?: string) {
    return this.svc.month(u, id, month ?? new Date().toISOString().slice(0, 7));
  }

  @Roles(...MANAGERS) @Get('register')
  register(@CurrentUser() u: AuthUser, @Query('date') date?: string, @Query('branchId') branchId?: string) {
    return this.svc.register(u, date, branchId || undefined);
  }

  @Roles(...HR) @Post('manual')
  manual(@CurrentUser() u: AuthUser, @Body() dto: ManualPunchDto, @Req() req: any) {
    return this.svc.manualPunch(u, dto, req);
  }

  @Post('regularizations')
  requestReg(@CurrentUser() u: AuthUser, @Body() dto: RegularizationDto) {
    return this.svc.requestRegularization(u, dto);
  }

  @Get('regularizations')
  listReg(@CurrentUser() u: AuthUser, @Query('mine') mine?: string) {
    return this.svc.listRegularizations(u, mine === 'true');
  }

  @Roles(...MANAGERS) @Patch('regularizations/:id')
  decideReg(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto, @Req() req: any) {
    return this.svc.decideRegularization(u, id, dto, req);
  }

  /** HR can run day-end processing manually (normally done by the scheduler). */
  @Roles(...HR) @Post('jobs/run')
  async runJobs() {
    const closed = await this.svc.autoCloseOpenDays();
    const yesterday = new Date(localDate().getTime() - 86_400_000);
    const finalized = await this.svc.finalizeDay(yesterday);
    return { closed, finalized };
  }
}
