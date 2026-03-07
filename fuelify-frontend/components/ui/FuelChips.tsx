//ap/components/ui/FuelChips.tsx
'use client';

import { memo } from 'react';
import type { FuelType } from '@/types';

const FUEL_OPTIONS: { key: FuelType; label: string; shortLabel: string }[] = [
  { key: 'regular', label: 'Regular', shortLabel: 'Reg' },
  { key: 'midgrade', label: 'Midgrade', shortLabel: 'Mid' },
  { key: 'premium', label: 'Premium', shortLabel: 'Prem' },
  { key: 'diesel', label: 'Diesel', shortLabel: 'Diesel' },
  { key: 'e85', label: 'E85', shortLabel: 'E85' },
];

interface FuelChipsProps {
  selected: FuelType;
  onSelect: (fuel: FuelType) => void;
  /** Optional: pass in price range per fuel type to show lowest price on each chip */
  priceRanges?: Partial<Record<FuelType, { min: number | null; max: number | null }>>;
}

export const FuelChips = memo(({ selected, onSelect, priceRanges }: FuelChipsProps) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5 px-0.5">
      {FUEL_OPTIONS.map(({ key, label, shortLabel }) => {
        const isActive = selected === key;
        const range = priceRanges?.[key];
        const hasPrice = range?.min !== null && range?.min !== undefined;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={[
              'flex-shrink-0 flex items-center gap-1.5',
              'px-3.5 py-2 rounded-full',
              'text-sm font-semibold',
              'transition-all duration-200 ease-out',
              'cursor-pointer select-none',
              'focus:outline-none active:scale-95',
              isActive
                ? 'bg-[var(--accent-primary)] text-white shadow-[0_2px_10px_rgba(99,102,241,0.35)]'
                : [
                    'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
                    'hover:text-[var(--text-primary)]',
                    'border border-transparent hover:border-[var(--border)]',
                  ].join(' '),
            ].join(' ')}
          >
            {/* Show short label on mobile, full on desktop */}
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>

            {/* Price badge */}
            {hasPrice && (
              <span
                className={[
                  'text-xs font-bold tabular-nums',
                  isActive ? 'text-white/75' : 'text-[var(--text-muted)]',
                ].join(' ')}
              >
                ${range!.min!.toFixed(2)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});

FuelChips.displayName = 'FuelChips';