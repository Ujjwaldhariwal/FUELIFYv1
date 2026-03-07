// components/ui/BrandLogo.tsx
import { memo, Suspense, lazy } from 'react';
import type { StationBrand } from '@/types';
import { BRAND_LOGOS, FALLBACK_URL } from './brandLogos';

export function getBrandLogoUrl(brand?: string | null): string {
  if (!brand) return FALLBACK_URL;
  return BRAND_LOGOS[brand.toLowerCase()] ?? FALLBACK_URL;
}

// ── Skeleton shown while image loads ──────────────────────
const LogoSkeleton = ({ size }: { size: number }) => (
  <div
    className="rounded-xl skeleton-shimmer"
    style={{ width: size, height: size, minWidth: size }}
  />
);

// ── Core image component ───────────────────────────────────
interface BrandLogoProps {
  brand: StationBrand | string;
  size?: number;
  className?: string;
}

const BrandLogoImage = memo(({ brand, size = 44, className = '' }: BrandLogoProps) => (
  <div
    className={`overflow-hidden rounded-xl bg-white flex items-center justify-center shrink-0 ${className}`}
    style={{ width: size, height: size, minWidth: size, maxWidth: size }}
  >
    <img
      src={getBrandLogoUrl(brand)}
      alt={brand}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{
        width: size,        // ✅ fixed px — not 100%
        height: size,       // ✅ fixed px — not 100%
        maxWidth: size,
        maxHeight: size,
        objectFit: 'contain',
        padding: '4px',
        display: 'block',
      }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = FALLBACK_URL;
      }}
    />
  </div>
));


BrandLogoImage.displayName = 'BrandLogoImage';
export { FALLBACK_URL };

// ── Public export with Suspense boundary ──────────────────
export const BrandLogo = ({ brand, size = 44, className = '' }: BrandLogoProps) => (
  <Suspense fallback={<LogoSkeleton size={size} />}>
    <BrandLogoImage brand={brand} size={size} className={className} />
  </Suspense>
);
