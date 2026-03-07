// fuelify-frontend/components/dashboard/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Fuel, Home, LogOut, Settings, UserRound } from 'lucide-react';
import type { StationStatus } from '@/types';
import { StatusBadge } from '@/components/ui/Badge';

const NAV = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/dashboard/prices', icon: Fuel, label: 'Prices' },
  { href: '/dashboard/profile', icon: UserRound, label: 'Profile' },
  { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  stationName?: string;
  stationStatus?: StationStatus;
}

export const Sidebar = ({ stationName, stationStatus }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem('fuelify_token');
    localStorage.removeItem('fuelify_owner');
    router.push('/login');
  };

  return (
    <aside className="hidden min-h-screen w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-surface)] lg:flex">
      {/* Logo */}
      <div className="border-b border-[var(--border)] px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_2px_10px_rgba(99,102,241,0.40)]">
            <Fuel className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-black tracking-tight text-[var(--text-primary)]">Fuelify</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all duration-200',
                active
                  ? 'bg-gradient-to-r from-indigo-500/15 to-violet-500/10 text-[var(--accent-primary)] shadow-[inset_0_0_0_1px_rgba(99,102,241,0.20)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              <Icon className={['h-4 w-4 transition-colors', active ? 'text-[var(--accent-primary)]' : ''].join(' ')} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-4 py-4">
        {stationName && (
          <p className="truncate text-xs font-semibold text-[var(--text-secondary)] mb-1.5">{stationName}</p>
        )}
        {stationStatus && (
          <div className="mb-3">
            <StatusBadge status={stationStatus} size="sm" />
          </div>
        )}
        <button
          type="button"
          onClick={logout}
          className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-[var(--text-secondary)] transition-all duration-200 hover:bg-red-500/10 hover:text-red-500 active:scale-95"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
};

export const MobileTabBar = () => {
  const pathname = usePathname();
  return (
    <nav className={[
      'fixed bottom-0 left-0 right-0 z-[900] pb-safe lg:hidden',
      'border-t border-[var(--border)] bg-[var(--bg-surface)]',
      'backdrop-blur-xl',
    ].join(' ')}>
      <div className="grid grid-cols-5 px-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold transition-all duration-200 active:scale-90"
            >
              {active ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/15">
                  <Icon className="h-4 w-4 text-[var(--accent-primary)]" />
                </span>
              ) : (
                <Icon className="h-4 w-4 text-[var(--text-muted)]" />
              )}
              <span className={active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
