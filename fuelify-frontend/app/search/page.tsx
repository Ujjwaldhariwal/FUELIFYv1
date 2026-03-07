// fuelify-frontend/app/search/page.tsx
'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapPin, Search } from 'lucide-react';
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
    if (q) {
      setQuery(q);
      doSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-2xl px-4 py-6">

        {/* Back link */}
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-primary)]"
        >
          ← Back to Map
        </Link>

        <h1 className="mb-5 text-2xl font-black tracking-tight">Find a Station</h1>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch(query)}
            placeholder="Search by name, address, or city..."
            className={[
              'h-14 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]',
              'pl-11 pr-28 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.22)]',
              'focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[color:rgba(99,102,241,0.18)]',
              'transition-all duration-200',
            ].join(' ')}
          />
          <button
            type="button"
            onClick={() => doSearch(query)}
            className={[
              'absolute right-2 top-1/2 -translate-y-1/2',
              'h-10 rounded-xl px-4 text-sm font-bold text-white',
              'bg-gradient-to-r from-indigo-500 to-violet-600',
              'shadow-[0_2px_10px_rgba(99,102,241,0.35)]',
              'transition-all duration-200 hover:brightness-110 active:scale-95',
            ].join(' ')}
          >
            Search
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* No results */}
        {!loading && searched && results.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-2xl mb-2">🔍</p>
            <p className="font-semibold text-[var(--text-primary)]">No stations found</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">for &ldquo;{query}&rdquo;</p>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div className="space-y-2">
            <p className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">
              {results.length} station{results.length !== 1 ? 's' : ''} found
            </p>

            {results.map((station) => (
              <Link
                key={station._id}
                href={`/stations/${station.address.state.toLowerCase()}/${station.slug}`}
                className={[
                  'group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3',
                  'transition-all duration-200',
                  'hover:border-[var(--border-strong)] hover:shadow-[0_2px_14px_rgba(99,102,241,0.10)]',
                ].join(' ')}
              >
                <BrandLogo brand={station.brand} size={44} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                    {station.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {station.address.street}, {station.address.city}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <StatusBadge status={station.status} size="sm" />
                    {station.prices?.regular && (
                      <span className="text-xs font-bold text-[var(--accent-green)]">
                        ${station.prices.regular.toFixed(2)}/gal
                      </span>
                    )}
                  </div>
                </div>

                <span className="shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent-primary)]">›</span>
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
