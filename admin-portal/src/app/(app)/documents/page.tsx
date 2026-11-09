'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fmtDate, label } from '@/lib/format';
import { useLoad } from '@/lib/hooks';
import { Card, Empty, ErrorBox, PageHeader, Select, Spinner, Table } from '@/components/ui';

export default function DocumentExpiry() {
  const [days, setDays] = useState(90);
  const [type, setType] = useState('');
  const { data, error, loading } = useLoad(() => api(`/reports/document-expiry?days=${days}`), [days]);
  const rows = (data ?? []).filter((d: any) => !type || d.type === type);
  const expired = rows.filter((d: any) => d.daysLeft < 0).length;
  return (
    <>
      <PageHeader title="Document expiry" subtitle="Emirates ID, passport, visa, labour card and insurance renewals. Reminders go out automatically at 90, 60, 30 and 7 days." />
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="!w-48" aria-label="Window">
          {[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>Expiring within {d} days</option>)}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="!w-56" aria-label="Type">
          <option value="">All document types</option>
          {['EMIRATES_ID', 'PASSPORT', 'RESIDENCE_VISA', 'LABOUR_CARD', 'MEDICAL_INSURANCE', 'DRIVING_LICENCE'].map((t) => <option key={t} value={t}>{label(t)}</option>)}
        </Select>
        {expired > 0 && <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">{expired} already expired</span>}
      </Card>
      <ErrorBox error={error} />
      <Card>
        {loading ? <Spinner /> : !rows.length ? <Empty title="Nothing expiring in this window" text="All documents are valid ✓" /> : (
          <Table head={['Employee', 'Branch', 'Document', 'Number', 'Expiry', 'Days left']}>
            {rows.map((d: any) => (
              <tr key={d.id} className={d.daysLeft < 0 ? 'bg-red-50/50' : ''}>
                <td className="px-4 py-3"><Link href={`/employees/${d.employee.id}`} className="font-medium hover:text-brand-700">{d.employee.name}</Link><div className="text-xs text-slate-500">{d.employee.code}</div></td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{d.employee.branch}</td>
                <td className="px-4 py-3">{label(d.type)}</td>
                <td className="px-4 py-3 font-mono text-xs">{d.number ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3">{fmtDate(d.expiryDate)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${d.daysLeft < 0 ? 'bg-red-600 text-white' : d.daysLeft <= 30 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                    {d.daysLeft < 0 ? `Expired ${-d.daysLeft}d` : `${d.daysLeft} days`}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
