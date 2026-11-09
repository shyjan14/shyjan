'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmployeeForm } from '@/components/EmployeeForm';
import { Button, Modal, PageHeader } from '@/components/ui';

export default function NewEmployee() {
  const router = useRouter();
  const [created, setCreated] = useState<any>(null);
  return (
    <>
      <PageHeader title="Add employee" subtitle="A temporary password is generated. The employee must change it at first login." />
      <EmployeeForm onSaved={setCreated} />
      <Modal open={!!created} onClose={() => router.push(`/employees/${created.id}`)} title="Employee created">
        <p className="text-sm text-slate-600">Share these login details with the employee securely (in person or by SMS). The password is shown only once.</p>
        <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-4 text-sm">
          <dt className="text-slate-500">Login</dt><dd className="col-span-2 font-mono font-semibold">{created?.employeeCode}</dd>
          <dt className="text-slate-500">Password</dt><dd className="col-span-2 select-all font-mono font-semibold">{created?.temporaryPassword}</dd>
        </dl>
        <div className="mt-5 flex justify-end"><Button onClick={() => router.push(`/employees/${created.id}`)}>Open profile</Button></div>
      </Modal>
    </>
  );
}
