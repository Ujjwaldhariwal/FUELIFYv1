// fuelify-frontend/components/ui/PriceGrid.tsx
import type { FuelType, StationPrices } from '@/types';

interface PriceGridProps {
  prices: StationPrices;
  highlightedFuel?: FuelType;
  size?: 'sm' | 'lg';
}

const LABELS: Record<FuelType, string> = {
  regular: 'Regular',
  midgrade: 'Mid',
  premium: 'Premium',
  diesel: 'Diesel',
  e85: 'E85',
};

const FUELS: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];

export const PriceGrid = ({ prices, highlightedFuel, size = 'sm' }: PriceGridProps) => (
  <div className="grid grid-cols-4 gap-1.5">
    {FUELS.map((fuel) => {
      const price = prices[fuel];
      const isHighlighted = fuel === highlightedFuel;

      return (
        <div
          key={fuel}
          className={`flex flex-col items-center rounded-lg border p-2 transition-colors ${
            isHighlighted
              ? 'border-[var(--border-strong)] bg-[var(--color-info-muted)]'
              : 'border-[var(--border)] bg-[var(--bg-elevated)]'
          }`}
        >
          <span
            className={`mb-0.5 uppercase tracking-wide text-[var(--text-muted)] ${
              size === 'lg' ? 'text-xs' : 'text-[10px]'
            }`}
          >
            {LABELS[fuel]}
          </span>
          <span
            className={`font-bold tabular-nums ${size === 'lg' ? 'text-xl' : 'text-sm'} ${
              isHighlighted ? 'text-[var(--accent-primary)]' : price ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
            }`}
          >
            {price ? `$${price.toFixed(2)}` : '-'}
          </span>
        </div>
      );
    })}
  </div>
);
