import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { SetupController } from './branches/setup.controller';
import { AuditService } from './common/audit.service';
import { AuthGuard } from './common/auth.guard';
import { PrismaService } from './common/prisma.service';
import { StorageService } from './common/storage.service';
import { EmployeesController } from './employees/employees.controller';
import { EmployeesService } from './employees/employees.service';
import { HealthController } from './health.controller';
import { JobsService } from './jobs/jobs.service';
import { LeaveController } from './leave/leave.controller';
import { LeaveService } from './leave/leave.service';
import { ReportsController } from './reports/reports.controller';

@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MIN ?? 120) }]),
    ...(process.env.DISABLE_JOBS === 'true' ? [] : [ScheduleModule.forRoot()]),
  ],
  controllers: [HealthController, AuthController, AttendanceController, LeaveController, EmployeesController, SetupController, ReportsController],
  providers: [
    PrismaService, AuditService, StorageService, AuthService, AttendanceService, LeaveService, EmployeesService,
    ...(process.env.DISABLE_JOBS === 'true' ? [] : [JobsService]),
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
