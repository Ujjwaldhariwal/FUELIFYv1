//fuelify-frontend/components/map/MarkerFactory.ts
import { getBrandLogoUrl, FALLBACK_URL } from '@/components/ui/BrandLogo';
import type { FuelType, Station } from '@/types';

export interface MarkerColors {
  bg: string;
  border: string;
  text: string;
  selectedBg: string;
  selectedBorder: string;
}

export const readMarkerColors = (): MarkerColors => {
  const s = getComputedStyle(document.documentElement);
  return {
    bg: s.getPropertyValue('--marker-bg').trim(),
    border: s.getPropertyValue('--marker-border').trim(),
    text: s.getPropertyValue('--marker-text').trim(),
    selectedBg: s.getPropertyValue('--marker-selected-bg').trim(),
    selectedBorder: s.getPropertyValue('--marker-selected-border').trim(),
  };
};

export const getStationPrice = (station: Station, fuel: FuelType): number | null => {
  const p = station.prices?.[fuel];
  return p !== null && p !== undefined ? p : null;
};

// ─── Price tier → ring color ──────────────────────────────────────────────────
const getPriceTierColor = (price: number | null): { ring: string; glow: string; label: string } => {
  if (price === null) return { ring: '#94a3b8', glow: 'rgba(148,163,184,0.35)', label: '#64748b' };
  if (price < 3.00)   return { ring: '#22c55e', glow: 'rgba(34,197,94,0.35)',   label: '#16a34a' }; // green — cheap
  if (price < 3.50)   return { ring: '#f59e0b', glow: 'rgba(245,158,11,0.35)',  label: '#d97706' }; // amber — mid
  return               { ring: '#ef4444', glow: 'rgba(239,68,68,0.35)',          label: '#dc2626' }; // red — expensive
};

// ─── Size tier by count ───────────────────────────────────────────────────────
const getClusterSize = (count: number): { size: number; fontSize: number; subSize: number; ringWidth: number } => {
  if (count >= 100) return { size: 80, fontSize: 17, subSize: 10, ringWidth: 3 };
  if (count >= 50)  return { size: 68, fontSize: 15, subSize: 10, ringWidth: 3 };
  if (count >= 20)  return { size: 58, fontSize: 14, subSize: 9.5, ringWidth: 2.5 };
  if (count >= 10)  return { size: 50, fontSize: 13, subSize: 9,   ringWidth: 2.5 };
  return                   { size: 42, fontSize: 12, subSize: 8.5, ringWidth: 2 };
};

export const createMarkerElement = (
  station: Station,
  fuel: FuelType,
  isSelected: boolean,
  colors: MarkerColors,
): { element: HTMLDivElement; hasPrice: boolean } => {
  const displayPrice = getStationPrice(station, fuel);
  const hasPrice = displayPrice !== null;
  const logoUrl = getBrandLogoUrl(station.brand);

  const el = document.createElement('div');
  el.className = `fuelify-marker${isSelected ? ' fuelify-marker--selected' : ''}`;

  const bg = isSelected ? colors.selectedBg : colors.bg;
  const border = isSelected ? colors.selectedBorder : colors.border;
  const textColor = isSelected ? '#fff' : colors.text;
  const shadow = isSelected
    ? '0 3px 14px rgba(255,99,71,0.40)'
    : '0 1px 6px rgba(0,0,0,0.12)';

  if (hasPrice) {
    el.innerHTML =
      `<div style="display:flex;align-items:center;gap:4px;padding:3px 7px 3px 3px;background:${bg};border:1.5px solid ${border};border-radius:20px;white-space:nowrap;box-shadow:${shadow};">` +
      `<img src="${logoUrl}" alt="" width="20" height="20" style="width:20px;height:20px;object-fit:contain;border-radius:50%;background:#fff;padding:1px;display:block;flex-shrink:0;" onerror="this.src='${FALLBACK_URL}'" loading="lazy"/>` +
      `<span style="font-size:11.5px;font-weight:800;color:${textColor};letter-spacing:-0.03em;line-height:1;font-variant-numeric:tabular-nums;">$${displayPrice!.toFixed(2)}</span>` +
      `</div>` +
      `<div style="width:6px;height:6px;margin:-3.5px auto 0;background:${bg};border-left:1.5px solid ${border};border-bottom:1.5px solid ${border};transform:rotate(-45deg);"></div>`;
  } else {
    el.innerHTML =
      `<div style="width:28px;height:28px;border-radius:50%;background:${bg};border:1.5px solid ${border};display:flex;align-items:center;justify-content:center;box-shadow:${shadow};">` +
      `<img src="${logoUrl}" alt="" width="18" height="18" style="width:18px;height:18px;object-fit:contain;border-radius:3px;display:block;" onerror="this.src='${FALLBACK_URL}'" loading="lazy"/>` +
      `</div>`;
  }

  return { element: el, hasPrice };
};

export const createClusterMarkerElement = (
  count: number,
  minPrice: number | null,
  colors: MarkerColors,
): HTMLDivElement => {
  const el = document.createElement('div');
  el.className = 'fuelify-cluster-marker';

  const { size, fontSize, subSize, ringWidth } = getClusterSize(count);
  const { ring, glow, label } = getPriceTierColor(minPrice);

  const countLabel  = count >= 100 ? '99+' : String(count);
  const priceLabel  = minPrice !== null ? `$${minPrice.toFixed(2)}` : '—';
  const stationsLabel = count === 1 ? 'station' : 'stations';

  // inner disc is slightly smaller — ring is the gap between outer and inner
  const innerSize = size - ringWidth * 2 - 6;

  el.innerHTML = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
      cursor: pointer;
      user-select: none;
      transform: translateZ(0);
      will-change: transform;
    ">
      <!-- Glow halo -->
      <div style="
        position: absolute;
        inset: -6px;
        border-radius: 999px;
        background: ${glow};
        filter: blur(6px);
        pointer-events: none;
      "></div>

      <!-- Outer ring -->
      <div style="
        position: absolute;
        inset: 0;
        border-radius: 999px;
        border: ${ringWidth}px solid ${ring};
        background: transparent;
        box-shadow: 0 4px 16px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.12);
      "></div>

      <!-- Inner pill body -->
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${innerSize}px;
        height: ${innerSize}px;
        border-radius: 999px;
        background: ${colors.selectedBg};
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
      ">
        <!-- Count -->
        <span style="
          font-size: ${fontSize}px;
          font-weight: 900;
          color: #fff;
          line-height: 1;
          letter-spacing: -0.04em;
          font-variant-numeric: tabular-nums;
        ">${countLabel}</span>

        <!-- Price badge -->
        <span style="
          font-size: ${subSize}px;
          font-weight: 700;
          color: ${ring};
          line-height: 1;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        ">${priceLabel}</span>

        <!-- "stations" label — only on large enough bubbles -->
        ${size >= 58 ? `<span style="
          font-size: 7.5px;
          font-weight: 600;
          color: rgba(255,255,255,0.5);
          line-height: 1;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-top: 1px;
        ">${stationsLabel}</span>` : ''}
      </div>
    </div>
  `;

  return el;
};
