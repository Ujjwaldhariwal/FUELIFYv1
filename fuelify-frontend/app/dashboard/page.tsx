// fuelify-frontend/app/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Clock3, Eye, Fuel, Trophy } from 'lucide-react';
import type { DashboardAnalytics } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { getAnalytics, updatePrices } from '@/services/api';
import { Sidebar, MobileTabBar } from '@/components/dashboard/Sidebar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

interface PriceForm {
  regular: string;
  midgrade: string;
  premium: string;
  diesel: string;
}

export default function DashboardHomePage() {
  const { station, loading } = useAuth();
  const { show } = useToast();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PriceForm>();

  useEffect(() => {
    if (!station) return;
    reset({
      regular: station.prices?.regular?.toFixed(3) ?? '',
      midgrade: station.prices?.midgrade?.toFixed(3) ?? '',
      premium: station.prices?.premium?.toFixed(3) ?? '',
      diesel: station.prices?.diesel?.toFixed(3) ?? '',
    });
    getAnalytics().then(setAnalytics).catch(console.error);
  }, [reset, station]);

  const statCards = useMemo(
    () => [
      {
        label: 'Regular Price',
        value: station?.prices?.regular ? `$${station.prices.regular.toFixed(2)}` : '--',
        icon: <Fuel className="h-4 w-4" />,
        color: 'text-indigo-500 dark:text-indigo-400',
        bg: 'bg-indigo-500/10',
      },
      {
        label: 'Page Views',
        value: analytics?.viewCount?.toString() || '--',
        icon: <Eye className="h-4 w-4" />,
        color: 'text-emerald-500 dark:text-emerald-400',
        bg: 'bg-emerald-500/10',
      },
      {
        label: 'Last Updated',
        value: station?.prices?.lastUpdated ? new Date(station.prices.lastUpdated).toLocaleDateString() : '--',
        icon: <Clock3 className="h-4 w-4" />,
        color: 'text-amber-500 dark:text-amber-400',
        bg: 'bg-amber-500/10',
      },
      {
        label: 'Area Rank',
        value: analytics?.rankInArea ? `#${analytics.rankInArea}` : '--',
        icon: <Trophy className="h-4 w-4" />,
        color: 'text-violet-500 dark:text-violet-400',
        bg: 'bg-violet-500/10',
      },
    ],
    [analytics?.rankInArea, analytics?.viewCount, station?.prices?.lastUpdated, station?.prices?.regular]
  );

  const onSubmit = async (values: PriceForm) => {
    setSaving(true);
    try {
      const payload: Partial<Record<keyof PriceForm, number>> = {};
      (Object.keys(values) as (keyof PriceForm)[]).forEach((key) => {
        if (!values[key]) return;
        payload[key] = Number.parseFloat(values[key]);
      });
      await updatePrices(payload);
      setLastSavedAt(new Date());
      show("Prices updated. Drivers can see today's rates.", 'success');
      const refreshed = await getAnalytics();
      setAnalytics(refreshed);
    } catch (error: any) {
      show(error.response?.data?.error || 'Price update failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="fade-in-up flex min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Sidebar stationName={station?.name} stationStatus={station?.status} />

      <main className="flex-1 p-4 pb-nav md:p-6 lg:pb-8">
        {/* Page header */}
        <header className="mb-6">
          <p className="text-2xl font-black tracking-tight">Overview</p>
          {station && (
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              {station.name} &middot; {station.address.city}, {station.address.state}
            </p>
          )}
        </header>

        {/* Stat cards */}
        <section className="mb-6">
          <div className="hide-scrollbar grid grid-cols-2 gap-3 sm:grid-cols-4 overflow-x-auto">
            {statCards.map((card) => (
              <Card key={card.label} className="min-w-[150px]">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{card.label}</p>
                  <span className={['flex h-7 w-7 items-center justify-center rounded-lg', card.bg, card.color].join(' ')}>
                    {card.icon}
                  </span>
                </div>
                <p className="mt-3 text-2xl font-black tabular-nums">{card.value}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Price update form */}
        <section>
          <Card className="max-w-2xl" padding="lg">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-lg font-black">Update Today&apos;s Prices</p>
                <p className="mt-0.5 text-sm text-[var(--text-secondary)]">Drivers see these instantly on the map.</p>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
                <Fuel className="h-4 w-4 text-white" />
              </span>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Regular"
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  prefix="$"
                  error={errors.regular?.message}
                  {...register('regular', {
                    validate: (value) =>
                      !value || (Number.parseFloat(value) > 0 && Number.parseFloat(value) < 20) || '$0.01–$20',
                  })}
                />
                <Input
                  label="Midgrade"
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  prefix="$"
                  error={errors.midgrade?.message}
                  {...register('midgrade', {
                    validate: (value) =>
                      !value || (Number.parseFloat(value) > 0 && Number.parseFloat(value) < 20) || '$0.01–$20',
                  })}
                />
                <Input
                  label="Premium"
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  prefix="$"
                  error={errors.premium?.message}
                  {...register('premium', {
                    validate: (value) =>
                      !value || (Number.parseFloat(value) > 0 && Number.parseFloat(value) < 20) || '$0.01–$20',
                  })}
                />
                <Input
                  label="Diesel"
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  prefix="$"
                  error={errors.diesel?.message}
                  {...register('diesel', {
                    validate: (value) =>
                      !value || (Number.parseFloat(value) > 0 && Number.parseFloat(value) < 20) || '$0.01–$20',
                  })}
                />
              </div>

              <Button type="submit" loading={saving} size="lg" fullWidth>
                Publish Prices
              </Button>
            </form>

            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Last saved: {lastSavedAt ? 'just now' : station?.prices?.lastUpdated ? new Date(station.prices.lastUpdated).toLocaleString() : 'never'}
            </p>
          </Card>
        </section>
      </main>

      <MobileTabBar />
    </div>
  );
}
