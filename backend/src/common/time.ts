/** Company-local time helpers. UAE (Asia/Dubai) is UTC+4 with no daylight saving. */
export const TZ_OFFSET_MIN = Number(process.env.TZ_OFFSET_MINUTES ?? 240);

/** Local calendar date (as a UTC-midnight Date, suitable for @db.Date columns). */
export function localDate(d: Date = new Date()): Date {
  const shifted = new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/** "YYYY-MM-DD" → UTC-midnight Date. */
export function parseDate(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Invalid date: ${s}`);
  return new Date(`${s}T00:00:00.000Z`);
}

export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Absolute instant for a local date + "HH:mm" time. */
export function localDateTime(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(date.getTime() + (h * 60 + m - TZ_OFFSET_MIN) * 60_000);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));
}

/** Whole months of service completed between joining and `asOf`. */
export function completedMonths(joining: Date, asOf: Date): number {
  let months = (asOf.getUTCFullYear() - joining.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - joining.getUTCMonth());
  if (asOf.getUTCDate() < joining.getUTCDate()) months -= 1;
  return Math.max(0, months);
}
