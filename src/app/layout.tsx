import type { Metadata } from 'next';
import './globals.css';
import { Tutorial } from '@/components/Tutorial';
import { AppNav } from '@/components/AppNav';

export const metadata: Metadata = {
  title: 'BumTeacherBypass — Interaktive Arbeitsblätter',
  description: 'PDF- und Word-Dateien mit KI in organisierte, interaktive Arbeitsblätter umwandeln',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="bg-[var(--bg)]">
        <AppNav />
        <main className="min-h-screen pb-24 pt-20 md:pb-10 md:pt-24">{children}</main>
        <Tutorial />
      </body>
    </html>
  );
}
