import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Attendance & HR Portal', description: 'Attendance, leave and employee management' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
