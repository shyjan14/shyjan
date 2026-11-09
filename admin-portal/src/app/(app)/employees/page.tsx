'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { label } from '@/lib/format';
import { useLoad } from '@/lib/hooks';
import { Button, Card, Empty, ErrorBox, Input, PageHeader, Select, Spinner, StatusBadge, Table } from '@/components/ui';
import { useMe } from '@/components/AuthContext';

export default function Employees() {
  const { isHr } = useMe();
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const branches = useLoad(() => api('/branches'));
  const { data, error, loading } = useLoad(
    () => api(`/employees?search=${encodeURIComponent(search)}&branchId=${branchId}&status=${status}`),
    [search, branchId, status],
  );
  return (
    <>
      <PageHeader title="Employees" subtitle={data ? `${data.length} employee${data.length === 1 ? '' : 's'}` : undefined}
        actions={isHr && <Link href="/employees/new"><Button>+ Add employee</Button></Link>} />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <Input placeholder="Search name, code, designation…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="Branch">
          <option value="">All branches</option>
          {branches.data?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="">All</option>
        </Select>
      </Card>
      <ErrorBox error={error} />
      <Card>
        {loading ? <Spinner /> : !data?.length ? <Empty title="No employees found" /> : (
          <Table head={['Employee', 'Branch', 'Department', 'Role', 'Nationality', 'Documents', 'Status']}>
            {data.map((e: any) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/employees/${e.id}`} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">{e.firstName[0]}{e.lastName[0]}</span>
                    <span>
                      <span className="block font-medium text-slate-900 hover:text-brand-700">{e.firstName} {e.lastName}</span>
                      <span className="block text-xs text-slate-500">{e.user.employeeCode} · {e.designation}</span>
                    </span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{e.branch.name}</td>
                <td className="px-4 py-3 text-slate-600">{e.department?.name ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{label(e.user.role)}</td>
                <td className="px-4 py-3 text-slate-600">{e.nationality}</td>
                <td className="px-4 py-3">{e.expiringDocs ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{e.expiringDocs} expiring</span> : <span className="text-xs text-slate-400">OK</span>}</td>
                <td className="px-4 py-3"><StatusBadge status={e.user.status} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
