'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, Clock, Fuel, Globe, MapPin, Phone } from 'lucide-react';
import type { PriceDataMap, PriceHistoryEntry, Station } from '@/types';
import {
  fetchStationBySlug,
  formatApiErrorForToast,
  getPricesByStation,
  submitPriceReport,
} from '@/services/api';
import { StatusBadge } from '@/components/ui/Badge';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { PriceCard } from '@/components/ui/PriceCard';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

const CARD_FUELS: Array<{
  key: keyof PriceDataMap;
  fallback: keyof Station['prices'];
  cardFuel: 'regular' | 'midgrade' | 'premium' | 'diesel' | 'e85';
}> = [
  { key: 'petrol', fallback: 'regular', cardFuel: 'regular' },
  { key: 'diesel', fallback: 'diesel', cardFuel: 'diesel' },
  { key: 'premium', fallback: 'premium', cardFuel: 'premium' },
  { key: 'cng', fallback: 'midgrade', cardFuel: 'midgrade' },
  { key: 'ev', fallback: 'e85', cardFuel: 'e85' },
];

const SUBMIT_FUEL_OPTIONS: Array<{ value: keyof PriceDataMap; label: string }> = [
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'premium', label: 'Premium' },
  { value: 'cng', label: 'CNG' },
  { value: 'ev', label: 'EV' },
];

export default function StationPage() {
  const params = useParams<{ state: string; slug: string }>();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const { show } = useToast();

  const [station, setStation] = useState<Station | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [priceData, setPriceData] = useState<PriceDataMap | undefined>(undefined);
  const [pageLoading, setPageLoading] = useState(true);
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitFuelType, setSubmitFuelType] = useState<keyof PriceDataMap>('petrol');
  const [submitPrice, setSubmitPrice] = useState('');
  const [submittingPrice, setSubmittingPrice] = useState(false);

  useEffect(() => {
    if (!slug) return;

    let isActive = true;
    setPageLoading(true);
    setPriceData(undefined);

    fetchStationBySlug(slug)
      .then((data) => {
        if (!isActive) return;
        setStation(data.station);
        setPriceHistory(data.priceHistory || []);
      })
      .catch(() => {
        if (!isActive) return;
        setStation(null);
        setPriceHistory([]);
      })
      .finally(() => {
        if (isActive) setPageLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!station?._id) return;

    let isActive = true;
    setPriceLoading(true);

    getPricesByStation(station._id)
      .then((data) => {
        if (!isActive) return;
        setPriceData(data.prices);
      })
      .catch((err) => {
        if (!isActive) return;
        show('Failed to load prices', 'error');
        console.error(formatApiErrorForToast(err));
      })
      .finally(() => {
        if (isActive) setPriceLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [show, station?._id]);

  const handleSubmitPrice = async () => {
    if (!station?._id) return;

    const parsedPrice = Number.parseFloat(submitPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0 || parsedPrice > 999.99) {
      show('Enter a valid price between 0.01 and 999.99', 'warning');
      return;
    }

    setSubmittingPrice(true);
    try {
      await submitPriceReport({
        stationId: station._id,
        fuelType: submitFuelType,
        price: Number(parsedPrice.toFixed(3)),
      });
      const latest = await getPricesByStation(station._id);
      setPriceData(latest.prices);
      setSubmitPrice('');
      show('Thanks! Price submitted successfully.', 'success');
    } catch (err) {
      show(formatApiErrorForToast(err), 'error');
    } finally {
      setSubmittingPrice(false);
    }
  };

  const cards = useMemo(() => {
    if (!station) return [];
    return CARD_FUELS.map(({ key, fallback, cardFuel }) => ({
      id: key,
      cardFuel,
      fallbackPrice: station.prices?.[fallback] as number | null | undefined,
      report: priceData?.[key] ?? (priceData ? null : undefined),
    }));
  }, [priceData, station]);

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!station) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] p-6 text-center text-[var(--text-secondary)]">
        <div>
          <p className="text-lg font-semibold text-[var(--text-primary)]">Station not found</p>
          <Link href="/" className="mt-3 inline-block text-sm text-[var(--accent-primary)] hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <nav className="mb-6 flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <Link href="/" className="transition-colors hover:text-[var(--accent-primary)]">
            Home
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/search?state=OH" className="transition-colors hover:text-[var(--accent-primary)]">
            Ohio
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="truncate text-[var(--text-secondary)]">{station.name}</span>
        </nav>

        <div className="mb-6 flex items-start gap-4">
          <div className="shrink-0 overflow-hidden rounded-2xl shadow-[var(--shadow-md)]">
            <BrandLogo brand={station.brand} size={72} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black leading-tight tracking-tight text-[var(--text-primary)]">{station.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
              {station.address.street}, {station.address.city}, {station.address.state} {station.address.zip}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge status={station.status} size="md" />
            </div>
          </div>
        </div>

        <section className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-info-muted)]">
                <Fuel className="h-3.5 w-3.5 text-[var(--color-info)]" />
              </span>
              <h2 className="font-bold text-[var(--text-primary)]">Current Prices</h2>
            </div>
            {station.prices?.lastUpdated ? (
              <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <Clock className="h-3 w-3" />
                {new Date(station.prices.lastUpdated).toLocaleDateString()}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-[var(--color-warning)]">
                <AlertTriangle className="h-3 w-3" />
                Not reported yet
              </span>
            )}
          </div>

          {priceLoading ? (
            <div className="flex min-h-[132px] items-center justify-center">
              <Spinner size="md" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cards.map((card) => (
                <PriceCard
                  key={card.id}
                  fuelType={card.cardFuel}
                  price={card.fallbackPrice}
                  priceData={card.report}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)]">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
              <Fuel className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </span>
            <h2 className="font-bold text-[var(--text-primary)]">Report a Price</h2>
          </div>
          <p className="mb-4 text-xs text-[var(--text-secondary)]">
            Help drivers by submitting the latest pump price for this station.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Fuel Type</span>
              <select
                value={submitFuelType}
                onChange={(event) => setSubmitFuelType(event.target.value as keyof PriceDataMap)}
                className="min-h-[52px] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              >
                {SUBMIT_FUEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="Price"
              type="number"
              min="0.01"
              max="999.99"
              step="0.001"
              prefix="$"
              placeholder="3.499"
              value={submitPrice}
              onChange={(event) => setSubmitPrice(event.target.value)}
            />

            <Button
              type="button"
              loading={submittingPrice}
              disabled={submittingPrice || submitPrice.trim().length === 0}
              onClick={handleSubmitPrice}
              className="sm:min-w-[132px]"
            >
              Submit
            </Button>
          </div>
        </section>

        <section className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)]">
          <h2 className="mb-3 font-bold text-[var(--text-primary)]">Station Info</h2>
          <div className="space-y-2.5">
            {station.phone && (
              <a
                href={`tel:${station.phone}`}
                className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-primary)]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
                  <Phone className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                </span>
                {station.phone}
              </a>
            )}
            {station.website && (
              <a
                href={station.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-violet)]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
                  <Globe className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                </span>
                {station.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {station.hours && (
              <div className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
                  <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                </span>
                {station.hours}
              </div>
            )}
          </div>
        </section>

        {priceHistory?.length > 0 && (
          <section className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-3 font-bold text-[var(--text-primary)]">Price History</h2>
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="pb-2 pr-4 font-semibold text-[var(--text-muted)]">Date</th>
                    <th className="pb-2 pr-3 font-semibold text-[var(--text-muted)]">Reg</th>
                    <th className="pb-2 pr-3 font-semibold text-[var(--text-muted)]">Mid</th>
                    <th className="pb-2 pr-3 font-semibold text-[var(--text-muted)]">Prem</th>
                    <th className="pb-2 font-semibold text-[var(--text-muted)]">Diesel</th>
                  </tr>
                </thead>
                <tbody>
                  {priceHistory.map((entry) => (
                    <tr key={entry._id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2 pr-4 text-[var(--text-muted)]">{new Date(entry.reportedAt).toLocaleDateString()}</td>
                      <td className="py-2 pr-3 font-semibold tabular-nums text-[var(--text-primary)]">
                        {entry.prices.regular ? `$${entry.prices.regular.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-2 pr-3 font-semibold tabular-nums text-[var(--text-primary)]">
                        {entry.prices.midgrade ? `$${entry.prices.midgrade.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-2 pr-3 font-semibold tabular-nums text-[var(--text-primary)]">
                        {entry.prices.premium ? `$${entry.prices.premium.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-2 font-semibold tabular-nums text-[var(--text-primary)]">
                        {entry.prices.diesel ? `$${entry.prices.diesel.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
