//fuelify-frontend/app/layout.tsx

import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/theme/ThemeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Fuelify - Find the Cheapest Gas Near You',
  description:
    'Compare real-time gas prices at stations near you. Find the cheapest regular, premium, and diesel fuel in Ohio and beyond.',
  metadataBase: new URL('https://fuelify.com'),
  openGraph: { siteName: 'Fuelify', type: 'website' },
};

// ─── Blocking theme script — runs before paint, eliminates flash ─────────────
// Reads localStorage synchronously and sets the correct class on <html>
// BEFORE React hydrates. dangerouslySetInnerHTML is intentional here.
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('fuelify_theme');
    if (t === 'light') document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`;
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${dmSans.variable}`} suppressHydrationWarning>
      <head>
        {/* Blocking script — must be first in <head>, no defer/async */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased font-[family-name:var(--font-dm-sans)]">
        <ThemeProvider>
          <ErrorBoundary>
            <ToastProvider>{children}</ToastProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
