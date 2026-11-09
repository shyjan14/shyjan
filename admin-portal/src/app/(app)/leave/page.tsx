'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { useLoad } from '@/lib/hooks';
import { Card, Empty, ErrorBox, Field, Input, PageHeader, Select, Spinner, StatusBadge } from '@/components/ui';

const TYPE_COLOR: Record<string, string> = {
  ANNUAL: 'bg-blue-500', SICK: 'bg-rose-500', MATERNITY: 'bg-pink-500', PARENTAL: 'bg-teal-500',
  BEREAVEMENT: 'bg-slate-500', STUDY: 'bg-indigo-500', HAJJ: 'bg-emerald-600', UNPAID: 'bg-amber-500',
};

export default function LeaveCalendar() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [branchId, setBranchId] = useState('');
  const branches = useLoad(() => api('/branches'));
  const { data, error, loading } = useLoad(() => api(`/leave/calendar?month=${month}${branchId ? `&branchId=${branchId}` : ''}`), [month, branchId]);

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const iso = (d: number) => `${month}-${String(d).padStart(2, '0')}`;
  const onDay = (d: string) => (data?.leaves ?? []).filter((l: any) => l.from <= d && l.to >= d);
  const holiday = (d: string) => data?.holidays.find((h: any) => h.date === d);

  return (
    <>
      <PageHeader title="Leave calendar" subtitle="See who is away before approving new requests" />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <Field label="Month"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
        <Field label="Branch">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All my branches</option>
            {branches.data?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
      </Card>
      <ErrorBox error={error} />
      {loading ? <Spinner /> : (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="overflow-hidden xl:col-span-2">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium uppercase text-slate-500">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} className="min-h-[92px] border-b border-r border-slate-100 bg-slate-50/50" />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = iso(i + 1);
                const ls = onDay(d);
                const h = holiday(d);
                return (
                  <div key={d} className={`min-h-[92px] border-b border-r border-slate-100 p-1.5 ${h ? 'bg-amber-50/60' : ''}`}>
                    <div className="text-xs font-medium text-slate-500">{i + 1}</div>
                    {h && <div className="truncate text-[11px] font-medium text-amber-700" title={h.name}>{h.name}</div>}
                    <div className="mt-1 space-y-0.5">
                      {ls.slice(0, 3).map((l: any) => (
                        <div key={l.id} title={`${l.employee} · ${l.type}`} className={`truncate rounded px-1 text-[11px] text-white ${TYPE_COLOR[l.code] ?? 'bg-slate-500'} ${l.status !== 'APPROVED' ? 'opacity-50' : ''}`}>{l.employee.split(' ')[0]}</div>
                      ))}
                      {ls.length > 3 && <div className="text-[11px] text-slate-500">+{ls.length - 3} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card>
            <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">This month ({data?.leaves.length ?? 0})</h2>
            {!data?.leaves.length ? <Empty title="No leave this month" /> : (
              <ul className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
                {data.leaves.map((l: any) => (
                  <li key={l.id} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{l.employee}</span><StatusBadge status={l.status} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-slate-500">
                      <span className={`h-2 w-2 rounded-full ${TYPE_COLOR[l.code] ?? 'bg-slate-500'}`} />{l.type} · {fmtDate(l.from)} → {fmtDate(l.to)} · {l.days}d
                    </div>
                    <div className="text-xs text-slate-400">{l.branch}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
