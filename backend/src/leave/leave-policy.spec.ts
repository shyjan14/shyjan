import { annualLeaveAccrued, countLeaveDays, gratuityEstimate, splitBySlabs } from './leave-policy';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe('UAE leave policy', () => {
  it('gives no annual leave in the first 6 months', () => {
    expect(annualLeaveAccrued(d('2026-03-01'), 2026, d('2026-08-15'))).toBe(0);
  });
  it('gives 2 days per month after 6 months in the first year', () => {
    // joined 1 Mar; by 1 Oct = 7 completed months
    expect(annualLeaveAccrued(d('2026-03-01'), 2026, d('2026-10-01'))).toBe(14);
  });
  it('gives 30 days in a full year for an experienced employee', () => {
    expect(annualLeaveAccrued(d('2020-01-01'), 2026, d('2026-12-31'))).toBe(30);
  });
  it('counts working days excluding weekly off and holidays', () => {
    const days = countLeaveDays({
      from: d('2026-12-01'), to: d('2026-12-07'), countsCalendarDays: false,
      weeklyOffDays: [0], holidays: new Set(['2026-12-02']),
    });
    expect(days).toBe(5); // 7 days − Sunday 6th − National Day 2nd
  });
  it('counts calendar days for annual leave', () => {
    expect(countLeaveDays({ from: d('2026-12-01'), to: d('2026-12-07'), countsCalendarDays: true, weeklyOffDays: [0], holidays: new Set() })).toBe(7);
  });
  it('half day is 0.5 and must be a single date', () => {
    expect(countLeaveDays({ from: d('2026-12-01'), to: d('2026-12-01'), halfDay: 'FIRST_HALF', countsCalendarDays: true, weeklyOffDays: [], holidays: new Set() })).toBe(0.5);
    expect(() => countLeaveDays({ from: d('2026-12-01'), to: d('2026-12-02'), halfDay: 'FIRST_HALF', countsCalendarDays: true, weeklyOffDays: [], holidays: new Set() })).toThrow();
  });
  it('splits sick leave into 15 full / 30 half / 45 unpaid', () => {
    const slabs = [{ days: 15, pay: 'FULL' as const }, { days: 30, pay: 'HALF' as const }, { days: 45, pay: 'UNPAID' as const }];
    expect(splitBySlabs(10, 10, slabs)).toEqual({ FULL: 5, HALF: 5, UNPAID: 0, exceeding: 0 });
    expect(splitBySlabs(85, 10, slabs)).toEqual({ FULL: 0, HALF: 0, UNPAID: 5, exceeding: 5 });
  });
  it('calculates gratuity', () => {
    // 3 years, basic 6000 → 3 × 21 × 200 = 12,600
    expect(gratuityEstimate(6000, d('2023-01-01'), d('2026-01-01'))).toBe(12600);
    expect(gratuityEstimate(6000, d('2026-01-01'), d('2026-06-01'))).toBe(0);
  });
});
