// fuelify-frontend/app/dashboard/settings/page.tsx
// PHASE 2 - STUB
'use client';

import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function SettingsPage() {
  const { station, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Sidebar stationName={station?.name} />
      <main className="flex-1 p-6">
        <h1 className="mb-4 text-xl font-bold">Settings</h1>

        <div className="max-w-xl rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-8 text-center">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Settings — Additional preferences and account options coming soon.</p>
        </div>
      </main>
    </div>
  );
}
