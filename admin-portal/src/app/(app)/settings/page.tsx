'use client';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, label } from '@/lib/format';
import { useLoad } from '@/lib/hooks';
import { Button, Card, ErrorBox, Field, Input, PageHeader, Spinner, Table } from '@/components/ui';
import { useMe } from '@/components/AuthContext';

function Settings() {
  const { isHr, me } = useMe();
  const force = useSearchParams().get('changePassword') === '1' || me?.mustChangePwd;
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        {force && <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-600/20">Please set your own password before continuing.</div>}
        <div className="grid gap-6 lg:grid-cols-2">
          <ChangePassword />
          <Mfa />
        </div>
        {isHr && !force && <><LeavePolicy /><Holidays /><Audit /></>}
      </div>
    </>
  );
}

function ChangePassword() {
  const { reloadMe } = useMe();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setError(null);
    if (f.newPassword !== f.confirm) return setError('Passwords do not match');
    try {
      await api('/auth/change-password', { method: 'POST', json: { currentPassword: f.currentPassword, newPassword: f.newPassword } });
      setMsg('Password changed. Other sessions were signed out.');
      form.reset();
      reloadMe();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">Change password</h2>
      <ErrorBox error={error} />
      {msg && <p className="mb-3 text-sm text-green-700">{msg}</p>}
      <form onSubmit={submit} className="space-y-3">
        <Field label="Current password"><Input type="password" name="currentPassword" autoComplete="current-password" required /></Field>
        <Field label="New password" hint="Min 10 characters with upper case, lower case and a number"><Input type="password" name="newPassword" autoComplete="new-password" minLength={10} required /></Field>
        <Field label="Confirm new password"><Input type="password" name="confirm" autoComplete="new-password" required /></Field>
        <Button type="submit">Update password</Button>
      </form>
    </Card>
  );
}

function Mfa() {
  const { me, reloadMe } = useMe();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (me?.mfaEnabled) {
    return <Card className="p-5"><h2 className="font-semibold">Two-step verification</h2><p className="mt-2 text-sm text-green-700">✓ Enabled. You will be asked for a 6-digit code at every sign-in.</p></Card>;
  }
  return (
    <Card className="p-5">
      <h2 className="font-semibold">Two-step verification (recommended)</h2>
      <p className="mt-1 text-sm text-slate-500">Protects HR data even if your password leaks. Use Google Authenticator or Microsoft Authenticator.</p>
      <ErrorBox error={error} />
      {!setup ? (
        <Button className="mt-4" onClick={async () => { try { setSetup(await api('/auth/mfa/setup', { method: 'POST' })); } catch (e) { setError((e as Error).message); } }}>Set up</Button>
      ) : (
        <div className="mt-4 space-y-3 text-sm">
          <p>1. In your authenticator app choose <b>Enter a setup key</b> and type:</p>
          <p className="select-all break-all rounded-lg bg-slate-50 p-3 text-center font-mono font-semibold tracking-wider">{setup.secret.match(/.{1,4}/g)?.join(' ')}</p>
          <p>2. Enter the 6-digit code it shows:</p>
          <div className="flex gap-2">
            <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="!w-36 text-center tracking-widest" aria-label="Code" />
            <Button disabled={code.length !== 6} onClick={async () => { try { await api('/auth/mfa/enable', { method: 'POST', json: { code } }); reloadMe(); } catch (e) { setError((e as Error).message); } }}>Enable</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function LeavePolicy() {
  const { data, loading, reload } = useLoad(() => api('/leave-types/all'));
  const [error, setError] = useState<string | null>(null);
  async function patch(id: string, body: any) {
    try {
      await api(`/leave-types/${id}`, { method: 'PATCH', json: body });
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold">Leave policy</h2>
        <p className="text-sm text-slate-500">Defaults follow UAE Federal Decree-Law No. 33 of 2021. Confirm with your legal advisor; changes are audited.</p>
      </div>
      <ErrorBox error={error} />
      {loading ? <Spinner /> : (
        <Table head={['Leave type', 'Days / year', 'Counts', 'Certificate after', 'Min service', 'Active']}>
          {data?.map((t: any) => (
            <tr key={t.id}>
              <td className="px-4 py-3"><div className="font-medium">{t.name}</div><div className="max-w-md text-xs text-slate-500">{t.description}</div></td>
              <td className="px-4 py-3"><Input type="number" defaultValue={t.yearlyDays} className="!w-20" aria-label="Days" onBlur={(e) => Number(e.target.value) !== t.yearlyDays && patch(t.id, { yearlyDays: Number(e.target.value) })} /><div className="mt-1 text-[11px] text-slate-400">0 = as approved</div></td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{t.countsCalendarDays ? 'Calendar days' : 'Working days'}</td>
              <td className="px-4 py-3 text-slate-600">{t.attachmentAfterDays === null ? '—' : t.attachmentAfterDays === 0 ? 'Always' : `> ${t.attachmentAfterDays} day`}</td>
              <td className="px-4 py-3 text-slate-600">{t.minServiceMonths ? `${t.minServiceMonths} months` : '—'}</td>
              <td className="px-4 py-3"><input type="checkbox" checked={t.active} onChange={(e) => patch(t.id, { active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-700" aria-label={`${t.name} active`} /></td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

function Holidays() {
  const { data, loading, reload } = useLoad(() => api('/holidays'));
  const [error, setError] = useState<string | null>(null);
  async function add(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    try {
      await api('/holidays', { method: 'POST', json: f });
      form.reset();
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold">UAE public holidays</h2>
        <p className="text-sm text-slate-500">Islamic holidays depend on moon sighting. Update the dates when the government announces them.</p>
      </div>
      <ErrorBox error={error} />
      <form onSubmit={add} className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-5 py-4">
        <Field label="Date"><Input type="date" name="date" required /></Field>
        <div className="min-w-[14rem] flex-1"><Field label="Name"><Input name="name" required placeholder="e.g. Eid Al Fitr" /></Field></div>
        <Button type="submit">Add holiday</Button>
      </form>
      {loading ? <Spinner /> : (
        <ul className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0">
          {data?.map((h: any) => (
            <li key={h.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <span><span className="inline-block w-28 tabular-nums text-slate-500">{fmtDate(h.date)}</span>{h.name}</span>
              <button className="text-xs text-red-600 hover:text-red-700" onClick={async () => { await api(`/holidays/${h.id}`, { method: 'DELETE' }); reload(); }}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Audit() {
  const { data, loading } = useLoad(() => api('/audit-logs'));
  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold">Audit log</h2>
        <p className="text-sm text-slate-500">Every login, approval and change is recorded and cannot be edited.</p>
      </div>
      {loading ? <Spinner /> : (
        <div className="max-h-[480px] overflow-y-auto">
          <Table head={['Time', 'User', 'Action', 'Entity', 'IP']}>
            {data?.map((a: any) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtDateTime(a.createdAt)}</td>
                <td className="px-4 py-2.5">{a.actor?.employeeCode ?? 'system'}</td>
                <td className="px-4 py-2.5 font-medium">{label(a.action)}</td>
                <td className="px-4 py-2.5 text-slate-600">{a.entity}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{a.ip ?? '—'}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </Card>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><Settings /></Suspense>;
}
