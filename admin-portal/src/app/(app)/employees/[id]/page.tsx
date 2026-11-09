'use client';
import { useParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtMins, fmtTime, label } from '@/lib/format';
import { useLoad } from '@/lib/hooks';
import { AuthImageLink } from '@/components/AuthFile';
import { EmployeeForm } from '@/components/EmployeeForm';
import { Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Table } from '@/components/ui';
import { useMe } from '@/components/AuthContext';

const DOC_TYPES = ['EMIRATES_ID', 'PASSPORT', 'RESIDENCE_VISA', 'LABOUR_CARD', 'MEDICAL_INSURANCE', 'DRIVING_LICENCE', 'CONTRACT', 'OTHER'];

function daysLeft(d?: string | null) {
  if (!d) return null;
  return Math.round((new Date(`${d}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
}
function ExpiryChip({ date }: { date?: string | null }) {
  const n = daysLeft(date);
  if (n === null) return <span className="text-slate-400">—</span>;
  const tone = n < 0 ? 'bg-red-600 text-white' : n <= 30 ? 'bg-red-50 text-red-700' : n <= 90 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{n < 0 ? `Expired ${-n}d ago` : `${n} days left`}</span>;
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const { isHr } = useMe();
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const { data: e, error, loading, reload } = useLoad(() => api(`/employees/${id}`), [id]);
  const [pw, setPw] = useState<string | null>(null);
  if (loading) return <Spinner />;
  if (error || !e) return <ErrorBox error={error} />;

  if (editing) {
    return (
      <>
        <PageHeader title={`Edit ${e.firstName} ${e.lastName}`} />
        <EmployeeForm initial={e} onSaved={() => { setEditing(false); reload(); }} />
      </>
    );
  }

  const tabs = ['overview', 'documents', 'attendance', 'leave', ...(isHr ? ['security'] : [])];
  return (
    <>
      <Card className="mb-6 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-800">{e.firstName[0]}{e.lastName[0]}</span>
            <div>
              <h1 className="text-xl font-semibold">{e.firstName} {e.lastName} {e.nameArabic && <span dir="rtl" className="ml-2 font-normal text-slate-500">{e.nameArabic}</span>}</h1>
              <p className="text-sm text-slate-500">{e.user.employeeCode} · {e.designation} · {e.branch.name}</p>
              <div className="mt-1 flex gap-2"><StatusBadge status={e.user.status} /><span className="text-xs text-slate-500">{label(e.user.role)}</span></div>
            </div>
          </div>
          {isHr && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={async () => { if (confirm('Reset password? The employee will be logged out everywhere.')) setPw((await api(`/employees/${id}/reset-password`, { method: 'POST' })).temporaryPassword); }}>Reset password</Button>
              <Button onClick={() => setEditing(true)}>Edit</Button>
            </div>
          )}
        </div>
        <div className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
          {tabs.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{t === 'documents' ? 'UAE documents' : t}</button>
          ))}
        </div>
      </Card>

      {tab === 'overview' && <Overview e={e} />}
      {tab === 'documents' && <Documents e={e} reload={reload} />}
      {tab === 'attendance' && <Attendance id={id} />}
      {tab === 'leave' && <Leave id={id} />}
      {tab === 'security' && <Security e={e} reload={reload} />}

      <Modal open={!!pw} onClose={() => setPw(null)} title="New temporary password">
        <p className="text-sm text-slate-600">Shown only once. The employee must change it at next login.</p>
        <p className="mt-3 select-all rounded-lg bg-slate-50 p-3 text-center font-mono text-lg font-semibold">{pw}</p>
      </Modal>
    </>
  );
}

function Info({ items }: { items: [string, any][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}><dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt><dd className="mt-0.5 text-sm text-slate-900">{v || '—'}</dd></div>
      ))}
    </dl>
  );
}

function Overview({ e }: { e: any }) {
  const aed = (v: any) => (v ? `AED ${Number(v).toLocaleString()}` : null);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5"><h2 className="mb-4 font-semibold">Personal</h2>
        <Info items={[['Gender', label(e.gender)], ['Date of birth', fmtDate(e.dateOfBirth)], ['Nationality', e.nationality], ['Marital status', e.maritalStatus], ['Blood group', e.bloodGroup], ['Religion', e.religion]]} />
      </Card>
      <Card className="p-5"><h2 className="mb-4 font-semibold">Job</h2>
        <Info items={[['Department', e.department?.name], ['Manager', e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : null], ['Shift', e.shift ? `${e.shift.name} (${e.shift.startTime}–${e.shift.endTime})` : 'Default 09:00–18:00'], ['Joining date', fmtDate(e.joiningDate)], ['Probation end', fmtDate(e.probationEnd)], ['Contract', `${label(e.contractType)}${e.contractEnd ? ` until ${fmtDate(e.contractEnd)}` : ''}`], ['Work mode', label(e.workMode)], ['Remote punch', e.allowRemotePunch ? 'Allowed' : 'Not allowed']]} />
      </Card>
      <Card className="p-5"><h2 className="mb-4 font-semibold">Contact</h2>
        <Info items={[['Email', e.user.email], ['UAE mobile', e.user.phone], ['Emirate', e.emirate], ['UAE address', e.uaeAddress], ['Home address', e.homeAddress], ['Emergency contact', e.emergencyName ? `${e.emergencyName} (${e.emergencyRelation ?? ''}) ${e.emergencyPhone ?? ''}` : null]]} />
      </Card>
      {'basicSalary' in e && (
        <Card className="p-5"><h2 className="mb-4 font-semibold">Salary & end of service</h2>
          <Info items={[['Basic', aed(e.basicSalary)], ['Housing', aed(e.housingAllow)], ['Transport', aed(e.transportAllow)], ['Other', aed(e.otherAllow)], ['Bank', e.bankName], ['IBAN', e.iban], ['Gratuity estimate (today)', aed(e.gratuityEstimate)]]} />
          <p className="mt-4 text-xs text-slate-500">Gratuity: 21 days&apos; basic per year for the first 5 years, 30 days per year after that, capped at 2 years&apos; wage.</p>
        </Card>
      )}
    </div>
  );
}

function Documents({ e, reload }: { e: any; reload: () => void }) {
  const { isHr } = useMe();
  const [open, setOpen] = useState<any>(null);
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold">UAE documents</h2>
        {isHr && <Button onClick={() => setOpen({})}>+ Add document</Button>}
      </div>
      {!e.documents.length ? <Empty title="No documents yet" text="Add Emirates ID, passport, visa, labour card and insurance." /> : (
        <Table head={['Document', 'Number', 'Issue date', 'Expiry', '', '']}>
          {e.documents.map((d: any) => (
            <tr key={d.id}>
              <td className="px-4 py-3 font-medium">{label(d.type)}</td>
              <td className="px-4 py-3 font-mono text-xs">{d.number ?? '—'}</td>
              <td className="px-4 py-3">{fmtDate(d.issueDate)}</td>
              <td className="px-4 py-3"><div>{fmtDate(d.expiryDate)}</div><ExpiryChip date={d.expiryDate} /></td>
              <td className="px-4 py-3">{d.fileUrl ? <AuthImageLink path={d.fileUrl}>View scan</AuthImageLink> : <span className="text-xs text-slate-400">No scan</span>}</td>
              <td className="px-4 py-3 text-right">{isHr && <Button variant="ghost" onClick={() => setOpen(d)}>Edit</Button>}</td>
            </tr>
          ))}
        </Table>
      )}
      <DocModal doc={open} employeeId={e.id} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload(); }} />
    </Card>
  );
}

function DocModal({ doc, employeeId, onClose, onDone }: { doc: any; employeeId: string; onClose: () => void; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    for (const [k, v] of [...fd.entries()]) if (v === '' || (v instanceof File && !v.size)) fd.delete(k);
    try {
      await api(doc.id ? `/documents/${doc.id}` : `/employees/${employeeId}/documents`, { method: doc.id ? 'PATCH' : 'POST', body: fd });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal open={!!doc} onClose={onClose} title={doc?.id ? 'Edit document' : 'Add document'}>
      <ErrorBox error={error} />
      {doc && (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Type"><Select name="type" defaultValue={doc.type ?? 'EMIRATES_ID'}>{DOC_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select></Field>
          <Field label="Number"><Input name="number" defaultValue={doc.number ?? ''} placeholder="e.g. 784-1990-1234567-1" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue date"><Input type="date" name="issueDate" defaultValue={doc.issueDate ?? ''} /></Field>
            <Field label="Expiry date"><Input type="date" name="expiryDate" defaultValue={doc.expiryDate ?? ''} /></Field>
          </div>
          <Field label="Scan (JPG, PNG or PDF, max 5 MB)"><input type="file" name="file" accept="image/jpeg,image/png,application/pdf" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800" /></Field>
          <Field label="Notes"><Input name="notes" defaultValue={doc.notes ?? ''} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>
      )}
    </Modal>
  );
}

function Attendance({ id }: { id: string }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data, error, loading } = useLoad(() => api(`/attendance/employee/${id}?month=${month}`), [id, month]);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold">Attendance</h2>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="!w-44" aria-label="Month" />
      </div>
      <ErrorBox error={error} />
      {loading ? <Spinner /> : data && (
        <>
          <div className="grid grid-cols-2 gap-3 px-5 py-4 text-sm sm:grid-cols-4 lg:grid-cols-7">
            {[['Present', data.summary.PRESENT + data.summary.LATE], ['Late', data.summary.LATE], ['Absent', data.summary.ABSENT], ['On leave', data.summary.ON_LEAVE], ['Missed punch', data.summary.MISSED_PUNCH], ['Worked', fmtMins(data.summary.workMinutes)], ['Overtime', fmtMins(data.summary.overtimeMinutes)]].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">{k}</div><div className="mt-1 font-semibold tabular-nums">{v}</div></div>
            ))}
          </div>
          {!data.days.length ? <Empty title="No records this month" /> : (
            <Table head={['Date', 'Status', 'In', 'Out', 'Worked', 'Break', 'Late', 'OT', 'Punches']}>
              {data.days.map((d: any) => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap px-4 py-3">{fmtDate(d.date)}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3 tabular-nums">{fmtTime(d.firstIn)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmtTime(d.lastOut)}</td>
                  <td className="px-4 py-3 tabular-nums">{d.workMinutes ? fmtMins(d.workMinutes) : '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{d.breakMinutes ? fmtMins(d.breakMinutes) : '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{d.lateMinutes ? `${d.lateMinutes}m` : '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{d.overtimeMinutes ? fmtMins(d.overtimeMinutes) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {d.punches.map((p: any, i: number) => (
                      <span key={i} className="mr-2 whitespace-nowrap">
                        {label(p.type)} {fmtTime(p.serverTime)}{p.distanceM !== null ? ` (${p.distanceM}m)` : ''}
                        {p.selfieUrl && <> · <AuthImageLink path={p.selfieUrl}>selfie</AuthImageLink></>}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </>
      )}
    </Card>
  );
}

function Leave({ id }: { id: string }) {
  const { isHr } = useMe();
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, error, loading, reload } = useLoad(() => api(`/leave/balances?employeeId=${id}&year=${year}`), [id, year]);
  const [adj, setAdj] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  async function saveAdj(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    try {
      await api('/leave/balances/adjust', { method: 'POST', json: { employeeId: id, leaveTypeId: adj.leaveTypeId, year, days: Number(fd.get('days')), reason: fd.get('reason') } });
      setAdj(null);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold">Leave balances</h2>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="!w-28" aria-label="Year">
          {[year - 1, year, year + 1].map((y) => <option key={y}>{y}</option>)}
        </Select>
      </div>
      <ErrorBox error={error} />
      {loading ? <Spinner /> : (
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {data?.map((b: any) => (
            <div key={b.leaveTypeId} className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-medium text-slate-700">{b.name}</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{b.available ?? '∞'}<span className="ml-1 text-sm font-normal text-slate-500">{b.available !== null ? 'days left' : 'as approved'}</span></div>
              <div className="mt-2 text-xs text-slate-500">Entitled {b.entitled}{b.carriedForward ? ` + ${b.carriedForward} c/f` : ''}{b.adjustment ? ` ${b.adjustment > 0 ? '+' : ''}${b.adjustment} adj` : ''} · Taken {b.taken} · Pending {b.pending}</div>
              {isHr && <button onClick={() => setAdj(b)} className="mt-2 text-xs font-medium text-brand-700">Adjust</button>}
            </div>
          ))}
        </div>
      )}
      <Modal open={!!adj} onClose={() => setAdj(null)} title={`Adjust ${adj?.name ?? ''} (${year})`}>
        <ErrorBox error={err} />
        <form onSubmit={saveAdj} className="space-y-4">
          <Field label="Days (+ to add, − to deduct)"><Input name="days" type="number" step="0.5" required /></Field>
          <Field label="Reason (saved in audit log)"><Input name="reason" required minLength={5} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setAdj(null)}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>
      </Modal>
    </Card>
  );
}

function Security({ e, reload }: { e: any; reload: () => void }) {
  async function act(id: string, action: 'APPROVE' | 'REVOKE') {
    await api(`/devices/${id}`, { method: 'PATCH', json: { action } });
    reload();
  }
  return (
    <Card className="p-5">
      <h2 className="font-semibold">Registered phones</h2>
      <p className="mt-1 text-sm text-slate-500">Last login: {fmtDateTime(e.user.lastLoginAt)} · MFA: {e.user.mfaEnabled ? 'On' : 'Off'}</p>
      {!e.user.devices?.length ? <Empty title="No phone registered yet" text="The first phone used to log in is registered automatically." /> : (
        <ul className="mt-4 divide-y divide-slate-100">
          {e.user.devices.map((d: any) => (
            <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm"><span className="font-medium">{d.model ?? 'Phone'}</span> <span className="text-slate-500">· {d.platform} · since {fmtDate(d.registeredAt)}</span></div>
              <div className="flex items-center gap-2">
                <StatusBadge status={d.status} />
                {d.status !== 'ACTIVE' && <Button variant="secondary" onClick={() => act(d.id, 'APPROVE')}>Approve</Button>}
                {d.status !== 'REVOKED' && <Button variant="ghost" onClick={() => act(d.id, 'REVOKE')}>Block</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
