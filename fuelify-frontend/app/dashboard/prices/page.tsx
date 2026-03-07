// fuelify-frontend/app/dashboard/prices/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Clock } from 'lucide-react';
import type { PriceHistoryEntry } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { getPriceHistory, updatePrices } from '@/services/api';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';

interface PriceForm {
  regular: string;
  midgrade: string;
  premium: string;
  diesel: string;
  e85: string;
}

export default function PricesPage() {
  const { station, loading } = useAuth();
  const { show } = useToast();
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PriceForm>();

  useEffect(() => {
    if (station) {
      reset({
        regular: station.prices?.regular?.toFixed(3) ?? '',
        midgrade: station.prices?.midgrade?.toFixed(3) ?? '',
        premium: station.prices?.premium?.toFixed(3) ?? '',
        diesel: station.prices?.diesel?.toFixed(3) ?? '',
        e85: station.prices?.e85?.toFixed(3) ?? '',
      });

      getPriceHistory().then((r) => setHistory(r.history)).catch(console.error);
    }
  }, [station, reset]);

  const onSubmit = async (data: PriceForm) => {
    setSaving(true);
    try {
      const prices: Record<string, number> = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value) prices[key] = parseFloat(value);
      });

      await updatePrices(prices);
      show('Prices updated successfully!', 'success');
      const response = await getPriceHistory();
      setHistory(response.history);
    } catch (err: any) {
      show(err.response?.data?.error || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

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
        <h1 className="mb-6 text-xl font-bold">Update Prices</h1>

        <div className="mb-6 max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          {station?.prices?.lastUpdated && (
            <p className="mb-4 flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <Clock className="h-3.5 w-3.5" />
              Last updated {new Date(station.prices.lastUpdated).toLocaleString()} by{' '}
              {station.prices.updatedBy === 'OWNER' ? 'you' : 'community'}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {(['regular', 'midgrade', 'premium', 'diesel', 'e85'] as (keyof PriceForm)[]).map((fuel) => (
              <Input
                key={fuel}
                label={fuel.charAt(0).toUpperCase() + fuel.slice(1)}
                type="number"
                step="0.001"
                min="0"
                max="20"
                placeholder="0.000"
                error={errors[fuel]?.message}
                {...register(fuel, {
                  validate: (value) =>
                    !value ||
                    (parseFloat(value) > 0 && parseFloat(value) < 20) ||
                    'Must be between $0.01 and $20.00',
                })}
              />
            ))}

            <Button type="submit" fullWidth loading={saving} size="lg" className="mt-2">
              Update Prices
            </Button>
          </form>
        </div>

        {history.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <h2 className="mb-3 font-semibold text-[var(--text-primary)]">Price History (Last 30)</h2>
            <table className="min-w-[480px] w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                  {['Date', 'Time', 'Regular', 'Midgrade', 'Premium', 'Diesel', 'E85', 'By'].map((header) => (
                    <th key={header} className="pb-2 pr-4 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const date = new Date(entry.reportedAt);
                  return (
                    <tr key={entry._id} className="border-b border-[var(--border)]">
                      <td className="py-2 pr-4 text-[var(--text-secondary)]">{date.toLocaleDateString()}</td>
                      <td className="py-2 pr-4 text-[var(--text-secondary)]">
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      {(['regular', 'midgrade', 'premium', 'diesel', 'e85'] as const).map((fuel) => (
                        <td key={fuel} className="py-2 pr-4 text-[var(--text-primary)]">
                          {entry.prices[fuel] ? `$${entry.prices[fuel]!.toFixed(2)}` : '-'}
                        </td>
                      ))}
                      <td className="py-2 text-[var(--text-secondary)]">{entry.submittedBy?.name || entry.sourceType}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
