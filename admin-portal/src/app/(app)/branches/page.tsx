'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useLoad } from '@/lib/hooks';
import { Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Spinner } from '@/components/ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Branches() {
  const { data, error, loading, reload } = useLoad(() => api('/branches'));
  const shifts = useLoad(() => api('/shifts'));
  const [edit, setEdit] = useState<any>(null);
  const [editShift, setEditShift] = useState<any>(null);
  return (
    <>
      <PageHeader title="Branches & shifts" subtitle="Geofence location, radius and branch Wi-Fi used to verify every punch" actions={<Button onClick={() => setEdit({})}>+ Add branch</Button>} />
      <ErrorBox error={error} />
      {loading ? <Spinner /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data?.map((b: any) => (
            <Card key={b.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-brand-700">{b.code}</div>
                  <h3 className="mt-0.5 font-semibold">{b.name}</h3>
                  <p className="text-sm text-slate-500">{b.emirate}</p>
                </div>
                {!b.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">Inactive</span>}
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Employees</dt><dd className="font-medium">{b.employeeCount}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Geofence radius</dt><dd className="font-medium">{b.radiusM} m</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Wi-Fi BSSIDs</dt><dd className="font-medium">{b.wifiBssids.length || '—'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Manager</dt><dd className="truncate text-right font-medium">{b.managers.map((m: any) => m.employee ? `${m.employee.firstName} ${m.employee.lastName}` : m.employeeCode).join(', ') || '—'}</dd></div>
              </dl>
              <div className="mt-auto flex gap-2 pt-4">
                <a className="text-sm font-medium text-slate-600 hover:text-slate-900" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`}>Map ↗</a>
                <button className="ml-auto text-sm font-medium text-brand-700" onClick={() => setEdit(b)}>Edit</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-lg font-semibold">Shifts</h2>
      <Card>
        <ul className="divide-y divide-slate-100">
          {shifts.data?.map((s: any) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <div><span className="font-medium">{s.name}</span> <span className="text-slate-500">· {s.startTime}–{s.endTime} · break {s.breakMinutes}m · grace {s.graceMinutes}m · off: {s.weeklyOffDays.map((d: number) => DAYS[d]).join(', ')}</span></div>
              <div className="flex items-center gap-3"><span className="text-slate-500">{s._count.employees} staff</span><button className="font-medium text-brand-700" onClick={() => setEditShift(s)}>Edit</button></div>
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-100 px-5 py-3"><Button variant="secondary" onClick={() => setEditShift({ weeklyOffDays: [0], breakMinutes: 60, graceMinutes: 10 })}>+ Add shift</Button></div>
      </Card>
      <p className="mt-3 text-xs text-slate-500">Ramadan: create a shorter shift (e.g. 2 hours less) and assign it for the month. UAE law: max 8 hours/day, 48 hours/week.</p>

      <BranchModal b={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />
      <ShiftModal s={editShift} onClose={() => setEditShift(null)} onDone={() => { setEditShift(null); shifts.reload(); }} />
    </>
  );
}

function BranchModal({ b, onClose, onDone }: { b: any; onClose: () => void; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.currentTarget)) as Record<string, string>;
    const body = {
      code: f.code, name: f.name, emirate: f.emirate, address: f.address || undefined,
      latitude: Number(f.latitude), longitude: Number(f.longitude), radiusM: Number(f.radiusM),
      wifiBssids: f.wifiBssids.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      await api(b.id ? `/branches/${b.id}` : '/branches', { method: b.id ? 'PATCH' : 'POST', json: body });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal open={!!b} onClose={onClose} title={b?.id ? `Edit ${b.name}` : 'Add branch'}>
      <ErrorBox error={error} />
      {b && (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Code"><Input name="code" defaultValue={b.code} required /></Field>
            <div className="col-span-2"><Field label="Name"><Input name="name" defaultValue={b.name} required /></Field></div>
          </div>
          <Field label="Emirate"><Input name="emirate" defaultValue={b.emirate} required /></Field>
          <Field label="Address"><Input name="address" defaultValue={b.address ?? ''} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Latitude"><Input name="latitude" type="number" step="any" defaultValue={b.latitude} required /></Field>
            <Field label="Longitude"><Input name="longitude" type="number" step="any" defaultValue={b.longitude} required /></Field>
            <Field label="Radius (m)"><Input name="radiusM" type="number" min={20} max={2000} defaultValue={b.radiusM ?? 100} required /></Field>
          </div>
          <p className="text-xs text-slate-500">Tip: in Google Maps, long-press the branch entrance and copy the coordinates.</p>
          <Field label="Branch Wi-Fi BSSIDs (optional, comma-separated)" hint="A punch on branch Wi-Fi counts as inside the branch even if GPS drifts."><Input name="wifiBssids" defaultValue={(b.wifiBssids ?? []).join(', ')} placeholder="aa:bb:cc:dd:ee:ff" /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>
      )}
    </Modal>
  );
}

function ShiftModal({ s, onClose, onDone }: { s: any; onClose: () => void; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [off, setOff] = useState<number[]>([]);
  useEffect(() => setOff(s?.weeklyOffDays ?? []), [s]);
  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.currentTarget)) as Record<string, string>;
    const body = { name: f.name, startTime: f.startTime, endTime: f.endTime, breakMinutes: Number(f.breakMinutes), graceMinutes: Number(f.graceMinutes), weeklyOffDays: off };
    try {
      await api(s.id ? `/shifts/${s.id}` : '/shifts', { method: s.id ? 'PATCH' : 'POST', json: body });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal open={!!s} onClose={onClose} title={s?.id ? `Edit ${s.name}` : 'Add shift'}>
      <ErrorBox error={error} />
      {s && (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name"><Input name="name" defaultValue={s.name} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><Input name="startTime" type="time" defaultValue={s.startTime ?? '09:00'} required /></Field>
            <Field label="End"><Input name="endTime" type="time" defaultValue={s.endTime ?? '18:00'} required /></Field>
            <Field label="Break (min)"><Input name="breakMinutes" type="number" defaultValue={s.breakMinutes} required /></Field>
            <Field label="Late grace (min)"><Input name="graceMinutes" type="number" defaultValue={s.graceMinutes} required /></Field>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Weekly off</span>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => (
                <button type="button" key={d} onClick={() => setOff(off.includes(i) ? off.filter((x) => x !== i) : [...off, i])}
                  className={`rounded-lg px-3 py-1.5 text-sm ring-1 ring-inset ${off.includes(i) ? 'bg-brand-700 text-white ring-brand-700' : 'ring-slate-300'}`} aria-pressed={off.includes(i)}>{d}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>
      )}
    </Modal>
  );
}
