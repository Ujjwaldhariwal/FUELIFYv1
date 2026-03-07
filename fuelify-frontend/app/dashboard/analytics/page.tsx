// fuelify-frontend/app/dashboard/analytics/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Clock, Eye, Search, TrendingUp } from 'lucide-react';
import type { DashboardAnalytics } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { getAnalytics } from '@/services/api';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { StatCard } from '@/components/dashboard/StatCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AnalyticsPage() {
  const { station, loading } = useAuth();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    if (station) {
      getAnalytics().then(setAnalytics).catch(console.error).finally(() => setAnalyticsLoading(false));
    }
  }, [station]);

  if (loading || analyticsLoading) {
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
        <h1 className="mb-6 text-xl font-bold">Analytics</h1>

        <div className="mb-6 grid max-w-xl grid-cols-2 gap-3">
          <StatCard
            label="Total Views"
            value={analytics?.viewCount ?? '-'}
            subtext="All-time station page views"
            icon={<Eye className="h-4 w-4" />}
          />
          <StatCard
            label="Search Appearances"
            value={analytics?.searchAppearances ?? '-'}
            subtext="Times shown to drivers"
            icon={<Search className="h-4 w-4" />}
          />
          <StatCard
            label="Area Rank"
            value={analytics?.rankInArea ? `#${analytics.rankInArea}` : '-'}
            subtext="By regular price within 5mi"
            icon={<TrendingUp className="h-4 w-4" />}
            highlight
          />
          <StatCard
            label="Current Regular"
            value={analytics?.currentRegularPrice ? `$${analytics.currentRegularPrice.toFixed(2)}` : '-'}
            subtext="Your current regular price"
            icon={<Clock className="h-4 w-4" />}
          />
        </div>

        {/* Price charts - PHASE 2 STUB */}
        <div className="max-w-xl rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-8 text-center">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Price trend charts coming soon</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">We&apos;re building something great.</p>
        </div>
      </main>
    </div>
  );
}
