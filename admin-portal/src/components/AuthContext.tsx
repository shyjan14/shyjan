'use client';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, hasSession } from '@/lib/api';

export type Me = {
  id: string; employeeCode: string; email: string; role: 'EMPLOYEE' | 'BRANCH_MANAGER' | 'HR_ADMIN' | 'SUPER_ADMIN'; mfaEnabled: boolean; mustChangePwd: boolean;
  managedBranches: { id: string; name: string }[];
  employee: { id: string; firstName: string; lastName: string; designation: string; branch: { id: string; name: string } } | null;
};

const Ctx = createContext<{ me: Me | null; isHr: boolean; reloadMe: () => void }>({ me: null, isHr: false, reloadMe: () => {} });
export const useMe = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const router = useRouter();
  const path = usePathname();
  const load = () => api<Me>('/auth/me').then(setMe).catch(() => router.replace('/login'));
  useEffect(() => {
    if (!hasSession()) {
      router.replace('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (me?.mustChangePwd && path !== '/settings') router.replace('/settings?changePassword=1');
  }, [me, path, router]);
  if (!me) {
    return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-700" /></div>;
  }
  if (me.role === 'EMPLOYEE') {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold">This portal is for HR and managers</p>
          <p className="mt-2 text-slate-500">Please use the mobile app for your attendance and leave.</p>
        </div>
      </div>
    );
  }
  return <Ctx.Provider value={{ me, isHr: me.role === 'HR_ADMIN' || me.role === 'SUPER_ADMIN', reloadMe: load }}>{children}</Ctx.Provider>;
}
