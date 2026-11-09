'use client';
import { useState } from 'react';
import { api, download } from '@/lib/api';
import { useLoad } from '@/lib/hooks';
import { Button, Card, Empty, ErrorBox, Field, Input, PageHeader, Select, Spinner, Table } from '@/components/ui';
import { useMe } from '@/components/AuthContext';

export default function Reports() {
  const { isHr } = useMe();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [branchId, setBranchId] = useState('');
  const branches = useLoad(() => api('/branches'));
  const q = `month=${month}${branchId ? `&branchId=${branchId}` : ''}`;
  const { data, error, loading } = useLoad(() => api(`/reports/attendance-summary?${q}`), [q]);
  const [err, setErr] = useState<string | null>(null);
  const dl = (path: string, name: string) => download(path, name).catch((e) => setErr(e.message));
  return (
    <>
      <PageHeader title="Reports" subtitle="Monthly attendance summary and payroll input"
        actions={<>
          <Button variant="secondary" onClick={() => dl(`/reports/attendance-summary?${q}&format=csv`, `attendance-${month}.csv`)}>⬇ Attendance (Excel)</Button>
          {isHr && <Button onClick={() => dl(`/reports/payroll-export?month=${month}`, `payroll-input-${month}.csv`)}>⬇ Payroll input (WPS)</Button>}
        </>} />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <Field label="Month"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
        <Field label="Branch">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All my branches</option>
            {branches.data?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
      </Card>
      <ErrorBox error={error ?? err} />
      <Card>
        {loading ? <Spinner /> : !data?.rows.length ? <Empty title="No data" /> : (
          <Table head={['Employee', 'Branch', 'Present', 'Late', 'Half day', 'Absent', 'Leave', 'Missed', 'Work hrs', 'OT hrs', 'Late min']}>
            {data.rows.map((r: any) => (
              <tr key={r.code}>
                <td className="px-4 py-3"><div className="font-medium">{r.name}</div><div className="text-xs text-slate-500">{r.code} · {r.designation}</div></td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.branch}</td>
                {[r.present, r.late, r.halfDay, r.absent, r.onLeave, r.missedPunch, r.workHours, r.overtimeHours, r.lateMinutes].map((v, i) => (
                  <td key={i} className={`px-4 py-3 tabular-nums ${(i === 3 && v) ? 'font-semibold text-red-700' : ''}`}>{v}</td>
                ))}
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
