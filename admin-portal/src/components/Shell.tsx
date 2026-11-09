'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { logout } from '@/lib/api';
import { COMPANY, COMPANY_SHORT } from '@/lib/brand';
import { label } from '@/lib/format';
import { useMe } from './AuthContext';

const I = {
  dash: 'M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10',
  clock: 'M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z',
  leave: 'M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  check: 'M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z',
  users: 'M17 20h5v-2a4 4 0 00-5-3.87M9 20H2v-2a4 4 0 015-3.87m6-4.13a4 4 0 11-8 0 4 4 0 018 0zm6 2a3 3 0 11-6 0 3 3 0 016 0z',
  doc: 'M9 12h6m-6 4h6M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z',
  pin: 'M12 11a3 3 0 100-6 3 3 0 000 6zm0 0c-4 0-7 5-7 9h14c0-4-3-9-7-9z',
  chart: 'M4 19h16M7 16V9m5 7V5m5 11v-4',
  gear: 'M10.3 4.3a1.7 1.7 0 013.4 0 1.7 1.7 0 002.6 1.1 1.7 1.7 0 012.3 2.3 1.7 1.7 0 001.1 2.6 1.7 1.7 0 010 3.4 1.7 1.7 0 00-1.1 2.6 1.7 1.7 0 01-2.3 2.3 1.7 1.7 0 00-2.6 1.1 1.7 1.7 0 01-3.4 0 1.7 1.7 0 00-2.6-1.1 1.7 1.7 0 01-2.3-2.3 1.7 1.7 0 00-1.1-2.6 1.7 1.7 0 010-3.4 1.7 1.7 0 001.1-2.6 1.7 1.7 0 012.3-2.3 1.7 1.7 0 002.6-1.1zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
};

function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}

export function Shell({ children }: { children: ReactNode }) {
  const { me, isHr } = useMe();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const nav = [
    { href: '/', label: 'Dashboard', icon: I.dash },
    { href: '/attendance', label: 'Attendance', icon: I.clock },
    { href: '/approvals', label: 'Approvals', icon: I.check },
    { href: '/leave', label: 'Leave calendar', icon: I.leave },
    { href: '/employees', label: 'Employees', icon: I.users },
    { href: '/documents', label: 'Document expiry', icon: I.doc },
    { href: '/reports', label: 'Reports', icon: I.chart },
    ...(isHr ? [{ href: '/branches', label: 'Branches & shifts', icon: I.pin }] : []),
    { href: '/settings', label: 'Settings', icon: I.gear },
  ];
  const active = (h: string) => (h === '/' ? path === '/' : path.startsWith(h));
  const name = me?.employee ? `${me.employee.firstName} ${me.employee.lastName}` : me?.email;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-xs font-bold text-white">{COMPANY_SHORT}</div>
        <div>
          <div className="text-sm font-semibold leading-tight text-slate-900">{COMPANY}</div>
          <div className="text-xs text-slate-500">HR & Attendance portal</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${active(n.href) ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            aria-current={active(n.href) ? 'page' : undefined}>
            <Icon d={n.icon} />{n.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <div className="truncate text-sm font-medium text-slate-900">{name}</div>
        <div className="truncate text-xs text-slate-500">{label(me?.role ?? '')}{me?.role === 'BRANCH_MANAGER' && me.managedBranches.length ? ` · ${me.managedBranches.map((b) => b.name).join(', ')}` : ''}</div>
        <button onClick={logout} className="mt-3 text-sm font-medium text-red-600 hover:text-red-700">Sign out</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Open menu">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="font-semibold">{COMPANY}</span>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
