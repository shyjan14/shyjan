'use client';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtDateTime, fmtDate, label } from '@/lib/format';
import { useLoad } from '@/lib/hooks';
import { Card, ErrorBox, PageHeader, Spinner, Stat } from '@/components/ui';
import { useMe } from '@/components/AuthContext';

const PUNCH_TEXT: Record<string, string> = { CHECK_IN: 'checked in', CHECK_OUT: 'checked out', BREAK_START: 'started break', BREAK_END: 'ended break' };
const PUNCH_DOT: Record<string, string> = { CHECK_IN: 'bg-green-600', CHECK_OUT: 'bg-slate-500', BREAK_START: 'bg-violet-600', BREAK_END: 'bg-brand-600' };

export default function Dashboard() {
  const { me } = useMe();
  const { data, error, loading } = useLoad(() => api('/reports/dashboard'));
  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;
  const t = data.totals;
  const pct = t.employees ? Math.round((t.present / t.employees) * 100) : 0;
  const pendingTotal = data.pending.leaves + data.pending.regularizations + data.pending.devices;

  return (
    <>
      <PageHeader title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${me?.employee?.firstName ?? ''}`} subtitle={`Today, ${fmtDate(data.date)} · live across ${data.byBranch.length} branch${data.byBranch.length === 1 ? '' : 'es'}`} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Employees" value={t.employees} />
        <Stat label="Present" value={t.present} tone="green" hint={`${pct}% attendance`} />
        <Stat label="Late" value={t.late} tone="amber" />
        <Stat label="On break" value={t.onBreak} tone="violet" />
        <Stat label="On leave" value={t.onLeave} tone="blue" />
        <Stat label="Not in yet" value={t.notIn} tone="red" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Branch attendance today</h2>
            <Link href="/attendance" className="text-sm font-medium text-brand-700 hover:text-brand-800">Open register →</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.byBranch.map((b: any) => {
              const p = b.total ? (b.present / b.total) * 100 : 0;
              const l = b.total ? (b.onLeave / b.total) * 100 : 0;
              return (
                <Link key={b.branchId} href={`/attendance?branchId=${b.branchId}`} className="block px-5 py-3.5 hover:bg-slate-50">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{b.name}</span>
                    <span className="tabular-nums text-slate-500"><span className="font-semibold text-slate-900">{b.present}</span> / {b.total} present{b.late ? ` · ${b.late} late` : ''}</span>
                  </div>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <div className="bg-green-600" style={{ width: `${p}%` }} />
                    <div className="bg-blue-500" style={{ width: `${l}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="flex gap-4 px-5 py-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-600" />Present</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />On leave</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-200" />Not in</span>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold">Needs your attention</h2>
            <div className="mt-3 space-y-2">
              {[
                { n: data.pending.leaves, t: 'Leave requests', href: '/approvals' },
                { n: data.pending.regularizations, t: 'Attendance corrections', href: '/approvals?tab=reg' },
                { n: data.pending.devices, t: 'New phone approvals', href: '/approvals?tab=devices' },
                { n: data.expiringDocs, t: 'Documents expiring in 30 days', href: '/documents' },
              ].map((x) => (
                <Link key={x.t} href={x.href} className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50">
                  <span className="text-slate-700">{x.t}</span>
                  <span className={`min-w-[2rem] rounded-full px-2 py-0.5 text-center text-xs font-semibold ${x.n ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>{x.n}</span>
                </Link>
              ))}
            </div>
            {!pendingTotal && !data.expiringDocs && <p className="mt-2 text-sm text-slate-500">All clear ✓</p>}
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">Live punches</h2>
            {data.recentPunches.length === 0 && <p className="mt-3 text-sm text-slate-500">No punches in the last 24 hours.</p>}
            <ul className="mt-3 space-y-3">
              {data.recentPunches.map((p: any) => (
                <li key={p.id} className="flex gap-3 text-sm">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PUNCH_DOT[p.type]}`} />
                  <div className="min-w-0">
                    <p className="text-slate-800"><span className="font-medium">{p.employee.firstName} {p.employee.lastName}</span> {PUNCH_TEXT[p.type]}</p>
                    <p className="text-xs text-slate-500">{fmtDateTime(p.serverTime)} · {p.employee.branch.name}{p.flags.length ? ` · ${p.flags.map(label).join(', ')}` : ''}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
