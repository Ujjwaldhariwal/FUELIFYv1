// fuelify-frontend/app/stations/[state]/[slug]/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ChevronRight, Clock, Globe, MapPin, Phone, Fuel } from 'lucide-react';
import type { PriceHistoryEntry, Station } from '@/types';
import { fetchStationBySlug } from '@/services/api';
import { StatusBadge } from '@/components/ui/Badge';
import { PriceGrid } from '@/components/ui/PriceGrid';
import { BrandLogo } from '@/components/ui/BrandLogo';

interface PageProps {
  params: { state: string; slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { station } = await fetchStationBySlug(params.slug);
    const price = station.prices?.regular;
    const title = `${station.name} Gas Prices Today | Fuelify`;
    const description =
      station.metaDescription ||
      `${station.name} gas prices today in ${station.address.city}, ${station.address.state}.` +
        (price ? ` Regular ${price.toFixed(2)}/gal.` : ' Check current prices on Fuelify.');

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        url: `https://fuelify.com/stations/${params.state}/${params.slug}`,
        images: [
          {
            url: `/api/og?name=${encodeURIComponent(station.name)}&price=${price ?? ''}`,
            width: 1200,
            height: 630,
          },
        ],
      },
      twitter: { card: 'summary_large_image', title, description },
    };
  } catch {
    return { title: 'Gas Station | Fuelify' };
  }
}

export default async function StationPage({ params }: PageProps) {
  let station: Station;
  let priceHistory: PriceHistoryEntry[];

  try {
    const data = await fetchStationBySlug(params.slug);
    station = data.station;
    priceHistory = data.priceHistory;
  } catch {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'GasStation',
    name: station.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: station.address.street,
      addressLocality: station.address.city,
      addressRegion: station.address.state,
      postalCode: station.address.zip,
      addressCountry: station.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: station.coordinates.coordinates[1],
      longitude: station.coordinates.coordinates[0],
    },
    telephone: station.phone,
    url: station.website,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Fuel Types',
      itemListElement: [
        station.prices?.regular && {
          '@type': 'Offer',
          name: 'Regular Unleaded',
          price: station.prices.regular,
          priceCurrency: 'USD',
        },
        station.prices?.midgrade && {
          '@type': 'Offer',
          name: 'Midgrade Unleaded',
          price: station.prices.midgrade,
          priceCurrency: 'USD',
        },
        station.prices?.premium && {
          '@type': 'Offer',
          name: 'Premium Unleaded',
          price: station.prices.premium,
          priceCurrency: 'USD',
        },
        station.prices?.diesel && {
          '@type': 'Offer',
          name: 'Diesel',
          price: station.prices.diesel,
          priceCurrency: 'USD',
        },
      ].filter(Boolean),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="mx-auto max-w-2xl px-4 py-6">

          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Link href="/" className="transition-colors hover:text-[var(--accent-primary)]">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/search?state=OH" className="transition-colors hover:text-[var(--accent-primary)]">
              Ohio
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link
              href={`/search?q=${station.address.city}&state=OH`}
              className="transition-colors hover:text-[var(--accent-primary)]"
            >
              {station.address.city}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="truncate text-[var(--text-secondary)]">{station.name}</span>
          </nav>

          {/* Station header */}
          <div className="mb-6 flex items-start gap-4">
            <div className="shrink-0 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.12)] overflow-hidden">
              <BrandLogo brand={station.brand} size={72} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black leading-tight tracking-tight text-[var(--text-primary)]">
                {station.name}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                {station.address.street}, {station.address.city}, {station.address.state} {station.address.zip}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={station.status} size="md" />
              </div>
            </div>
          </div>

          {/* Current Prices */}
          <section className={[
            'mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4',
            'shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.22)]',
          ].join(' ')}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10">
                  <Fuel className="h-3.5 w-3.5 text-indigo-500" />
                </span>
                <h2 className="font-bold text-[var(--text-primary)]">Current Prices</h2>
              </div>
              {station.prices?.lastUpdated ? (
                <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <Clock className="h-3 w-3" />
                  {new Date(station.prices.lastUpdated).toLocaleDateString()}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-500">
                  <AlertTriangle className="h-3 w-3" />
                  Not reported yet
                </span>
              )}
            </div>
            <PriceGrid prices={station.prices} size="lg" />
          </section>

          {/* Station Info */}
          <section className={[
            'mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4',
            'shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.22)]',
          ].join(' ')}>
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

          {/* Price History */}
          {priceHistory?.length > 0 && (
            <section className={[
              'mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4',
              'shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.22)]',
            ].join(' ')}>
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
                        <td className="py-2 pr-4 text-[var(--text-muted)]">
                          {new Date(entry.reportedAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-3 font-semibold tabular-nums text-[var(--text-primary)]">
                          {entry.prices.regular ? `$${entry.prices.regular.toFixed(2)}` : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="py-2 pr-3 font-semibold tabular-nums text-[var(--text-primary)]">
                          {entry.prices.midgrade ? `$${entry.prices.midgrade.toFixed(2)}` : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="py-2 pr-3 font-semibold tabular-nums text-[var(--text-primary)]">
                          {entry.prices.premium ? `$${entry.prices.premium.toFixed(2)}` : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="py-2 font-semibold tabular-nums text-[var(--text-primary)]">
                          {entry.prices.diesel ? `$${entry.prices.diesel.toFixed(2)}` : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Unclaimed CTA */}
          {station.status === 'UNCLAIMED' && (
            <div className={[
              'mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 text-center',
              'shadow-[0_2px_16px_rgba(245,158,11,0.12)]',
            ].join(' ')}>
              <h3 className="mb-1 font-black text-amber-500">Own this station?</h3>
              <p className="mb-4 text-sm text-[var(--text-secondary)]">
                Claim your free page and start showing real-time prices to drivers in your area.
              </p>
              <Link
                href={`/claim?stationId=${station._id}`}
                className={[
                  'inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white',
                  'bg-gradient-to-r from-amber-500 to-orange-500',
                  'shadow-[0_2px_12px_rgba(245,158,11,0.40)]',
                  'transition-all duration-200 hover:brightness-110 active:scale-95',
                ].join(' ')}
              >
                Claim this page — it&apos;s free →
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
