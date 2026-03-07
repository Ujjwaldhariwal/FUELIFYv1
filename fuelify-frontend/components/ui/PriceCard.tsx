// fuelify-frontend/components/ui/PriceCard.tsx
import type { FuelType } from '@/types';

interface PriceCardProps {
  fuelType: FuelType;
  price: number | null | undefined;
  isSelected?: boolean;
  isLowest?: boolean;
  isFeatured?: boolean;
}

const LABELS: Record<FuelType, string> = {
  regular: 'Regular',
  midgrade: 'Midgrade',
  premium: 'Premium',
  diesel: 'Diesel',
  e85: 'E85',
};

export const PriceCard = ({
  fuelType,
  price,
  isSelected = false,
  isLowest = false,
  isFeatured = false,
}: PriceCardProps) => (
  <div
    className={[
      'relative min-h-[92px] rounded-xl border p-3 transition-all duration-200',
      isLowest
        ? 'border-emerald-500 bg-emerald-500/10'
        : isSelected
          ? 'border-[var(--accent-blue)] bg-[var(--bg-elevated)]'
          : 'border-[var(--border)] bg-[var(--bg-card)]',
      isFeatured ? 'shadow-lg shadow-[color:rgb(59_130_246_/_0.2)]' : '',
    ].join(' ')}
  >
    {isLowest && (
      <span className="absolute right-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
        🔥 Best
      </span>
    )}
    <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{LABELS[fuelType]}</p>
    <p className="mt-2 text-2xl font-black text-[var(--text-primary)]">{price ? `$${price.toFixed(2)}` : '--'}</p>
  </div>
);
