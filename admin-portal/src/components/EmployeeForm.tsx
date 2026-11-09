'use client';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useLoad } from '@/lib/hooks';
import { Button, Card, ErrorBox, Field, Input, Select } from './ui';

const NATIONALITIES = ['Emirati', 'Indian', 'Pakistani', 'Bangladeshi', 'Filipino', 'Egyptian', 'Jordanian', 'Sri Lankan', 'Nepali', 'Syrian', 'Lebanese', 'British', 'Other'];
const EMIRATES = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];

export function EmployeeForm({ initial, onSaved }: { initial?: any; onSaved: (r: any) => void }) {
  const editing = !!initial;
  const [f, setF] = useState<any>(() => initial ? {
    employeeCode: initial.user.employeeCode, email: initial.user.email, phone: initial.user.phone ?? '', role: initial.user.role, status: initial.user.status,
    branchId: initial.branch.id, departmentId: initial.department?.id ?? '', managerId: initial.manager?.id ?? '', shiftId: initial.shift?.id ?? '',
    firstName: initial.firstName, lastName: initial.lastName, nameArabic: initial.nameArabic ?? '', designation: initial.designation, gender: initial.gender,
    dateOfBirth: initial.dateOfBirth ?? '', nationality: initial.nationality, maritalStatus: initial.maritalStatus ?? '', religion: initial.religion ?? '', bloodGroup: initial.bloodGroup ?? '',
    uaeAddress: initial.uaeAddress ?? '', emirate: initial.emirate ?? '', homeAddress: initial.homeAddress ?? '',
    emergencyName: initial.emergencyName ?? '', emergencyRelation: initial.emergencyRelation ?? '', emergencyPhone: initial.emergencyPhone ?? '',
    joiningDate: initial.joiningDate, probationEnd: initial.probationEnd ?? '', contractType: initial.contractType, contractEnd: initial.contractEnd ?? '',
    workMode: initial.workMode, allowRemotePunch: initial.allowRemotePunch,
    basicSalary: initial.basicSalary ?? '', housingAllow: initial.housingAllow ?? '', transportAllow: initial.transportAllow ?? '', otherAllow: initial.otherAllow ?? '',
    iban: initial.iban ?? '', bankName: initial.bankName ?? '',
  } : { role: 'EMPLOYEE', gender: 'MALE', nationality: 'Indian', contractType: 'UNLIMITED', workMode: 'OFFICE', allowRemotePunch: false, joiningDate: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const branches = useLoad(() => api('/branches'));
  const depts = useLoad(() => api('/departments'));
  const shifts = useLoad(() => api('/shifts'));
  const managers = useLoad(() => api('/employees?status=ACTIVE'));
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: any = {};
    for (const [k, v] of Object.entries(f)) if (v !== '' && v !== null && v !== undefined) body[k] = v;
    for (const k of ['basicSalary', 'housingAllow', 'transportAllow', 'otherAllow']) if (body[k] !== undefined) body[k] = Number(body[k]);
    if (body.iban?.includes('•')) delete body.iban;
    try {
      const r = editing ? await api(`/employees/${initial.id}`, { method: 'PATCH', json: body }) : await api('/employees', { method: 'POST', json: body });
      onSaved(r);
    } catch (err) {
      setError((err as Error).message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  const section = (title: string, children: React.ReactNode) => (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </Card>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      <ErrorBox error={error} />
      {section('Account', <>
        <Field label="Employee code *"><Input value={f.employeeCode ?? ''} onChange={set('employeeCode')} required /></Field>
        <Field label="Work email *"><Input type="email" value={f.email ?? ''} onChange={set('email')} required /></Field>
        <Field label="UAE mobile" hint="+9715XXXXXXXX"><Input value={f.phone ?? ''} onChange={set('phone')} /></Field>
        <Field label="Role">
          <Select value={f.role} onChange={set('role')}>
            <option value="EMPLOYEE">Employee</option><option value="BRANCH_MANAGER">Branch Manager</option><option value="HR_ADMIN">HR Admin</option><option value="SUPER_ADMIN">Super Admin</option>
          </Select>
        </Field>
        {editing && <Field label="Status"><Select value={f.status} onChange={set('status')}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive (blocks login)</option></Select></Field>}
      </>)}
      {section('Personal', <>
        <Field label="First name *"><Input value={f.firstName ?? ''} onChange={set('firstName')} required /></Field>
        <Field label="Last name *"><Input value={f.lastName ?? ''} onChange={set('lastName')} required /></Field>
        <Field label="Name in Arabic"><Input dir="rtl" value={f.nameArabic ?? ''} onChange={set('nameArabic')} /></Field>
        <Field label="Gender *"><Select value={f.gender} onChange={set('gender')}><option value="MALE">Male</option><option value="FEMALE">Female</option></Select></Field>
        <Field label="Date of birth"><Input type="date" value={f.dateOfBirth ?? ''} onChange={set('dateOfBirth')} /></Field>
        <Field label="Nationality *"><Select value={f.nationality} onChange={set('nationality')}>{NATIONALITIES.map((n) => <option key={n}>{n}</option>)}</Select></Field>
        <Field label="Marital status"><Select value={f.maritalStatus ?? ''} onChange={set('maritalStatus')}><option value="">—</option><option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option></Select></Field>
        <Field label="Religion" hint="Optional, used for Hajj leave eligibility"><Input value={f.religion ?? ''} onChange={set('religion')} /></Field>
        <Field label="Blood group"><Select value={f.bloodGroup ?? ''} onChange={set('bloodGroup')}><option value="">—</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}</Select></Field>
      </>)}
      {section('Job', <>
        <Field label="Designation *"><Input value={f.designation ?? ''} onChange={set('designation')} required /></Field>
        <Field label="Branch *">
          <Select value={f.branchId ?? ''} onChange={set('branchId')} required><option value="">Select…</option>{branches.data?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
        </Field>
        <Field label="Department"><Select value={f.departmentId ?? ''} onChange={set('departmentId')}><option value="">—</option>{depts.data?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        <Field label="Reporting manager" hint="First-level leave approver">
          <Select value={f.managerId ?? ''} onChange={set('managerId')}><option value="">— (goes straight to HR)</option>
            {managers.data?.filter((m: any) => m.user.role !== 'EMPLOYEE' && m.id !== initial?.id).map((m: any) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName} · {m.branch.name}</option>)}
          </Select>
        </Field>
        <Field label="Shift"><Select value={f.shiftId ?? ''} onChange={set('shiftId')}><option value="">Default 09:00–18:00</option>{shifts.data?.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>)}</Select></Field>
        <Field label="Joining date *"><Input type="date" value={f.joiningDate ?? ''} onChange={set('joiningDate')} required /></Field>
        <Field label="Probation end" hint="Max 6 months under UAE law"><Input type="date" value={f.probationEnd ?? ''} onChange={set('probationEnd')} /></Field>
        <Field label="Contract type"><Select value={f.contractType} onChange={set('contractType')}><option value="UNLIMITED">Unlimited</option><option value="LIMITED">Limited (fixed term)</option></Select></Field>
        <Field label="Contract end"><Input type="date" value={f.contractEnd ?? ''} onChange={set('contractEnd')} /></Field>
        <Field label="Work mode"><Select value={f.workMode} onChange={set('workMode')}><option value="OFFICE">Office / branch</option><option value="FIELD">Field / outdoor</option></Select></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={!!f.allowRemotePunch} onChange={set('allowRemotePunch')} className="h-4 w-4 rounded border-slate-300 text-brand-700" />
          Allow punch outside branch (flagged for review)
        </label>
      </>)}
      {section('UAE address & emergency contact', <>
        <Field label="Emirate"><Select value={f.emirate ?? ''} onChange={set('emirate')}><option value="">—</option>{EMIRATES.map((e) => <option key={e}>{e}</option>)}</Select></Field>
        <Field label="UAE address"><Input value={f.uaeAddress ?? ''} onChange={set('uaeAddress')} /></Field>
        <Field label="Home country address"><Input value={f.homeAddress ?? ''} onChange={set('homeAddress')} /></Field>
        <Field label="Emergency contact name"><Input value={f.emergencyName ?? ''} onChange={set('emergencyName')} /></Field>
        <Field label="Relation"><Input value={f.emergencyRelation ?? ''} onChange={set('emergencyRelation')} /></Field>
        <Field label="Emergency phone"><Input value={f.emergencyPhone ?? ''} onChange={set('emergencyPhone')} /></Field>
      </>)}
      {section('Salary & bank (WPS) — HR only', <>
        <Field label="Basic (AED)"><Input type="number" min={0} value={f.basicSalary ?? ''} onChange={set('basicSalary')} /></Field>
        <Field label="Housing (AED)"><Input type="number" min={0} value={f.housingAllow ?? ''} onChange={set('housingAllow')} /></Field>
        <Field label="Transport (AED)"><Input type="number" min={0} value={f.transportAllow ?? ''} onChange={set('transportAllow')} /></Field>
        <Field label="Other (AED)"><Input type="number" min={0} value={f.otherAllow ?? ''} onChange={set('otherAllow')} /></Field>
        <Field label="IBAN" hint="AE + 21 digits"><Input value={f.iban ?? ''} onChange={set('iban')} placeholder="AE070331234567890123456" /></Field>
        <Field label="Bank"><Input value={f.bankName ?? ''} onChange={set('bankName')} /></Field>
      </>)}
      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Button type="button" variant="secondary" onClick={() => history.back()}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create employee'}</Button>
      </div>
    </form>
  );
}
