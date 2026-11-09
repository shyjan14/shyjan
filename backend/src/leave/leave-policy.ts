/**
 * UAE leave rules (Federal Decree-Law No. 33 of 2021) as pure functions.
 * Values are driven by the LeaveType configuration so HR can change them.
 */
import { addDays, completedMonths, fmtDate } from '../common/time';

export type PaySlab = { days: number; pay: 'FULL' | 'HALF' | 'UNPAID' };

/**
 * Annual leave earned in leave-year `year` up to `asOf`.
 * - Under 6 months of service: nothing is available yet.
 * - In the first year: 2 days per completed month of service.
 * - After 1 year: 30 days/year, accrued at 2.5 days per completed month of the leave year.
 */
export function annualLeaveAccrued(joining: Date, year: number, asOf: Date, yearlyDays = 30): number {
  if (completedMonths(joining, asOf) < 6) return 0;
  let total = 0;
  for (let m = 0; m < 12; m++) {
    const monthEnd = new Date(Date.UTC(year, m + 1, 0)); // last day of month m
    if (monthEnd > asOf) break;
    if (monthEnd < joining) continue;
    const service = completedMonths(joining, addDays(monthEnd, 1));
    if (service < 1) continue;
    total += service <= 12 ? 2 : yearlyDays / 12;
  }
  return Math.round(total * 2) / 2; // nearest half day
}

/** Number of leave days in a range. */
export function countLeaveDays(params: {
  from: Date;
  to: Date;
  halfDay?: string | null;
  countsCalendarDays: boolean;
  weeklyOffDays: number[];
  holidays: Set<string>;
}): number {
  const { from, to, halfDay, countsCalendarDays, weeklyOffDays, holidays } = params;
  if (to < from) throw new Error('End date is before start date');
  if (halfDay) {
    if (fmtDate(from) !== fmtDate(to)) throw new Error('Half-day leave must be a single day');
    return 0.5;
  }
  let days = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (countsCalendarDays) days++;
    else if (!weeklyOffDays.includes(d.getUTCDay()) && !holidays.has(fmtDate(d))) days++;
  }
  return days;
}

/** Split a sick-leave request into full / half / unpaid days according to pay slabs. */
export function splitBySlabs(alreadyTaken: number, requested: number, slabs: PaySlab[]) {
  const out = { FULL: 0, HALF: 0, UNPAID: 0, exceeding: 0 };
  let cursor = alreadyTaken;
  let remaining = requested;
  let slabStart = 0;
  for (const slab of slabs) {
    const slabEnd = slabStart + slab.days;
    if (cursor < slabEnd && remaining > 0) {
      const take = Math.min(slabEnd - cursor, remaining);
      out[slab.pay] += take;
      cursor += take;
      remaining -= take;
    }
    slabStart = slabEnd;
  }
  out.exceeding = remaining;
  return out;
}

/** Gratuity (end-of-service): 21 days' basic per year for the first 5 years, 30 days per year after; capped at 2 years' total wage. */
export function gratuityEstimate(basicMonthly: number, joining: Date, asOf: Date): number {
  const years = completedMonths(joining, asOf) / 12;
  if (years < 1) return 0;
  const daily = basicMonthly / 30;
  const first = Math.min(years, 5) * 21 * daily;
  const rest = Math.max(0, years - 5) * 30 * daily;
  return Math.round(Math.min(first + rest, basicMonthly * 24) * 100) / 100;
}
