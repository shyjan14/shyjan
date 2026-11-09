'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api } from '@/lib/api';
import { fmtMins, fmtTime, label, todayDubai } from '@/lib/format';
import { useLoad } from '@/lib/hooks';
import { Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Table } from '@/components/ui';
import { useMe } from '@/components/AuthContext';

const FILTERS = ['ALL', 'PRESENT', 'LATE', 'ON_BREAK', 'ON_LEAVE', 'NOT_IN', 'ABSENT', 'MISSED_PUNCH'];

function Register() {
  const params = useSearchParams();
  const { isHr } = useMe();
  const [date, setDate] = useState(todayDubai());
  const [branchId, setBranchId] = useState(params.get('branchId') ?? '');
  const [filter, setFilter] = useState('ALL');
  const [q, setQ] = useState('');
  const [manual, setManual] = useState<any | null>(null);
  const branches = useLoad(() => api('/branches'));
  const { data, error, loading, reload } = useLoad(() => api(`/attendance/register?date=${date}${branchId ? `&branchId=${branchId}` : ''}`), [date, branchId]);

  const rows = (data?.rows ?? []).filter((r: any) => (filter === 'ALL' || r.status === filter) && (!q || `${r.name} ${r.code}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <PageHeader title="Attendance register" subtitle="Daily check-in, check-out and breaks" />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date"><Input type="date" value={date} max={todayDubai()} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Branch">
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">All my branches</option>
              {branches.data?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Search"><Input placeholder="Name or code" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist">
          {FILTERS.map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${filter === f ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'}`}>
              {f === 'ALL' ? 'All' : f === 'NOT_IN' ? 'Not in' : label(f)} {f === 'ALL' ? data?.total ?? '' : data?.counts?.[f] ?? 0}
            </button>
          ))}
        </div>
      </Card>
      <ErrorBox error={error} />
      <Card>
        {loading ? <Spinner /> : rows.length === 0 ? <Empty title="No employees match" /> : (
          <Table head={['Employee', 'Branch', 'Status', 'Check in', 'Check out', 'Worked', 'Break', 'Late', 'Flags', '']}>
            {rows.map((r: any) => (
              <tr key={r.employeeId} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/employees/${r.employeeId}`} className="font-medium text-slate-900 hover:text-brand-700">{r.name}</Link>
                  <div className="text-xs text-slate-500">{r.code} · {r.designation}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.branch.name}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} />{r.leaveType && <div className="mt-1 text-xs text-slate-500">{r.leaveType}</div>}</td>
                <td className="px-4 py-3 tabular-nums">{fmtTime(r.firstIn)}</td>
                <td className="px-4 py-3 tabular-nums">{fmtTime(r.lastOut)}</td>
                <td className="px-4 py-3 tabular-nums">{r.workMinutes ? fmtMins(r.workMinutes) : '—'}</td>
                <td className="px-4 py-3 tabular-nums">{r.breakMinutes ? fmtMins(r.breakMinutes) : '—'}</td>
                <td className="px-4 py-3 tabular-nums">{r.lateMinutes ? <span className="text-amber-700">{r.lateMinutes}m</span> : '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{r.flags.map(label).join(', ') || '—'}</td>
                <td className="px-4 py-3 text-right">{isHr && <Button variant="ghost" onClick={() => setManual(r)}>Correct</Button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <ManualPunch row={manual} date={date} onClose={() => setManual(null)} onDone={() => { setManual(null); reload(); }} />
    </>
  );
}

function ManualPunch({ row, date, onClose, onDone }: { row: any; date: string; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState('CHECK_IN');
  const [time, setTime] = useState('09:00');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setError(null);
    try {
      await api('/attendance/manual', { method: 'POST', json: { employeeId: row.employeeId, type, time: new Date(`${date}T${time}:00+04:00`).toISOString(), reason } });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal open={!!row} onClose={onClose} title={`Manual correction · ${row?.name ?? ''}`}>
      <ErrorBox error={error} />
      <div className="space-y-4">
        <Field label="Punch type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {['CHECK_IN', 'BREAK_START', 'BREAK_END', 'CHECK_OUT'].map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </Select>
        </Field>
        <Field label={`Time on ${date} (UAE)`}><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <Field label="Reason (required, saved in audit log)"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Phone battery dead, confirmed by manager" /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={reason.trim().length < 5}>Save correction</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><Register /></Suspense>;
}
