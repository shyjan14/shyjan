'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setSession } from '@/lib/api';
import { COMPANY, COMPANY_SHORT } from '@/lib/brand';
import { Button, ErrorBox, Field, Input } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = mfaToken
        ? await api('/auth/mfa/verify', { method: 'POST', json: { mfaToken, code } })
        : await api('/auth/login', { method: 'POST', json: { login, password } });
      if (res.mfaRequired) {
        setMfaToken(res.mfaToken);
        return;
      }
      setSession({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      router.replace('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-800 lg:block">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-600/40" />
        <div className="absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-brand-900/50" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-sm font-bold">{COMPANY_SHORT}</div>
            <span className="text-lg font-semibold">{COMPANY}</span>
          </div>
          <div>
            <h2 className="max-w-md text-4xl font-semibold leading-tight">Every branch, every shift, in one place.</h2>
            <p className="mt-4 max-w-md text-brand-100">Live attendance across all branches, leave approvals that follow UAE Labour Law, and document expiry alerts before they become fines.</p>
          </div>
          <p className="text-sm text-brand-100/80">Secured with role-based access, MFA and full audit trail.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{mfaToken ? 'Two-step verification' : `Sign in to ${COMPANY}`}</h1>
            <p className="mt-1 text-sm text-slate-500">{mfaToken ? 'Enter the 6-digit code from your authenticator app.' : 'HR and managers sign in with username / employee code or email.'}</p>
          </div>
          <ErrorBox error={error} />
          {!mfaToken ? (
            <>
              <Field label="Username, employee code or email">
                <Input autoFocus autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required placeholder="admin, EMP001 or name@company.ae" />
              </Field>
              <Field label="Password">
                <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </Field>
            </>
          ) : (
            <Field label="Authentication code">
              <Input autoFocus inputMode="numeric" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required className="text-center text-lg tracking-[0.5em]" />
            </Field>
          )}
          <Button type="submit" disabled={busy} className="h-10 w-full">{busy ? 'Please wait…' : mfaToken ? 'Verify' : 'Sign in'}</Button>
          <p className="text-center text-xs text-slate-500">Account locks for 15 minutes after 5 failed attempts.</p>
        </form>
      </div>
    </div>
  );
}
