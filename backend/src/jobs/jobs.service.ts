import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AttendanceService } from '../attendance/attendance.service';
import { PrismaService } from '../common/prisma.service';
import { addDays, fmtDate, localDate } from '../common/time';

const TZ = 'Asia/Dubai';
const REMIND_AT_DAYS = [90, 60, 30, 7, 0];

@Injectable()
export class JobsService {
  private log = new Logger('Jobs');
  constructor(private attendance: AttendanceService, private prisma: PrismaService) {}

  @Cron('*/30 * * * *', { timeZone: TZ })
  async autoClose() {
    const n = await this.attendance.autoCloseOpenDays();
    if (n) this.log.log(`Auto-closed ${n} open attendance day(s)`);
  }

  /** 00:20 Dubai: mark yesterday's absentees, holidays and weekly offs. */
  @Cron('20 0 * * *', { timeZone: TZ })
  async finalizeYesterday() {
    const n = await this.attendance.finalizeDay(addDays(localDate(), -1));
    this.log.log(`Finalized ${n} attendance record(s)`);
  }

  /** 08:00 Dubai: document expiry reminders to the employee and HR. */
  @Cron('0 8 * * *', { timeZone: TZ })
  async documentExpiry() {
    const today = localDate();
    const dates = REMIND_AT_DAYS.map((d) => addDays(today, d));
    const docs = await this.prisma.employeeDocument.findMany({
      where: { expiryDate: { in: dates }, employee: { user: { status: 'ACTIVE' } } },
      include: { employee: { select: { userId: true, firstName: true, lastName: true } } },
    });
    const hr = await this.prisma.user.findMany({ where: { role: 'HR_ADMIN', status: 'ACTIVE' }, select: { id: true } });
    const data = docs.flatMap((d) => {
      const days = Math.round((d.expiryDate!.getTime() - today.getTime()) / 86_400_000);
      const what = d.type.replace(/_/g, ' ').toLowerCase();
      const when = days === 0 ? 'expires today' : `expires in ${days} days (${fmtDate(d.expiryDate!)})`;
      return [
        { userId: d.employee.userId, title: 'Document expiring', body: `Your ${what} ${when}. Please renew and share with HR.` },
        ...hr.map((h) => ({ userId: h.id, title: 'Employee document expiring', body: `${d.employee.firstName} ${d.employee.lastName}: ${what} ${when}` })),
      ];
    });
    if (data.length) await this.prisma.notification.createMany({ data });
    this.log.log(`Sent ${data.length} document expiry reminder(s)`);
  }
}
