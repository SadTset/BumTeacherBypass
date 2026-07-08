import type { Metadata } from 'next';
import './globals.css';
import { Tutorial } from '@/components/Tutorial';

export const metadata: Metadata = {
  title: 'BumTeacherBypass — Interaktive Arbeitsblätter',
  description: 'Upload PDF and Word files, convert them into organized and editable pages using AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="bg-[var(--bg)]">
        <nav className="border-b border-[var(--border)] bg-[var(--card)] sticky top-0 z-50 backdrop-blur-xl bg-opacity-80">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 text-[var(--accent)] no-underline group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-end)] flex items-center justify-center shadow-lg shadow-[var(--accent-glow)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
              <span className="font-sans text-sm font-bold tracking-wide text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">BumTeacherBypass</span>
            </a>
            <div className="flex items-center gap-1 sm:gap-2">
              <a href="/compendium" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] no-underline font-medium flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--accent-light)] transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                <span className="hidden sm:inline">Kompendium</span>
              </a>
              <a href="/docs" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] no-underline font-medium flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--accent-light)] transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span className="hidden sm:inline">Hilfe</span>
              </a>
              <a href="/settings" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] no-underline font-medium flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--accent-light)] transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                <span className="hidden sm:inline">Settings</span>
              </a>
              <a href="/?upload=1" className="text-sm bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)] text-white px-4 py-1.5 rounded-lg no-underline font-semibold hover:opacity-90 transition-all shadow-md shadow-[var(--accent-glow)]">
                Upload
              </a>
            </div>
          </div>
        </nav>
        <main>{children}</main>
        <Tutorial />
      </body>
    </html>
  );
}