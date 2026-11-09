'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtTime } from '@/lib/format';
import { useLoad } from '@/lib/hooks';
import { Button, Card, Empty, ErrorBox, Input, Modal, PageHeader, Spinner, StatusBadge } from '@/components/ui';
import { AuthImageLink } from '@/components/AuthFile';
import { useMe } from '@/components/AuthContext';

function Approvals() {
  const params = useSearchParams();
  const { isHr } = useMe();
  const [tab, setTab] = useState(params.get('tab') ?? 'leave');
  const tabs = [
    { id: 'leave', label: 'Leave' },
    { id: 'reg', label: 'Attendance corrections' },
    { id: 'devices', label: 'New phones' },
  ];
  return (
    <>
      <PageHeader title="Approvals" subtitle={isHr ? 'Final HR approval for all branches' : 'First-level approval for your branch'} />
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 sm:inline-flex" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium sm:flex-none ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{t.label}</button>
        ))}
      </div>
      {tab === 'leave' && <LeaveQueue />}
      {tab === 'reg' && <RegQueue />}
      {tab === 'devices' && <DeviceQueue />}
    </>
  );
}

function Decide({ item, kind, onClose, onDone }: { item: any; kind: 'leave' | 'reg'; onClose: () => void; onDone: () => void }) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function act(action: 'APPROVE' | 'REJECT') {
    setBusy(true);
    setError(null);
    try {
      const path = kind === 'leave' ? `/leave/requests/${item.id}/decision` : `/attendance/regularizations/${item.id}`;
      await api(path, { method: 'PATCH', json: { action, comment: comment || undefined } });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={!!item} onClose={onClose} title={kind === 'leave' ? 'Leave request' : 'Attendance correction'}>
      {item && (
        <>
          <ErrorBox error={error} />
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            <dt className="text-slate-500">Employee</dt><dd className="col-span-2 font-medium">{item.employee.firstName} {item.employee.lastName} <span className="text-slate-500">({item.employee.user.employeeCode})</span></dd>
            {kind === 'leave' ? (
              <>
                <dt className="text-slate-500">Type</dt><dd className="col-span-2">{item.leaveType.name}</dd>
                <dt className="text-slate-500">Dates</dt><dd className="col-span-2">{fmtDate(item.fromDate)} → {fmtDate(item.toDate)} · <b>{item.days} day(s)</b>{item.halfDay ? ` (${item.halfDay.replace('_', ' ').toLowerCase()})` : ''}</dd>
                {item.attachmentUrl && <><dt className="text-slate-500">Attachment</dt><dd className="col-span-2"><AuthImageLink path={item.attachmentUrl}>View document</AuthImageLink></dd></>}
              </>
            ) : (
              <>
                <dt className="text-slate-500">Date</dt><dd className="col-span-2">{fmtDate(item.date)}</dd>
                <dt className="text-slate-500">Requested</dt><dd className="col-span-2">In {fmtTime(item.checkIn)} · Out {fmtTime(item.checkOut)}</dd>
              </>
            )}
            <dt className="text-slate-500">Reason</dt><dd className="col-span-2">{item.reason}</dd>
            <dt className="text-slate-500">Status</dt><dd className="col-span-2"><StatusBadge status={item.status} /></dd>
          </dl>
          <div className="mt-4"><Input placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} /></div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => act('REJECT')}>Reject</Button>
            <Button disabled={busy} onClick={() => act('APPROVE')}>Approve</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function LeaveQueue() {
  const { data, error, loading, reload } = useLoad(() => api('/leave/requests'));
  const [sel, setSel] = useState<any>(null);
  if (loading) return <Spinner />;
  return (
    <>
      <ErrorBox error={error} />
      <Card>
        {!data?.length ? <Empty title="No pending leave requests" text="New requests from the mobile app appear here." /> : (
          <ul className="divide-y divide-slate-100">
            {data.map((r: any) => (
              <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{r.employee.firstName} {r.employee.lastName} <span className="font-normal text-slate-500">· {r.employee.branch.name}</span></p>
                  <p className="text-sm text-slate-600">{r.leaveType.name} · {fmtDate(r.fromDate)} → {fmtDate(r.toDate)} · <b>{r.days}d</b></p>
                  <p className="truncate text-sm text-slate-500">“{r.reason}”</p>
                </div>
                <div className="flex items-center gap-3"><StatusBadge status={r.status} /><Button onClick={() => setSel(r)}>Review</Button></div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Decide item={sel} kind="leave" onClose={() => setSel(null)} onDone={() => { setSel(null); reload(); }} />
    </>
  );
}

function RegQueue() {
  const { data, error, loading, reload } = useLoad(() => api('/attendance/regularizations'));
  const [sel, setSel] = useState<any>(null);
  if (loading) return <Spinner />;
  return (
    <>
      <ErrorBox error={error} />
      <Card>
        {!data?.length ? <Empty title="No pending corrections" /> : (
          <ul className="divide-y divide-slate-100">
            {data.map((r: any) => (
              <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{r.employee.firstName} {r.employee.lastName} <span className="font-normal text-slate-500">· {r.employee.branch.name}</span></p>
                  <p className="text-sm text-slate-600">{fmtDate(r.date)} · In {fmtTime(r.checkIn)} · Out {fmtTime(r.checkOut)}</p>
                  <p className="text-sm text-slate-500">“{r.reason}”</p>
                </div>
                <div className="flex items-center gap-3"><StatusBadge status={r.status} /><Button onClick={() => setSel(r)}>Review</Button></div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Decide item={sel} kind="reg" onClose={() => setSel(null)} onDone={() => { setSel(null); reload(); }} />
    </>
  );
}

function DeviceQueue() {
  const { isHr } = useMe();
  const { data, error, loading, reload } = useLoad(() => api('/devices/pending'));
  const [err, setErr] = useState<string | null>(null);
  async function act(id: string, action: 'APPROVE' | 'REVOKE') {
    try {
      await api(`/devices/${id}`, { method: 'PATCH', json: { action } });
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  if (loading) return <Spinner />;
  return (
    <>
      <ErrorBox error={error ?? err} />
      <Card>
        <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">Each employee can punch from one phone only. Approving a new phone blocks the old one.</p>
        {!data?.length ? <Empty title="No new phones waiting" /> : (
          <ul className="divide-y divide-slate-100">
            {data.map((d: any) => (
              <li key={d.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{d.user.employee?.firstName} {d.user.employee?.lastName} <span className="font-normal text-slate-500">({d.user.employeeCode}) · {d.user.employee?.branch.name}</span></p>
                  <p className="text-sm text-slate-600">{d.model ?? 'Unknown phone'} · {d.platform ?? ''} · registered {fmtDateTime(d.registeredAt)}</p>
                </div>
                {isHr ? (
                  <div className="flex gap-2"><Button variant="secondary" onClick={() => act(d.id, 'REVOKE')}>Block</Button><Button onClick={() => act(d.id, 'APPROVE')}>Approve phone</Button></div>
                ) : <span className="text-sm text-slate-500">HR approves</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><Approvals /></Suspense>;
}
