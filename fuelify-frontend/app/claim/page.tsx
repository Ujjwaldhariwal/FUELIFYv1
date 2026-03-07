// fuelify-frontend/app/claim/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Fuel, Search, Shield, Zap } from 'lucide-react';
import type { Station } from '@/types';
import { searchStations } from '@/services/api';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

function ClaimLandingPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const prefilledId = params.get('stationId');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const { stations } = await searchStations(query, 'OH');
      setResults(stations.filter((station) => station.status === 'UNCLAIMED'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prefilledId) router.push(`/dashboard/claim/${prefilledId}`);
  }, [prefilledId, router]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-2xl px-4 pb-8 pt-16 text-center">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Fuel className="h-8 w-8 text-[var(--accent-primary)]" />
          <span className="text-2xl font-bold text-[var(--text-primary)]">Fuelify</span>
        </div>

        <h1 className="mb-3 text-3xl font-extrabold leading-tight">
          Your station.
          <br />
          Your prices.
          <br />
          <span className="text-[var(--accent-primary)]">Free.</span>
        </h1>

        <p className="mb-8 text-base text-[var(--text-secondary)]">
          Thousands of drivers search for gas prices near them every day.
          <br />
          Make sure they find you first.
        </p>

        <div className="mb-10 grid grid-cols-1 gap-3 text-left">
          {[
            {
              icon: <Zap className="h-5 w-5 text-[var(--accent-primary)]" />,
              text: "Free visibility on Fuelify's driver app",
            },
            {
              icon: <CheckCircle className="h-5 w-5 text-[var(--color-success)]" />,
              text: 'Drivers find you first when you have live prices',
            },
            {
              icon: <Shield className="h-5 w-5 text-[var(--accent-primary)]" />,
              text: 'Verified badge builds driver trust',
            },
            {
              icon: <Zap className="h-5 w-5 text-[var(--color-warning)]" />,
              text: '2 minutes to set up - no credit card needed',
            },
          ].map((benefit, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3"
            >
              {benefit.icon}
              <span className="text-sm text-[var(--text-primary)]">{benefit.text}</span>
            </div>
          ))}
        </div>

        <h2 className="mb-3 text-lg font-semibold">Search for your gas station</h2>

        <div className="relative mb-2">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="e.g. 'Marathon Killbuck' or '205 W Front St'"
            className="min-h-[48px] w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] py-3.5 pl-10 pr-32 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
          <button
            type="button"
            onClick={search}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
          >
            Find Station
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-6">
            <LoadingSpinner />
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-4 space-y-2 text-left">
            {results.map((station) => (
              <button
                key={station._id}
                type="button"
                onClick={() => router.push(`/dashboard/claim/${station._id}`)}
                className="group w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3 text-left transition-all hover:border-[var(--border-strong)] hover:bg-[var(--color-info-muted)]"
              >
                <div className="flex items-center gap-3">
                  <BrandLogo brand={station.brand} size={44} />
                  <div>
                    <p className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">{station.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {station.address.street}, {station.address.city}
                    </p>
                  </div>
                  <span className="ml-auto flex-shrink-0 text-xs font-semibold text-[var(--accent-primary)]">Claim →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClaimLandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-primary)]" />}>
      <ClaimLandingPageContent />
    </Suspense>
  );
}
