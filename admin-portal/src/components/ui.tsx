'use client';
import { ReactNode, useEffect } from 'react';
import { label } from '@/lib/format';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-card ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const STATUS: Record<string, string> = {
  PRESENT: 'bg-green-50 text-green-700 ring-green-600/20',
  APPROVED: 'bg-green-50 text-green-700 ring-green-600/20',
  ACTIVE: 'bg-green-50 text-green-700 ring-green-600/20',
  LATE: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PENDING_MANAGER: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PENDING_HR: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  HALF_DAY: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  MISSED_PUNCH: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  ABSENT: 'bg-red-50 text-red-700 ring-red-600/20',
  REJECTED: 'bg-red-50 text-red-700 ring-red-600/20',
  REVOKED: 'bg-red-50 text-red-700 ring-red-600/20',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  NOT_IN: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  ON_LEAVE: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  ON_BREAK: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  HOLIDAY: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  WEEKLY_OFF: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};
const STATUS_TEXT: Record<string, string> = { NOT_IN: 'Not in', PENDING_MANAGER: 'Pending manager', PENDING_HR: 'Pending HR' };

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS[status] ?? 'bg-slate-100 text-slate-700 ring-slate-500/20'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {STATUS_TEXT[status] ?? label(status)}
    </span>
  );
}

export function Button({ children, variant = 'primary', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const v = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 focus-visible:outline-brand-700',
    secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }[variant];
  return (
    <button {...p} className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`}>
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputCls = 'block h-9 w-full rounded-lg border-0 px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600';

export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`${inputCls} ${p.className ?? ''}`} />;
}
export function Select(p: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={`${inputCls} pr-8 ${p.className ?? ''}`} />;
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16" role="status" aria-label="Loading">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-brand-700" />
    </div>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="py-14 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
    </div>
  );
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20" role="alert">{error}</div>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            {head.map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Stat({ label, value, tone = 'slate', hint }: { label: string; value: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'blue' | 'violet' | 'red'; hint?: string }) {
  const dot = { slate: 'bg-slate-400', green: 'bg-green-600', amber: 'bg-amber-500', blue: 'bg-blue-600', violet: 'bg-violet-600', red: 'bg-red-600' }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500"><span className={`h-2 w-2 rounded-full ${dot}`} />{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </Card>
  );
}
