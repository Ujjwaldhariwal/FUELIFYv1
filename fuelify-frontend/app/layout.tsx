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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${dmSans.variable}`}>
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
