// fuelify-frontend/components/ui/PriceCard.tsx
import type { FuelType, PriceReport } from '@/types';
import { StalenessBadge } from '@/components/ui/StalenessBadge';

interface PriceCardProps {
  fuelType: FuelType;
  price: number | null | undefined;
  isSelected?: boolean;
  isLowest?: boolean;
  priceData?: PriceReport | null;
}

const LABELS: Record<FuelType, string> = {
  regular: 'Regular',
  midgrade: 'Midgrade',
  premium: 'Premium',
  diesel: 'Diesel',
  e85: 'E85',
};

const REPORT_LABELS: Record<PriceReport['fuelType'], string> = {
  petrol: 'Regular',
  diesel: 'Diesel',
  premium: 'Premium',
  cng: 'CNG',
  ev: 'EV Charging',
};

export const PriceCard = ({
  fuelType,
  price,
  isSelected = false,
  isLowest = false,
  priceData,
}: PriceCardProps) => {
  const hasSupplementaryData = priceData !== undefined;
  const displayedLabel = priceData ? REPORT_LABELS[priceData.fuelType] : LABELS[fuelType];
  const displayedPrice = hasSupplementaryData ? priceData?.price : price;

  return (
    <div
      className={[
        'relative min-h-[92px] rounded-xl border p-3 transition-all duration-200',
        isLowest
          ? 'border-[var(--color-success)] bg-[var(--color-success-muted)]'
          : isSelected
            ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]'
            : 'border-[var(--border)] bg-[var(--bg-card)]',
      ].join(' ')}
    >
      {isLowest && (
        <span className="absolute right-2 top-2 rounded-full bg-[var(--color-success)] px-2 py-0.5 text-[10px] font-bold text-white">
          🔥 Best
        </span>
      )}
      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{displayedLabel}</p>

      {hasSupplementaryData && (displayedPrice === null || displayedPrice === undefined) ? (
        <p className="mt-2 text-base font-semibold text-[var(--color-text-muted,var(--text-muted))]">Not reported</p>
      ) : (
        <p className="mt-2 text-2xl font-black text-[var(--text-primary)]">
          {displayedPrice ? `$${displayedPrice.toFixed(2)}` : '--'}
        </p>
      )}

      {hasSupplementaryData && (
        <div className="mt-2 space-y-1">
          <StalenessBadge reportedAt={priceData?.reportedAt || null} isStale={priceData?.isStale ?? true} />
          <p className="text-xs text-[var(--color-text-muted,var(--text-muted))]">
            {priceData?.confirmCount ?? 0} people confirmed
          </p>
        </div>
      )}
    </div>
  );
};
