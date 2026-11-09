import type { Metadata } from 'next';
import './globals.css';
import { COMPANY } from '@/lib/brand';

export const metadata: Metadata = { title: `${COMPANY} · HR Portal`, description: 'Attendance, leave and employee management' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
