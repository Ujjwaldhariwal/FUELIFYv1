'use client';

import { memo } from 'react';
import { MapPin, Clock, ChevronRight } from 'lucide-react';
import type { FuelType, Station } from '@/types';
import { BrandLogo } from './BrandLogo';

interface StationListCardProps {
  station: Station;
  distance?: number;
  selectedFuel: FuelType;
  onClick: () => void;
  isActive?: boolean;
}

const FUEL_LABEL: Record<FuelType, string> = {
  regular: 'Reg',
  midgrade: 'Mid',
  premium: 'Prem',
  diesel: 'Diesel',
  e85: 'E85',
};

const ALL_FUELS: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel', 'e85'];

const formatAddress = (station: Station): string => {
  const parts = [station.address?.street, station.address?.city, station.address?.state]
    .map((value) => (value ? value.trim() : ''))
    .filter(Boolean);
  if (parts.length === 0) return 'Address unavailable';
  return parts.join(', ');
};

const getTimeSince = (date?: string | Date): string | null => {
  if (!date) return null;
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return null;
};

const getFreshnessColor = (date?: string | Date): string => {
  if (!date) return 'text-[var(--text-muted)]';
  const hrs = (Date.now() - new Date(date).getTime()) / 3600000;
  if (hrs < 1) return 'text-[var(--color-success)]';
  if (hrs < 6) return 'text-[var(--color-warning)]';
  return 'text-[var(--text-muted)]';
};

export const StationListCard = memo(
  ({ station, distance, selectedFuel, onClick, isActive }: StationListCardProps) => {
    const price = station.prices?.[selectedFuel];
    const hasPrice = price !== null && price !== undefined;
    const lastUpdated = station.prices?.lastUpdated ?? undefined;
    const timeSince = getTimeSince(lastUpdated);
    const freshnessColor = getFreshnessColor(lastUpdated);
    const addressText = formatAddress(station);

    const secondaryFuels = ALL_FUELS.filter((f) => f !== selectedFuel).map((f) => {
      const p = station.prices?.[f];
      return {
        key: f,
        label: FUEL_LABEL[f],
        price: p !== null && p !== undefined ? `$${p.toFixed(2)}` : '-',
        hasPrice: p !== null && p !== undefined,
      };
    });

    const hasAnySecondary = secondaryFuels.some((f) => f.hasPrice);

    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          'group w-full flex flex-col rounded-2xl border p-3 text-left',
          'transition-all duration-200',
          'active:scale-[0.985]',
          isActive
            ? 'bg-[var(--color-info-muted)] border-[var(--accent-primary)] shadow-[0_0_0_1px_var(--accent-primary)]'
            : [
                'bg-[var(--bg-card)] border-[var(--border)]',
                'hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]',
              ].join(' '),
        ].join(' ')}
      >
        <div className="flex items-center gap-3 w-full">
          <div className="shrink-0">
            <BrandLogo brand={station.brand} size={40} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors leading-snug">
              {station.name}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <MapPin className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
              <span className="truncate">{addressText}</span>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <div className="text-right">
              {hasPrice ? (
                <>
                  <p className="text-lg font-black tabular-nums leading-tight text-[var(--color-success)]">
                    ${price!.toFixed(2)}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-muted)] leading-tight mt-0.5">
                    {FUEL_LABEL[selectedFuel]}/gal
                  </p>
                </>
              ) : (
                <p className="text-xs font-semibold text-[var(--text-muted)]">No price</p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-2.5 text-[11px]">
            {distance !== undefined && (
              <span className="font-semibold text-[var(--text-secondary)] tabular-nums">
                {distance.toFixed(1)} mi
              </span>
            )}
            {timeSince && (
              <span className={`flex items-center gap-0.5 ${freshnessColor}`}>
                <Clock className="h-2.5 w-2.5" />
                {timeSince}
              </span>
            )}
          </div>

          {hasAnySecondary && (
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
              {secondaryFuels.map((f) => (
                <span key={f.key} className="tabular-nums">
                  <span className="font-medium">{f.label}</span>{' '}
                  <span className={f.hasPrice ? 'text-[var(--text-secondary)]' : ''}>{f.price}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </button>
    );
  }
);

StationListCard.displayName = 'StationListCard';
