/** Reference data shared by the demo seed and the production setup. */
import { Gender } from '@prisma/client';

export const d = (s: string) => new Date(`${s}T00:00:00Z`);

export const LEAVE_TYPES = [
  { code: 'ANNUAL', name: 'Annual Leave (Vacation)', yearlyDays: 30, accrualMonthly: true, countsCalendarDays: true, carryForwardMax: 15, sortOrder: 1,
    description: '2 days/month after 6 months of service; 30 calendar days per year after 1 year.' },
  { code: 'SICK', name: 'Sick / Medical Leave', yearlyDays: 90, countsCalendarDays: true, attachmentAfterDays: 1, requiresProbationDone: true, sortOrder: 2,
    paySlabs: [{ days: 15, pay: 'FULL' }, { days: 30, pay: 'HALF' }, { days: 45, pay: 'UNPAID' }],
    description: 'Up to 90 days/year after probation: 15 days full pay, 30 days half pay, 45 days unpaid. Medical certificate required for more than 1 day.' },
  { code: 'MATERNITY', name: 'Maternity Leave', yearlyDays: 60, countsCalendarDays: true, genderRule: 'FEMALE' as Gender, attachmentAfterDays: 0, allowHalfDay: false, sortOrder: 3,
    paySlabs: [{ days: 45, pay: 'FULL' }, { days: 15, pay: 'HALF' }], description: '60 days: 45 days full pay + 15 days half pay.' },
  { code: 'PARENTAL', name: 'Parental Leave', yearlyDays: 5, countsCalendarDays: false, allowHalfDay: false, attachmentAfterDays: 0, sortOrder: 4,
    description: '5 working days, within 6 months of the child\'s birth.' },
  { code: 'BEREAVEMENT', name: 'Bereavement Leave', yearlyDays: 0, countsCalendarDays: true, allowHalfDay: false, sortOrder: 5,
    description: '5 days for spouse; 3 days for parent, child, sibling, grandparent or grandchild.' },
  { code: 'STUDY', name: 'Study / Exam Leave', yearlyDays: 10, countsCalendarDays: false, minServiceMonths: 24, attachmentAfterDays: 0, sortOrder: 6,
    description: '10 working days per year for exams at a UAE-accredited institution, after 2 years of service.' },
  { code: 'HAJJ', name: 'Hajj Leave', yearlyDays: 0, countsCalendarDays: true, minServiceMonths: 12, paid: false, allowHalfDay: false, sortOrder: 7,
    description: 'Once during service, as per company policy.' },
  { code: 'UNPAID', name: 'Unpaid Leave', yearlyDays: 0, countsCalendarDays: true, paid: false, sortOrder: 8,
    description: 'Subject to approval. Affects salary and annual leave accrual.' },
];

export const HOLIDAYS_2026 = [
  ['2026-01-01', "New Year's Day"],
  ['2026-03-19', 'Eid Al Fitr (est.)'], ['2026-03-20', 'Eid Al Fitr (est.)'], ['2026-03-21', 'Eid Al Fitr (est.)'],
  ['2026-05-26', 'Arafat Day (est.)'], ['2026-05-27', 'Eid Al Adha (est.)'], ['2026-05-28', 'Eid Al Adha (est.)'], ['2026-05-29', 'Eid Al Adha (est.)'],
  ['2026-06-16', 'Islamic New Year (est.)'],
  ['2026-08-25', "Prophet Muhammad's Birthday (est.)"],
  ['2026-12-01', 'Commemoration Day'],
  ['2026-12-02', 'UAE National Day'], ['2026-12-03', 'UAE National Day'],
];

export const DEPARTMENTS = ['Management', 'Human Resources', 'Training', 'Sales', 'Operations', 'Finance', 'Customer Service'];
