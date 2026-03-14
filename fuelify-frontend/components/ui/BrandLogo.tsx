'use client';

import Image from 'next/image';
import { memo, Suspense, useEffect, useState } from 'react';
import type { StationBrand } from '@/types';
import { BRAND_LOGOS, FALLBACK_URL } from './brandLogos';

export function getBrandLogoUrl(brand?: string | null): string {
  if (!brand) return FALLBACK_URL;
  return BRAND_LOGOS[brand.toLowerCase()] ?? FALLBACK_URL;
}

const LogoSkeleton = ({ size }: { size: number }) => (
  <div
    className="rounded-xl skeleton-shimmer"
    style={{ width: size, height: size, minWidth: size }}
  />
);

interface BrandLogoProps {
  brand: StationBrand | string;
  size?: number;
  className?: string;
}

const BrandLogoImage = memo(({ brand, size = 44, className = '' }: BrandLogoProps) => {
  const [src, setSrc] = useState(getBrandLogoUrl(brand));

  useEffect(() => {
    setSrc(getBrandLogoUrl(brand));
  }, [brand]);

  return (
    <div
      className={`overflow-hidden rounded-xl bg-white flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size, minWidth: size, maxWidth: size }}
    >
      <Image
        src={src}
        alt={`${brand} logo`}
        width={size}
        height={size}
        className="object-contain p-1"
        style={{ width: size, height: size, maxWidth: size, maxHeight: size }}
        onError={() => setSrc(FALLBACK_URL)}
        unoptimized
      />
    </div>
  );
});

BrandLogoImage.displayName = 'BrandLogoImage';
export { FALLBACK_URL };

export const BrandLogo = ({ brand, size = 44, className = '' }: BrandLogoProps) => (
  <Suspense fallback={<LogoSkeleton size={size} />}>
    <BrandLogoImage brand={brand} size={size} className={className} />
  </Suspense>
);
