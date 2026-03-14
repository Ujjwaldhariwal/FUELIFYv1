'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, MapPin, Search } from 'lucide-react';
import type { Station } from '@/types';
import { searchStations } from '@/services/api';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

function SearchPageContent() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [results, setResults] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async (q: string) => {
    if (q.trim().length < 2) return;
    setLoading(true);
    setSearched(true);

    try {
      const { stations } = await searchStations(q.trim(), 'OH');
      setResults(stations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = params.get('q');
    if (!q) return;
    setQuery(q);
    doSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto w-full max-w-3xl px-3 pb-8 pt-4 sm:px-4 sm:pt-6">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-sm)] transition-colors hover:text-[var(--accent-primary)] sm:text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to map
        </Link>

        <header className="mb-4">
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">Find A Station</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)] sm:text-sm">
            Search by station name, city, or street.
          </p>
        </header>

        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && doSearch(query)}
            placeholder="Search stations in Ohio"
            className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] pl-10 pr-[84px] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-[var(--shadow-sm)] transition-all duration-200 focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] sm:h-14 sm:pr-[98px]"
          />
          <button
            type="button"
            onClick={() => doSearch(query)}
            className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-xl bg-brand-gradient px-3 text-xs font-bold text-white shadow-[var(--shadow-accent)] transition-all duration-200 hover:brightness-110 active:scale-95 sm:h-10 sm:px-4 sm:text-sm"
          >
            Search
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-12 text-center shadow-[var(--shadow-sm)]">
            <p className="font-semibold text-[var(--text-primary)]">No stations found</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              for &quot;{query}&quot;
            </p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-2.5">
            <p className="px-1 text-xs font-semibold text-[var(--text-secondary)] sm:text-sm">
              {results.length} station{results.length !== 1 ? 's' : ''} found
            </p>

            {results.map((station) => (
              <Link
                key={station._id}
                href={`/stations/${station.address.state.toLowerCase()}/${station.slug}`}
                className="group flex w-full items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-2.5 shadow-[var(--shadow-sm)] transition-all duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)] sm:gap-3 sm:p-3"
              >
                <div className="shrink-0 overflow-hidden rounded-xl">
                  <BrandLogo brand={station.brand} size={42} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
                    {station.name}
                  </p>
                  <p className="mt-0.5 flex items-start gap-1 text-[11px] text-[var(--text-secondary)] sm:text-xs">
                    <MapPin className="mt-[1px] h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {station.address.street}, {station.address.city}
                    </span>
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <StatusBadge status={station.status} size="sm" />
                    {station.prices?.regular !== null && station.prices?.regular !== undefined && (
                      <span className="text-[11px] font-bold text-[var(--accent-green)] sm:text-xs">
                        ${station.prices.regular.toFixed(2)}/gal
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-primary)]" />}>
      <SearchPageContent />
    </Suspense>
  );
}
