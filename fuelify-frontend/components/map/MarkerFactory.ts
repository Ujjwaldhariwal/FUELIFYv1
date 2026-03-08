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
  const shadow = isSelected ? '0 3px 14px rgba(255,99,71,0.40)' : '0 1px 6px rgba(0,0,0,0.12)';

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

  const size = count >= 50 ? 52 : count >= 20 ? 46 : 40;
  const subtitle = minPrice !== null ? `$${minPrice.toFixed(2)} min` : `${count} stations`;
  const main = count >= 100 ? '99+' : String(count);

  el.innerHTML = `
    <div style="
      width:${size}px;
      height:${size}px;
      border-radius:999px;
      border:2px solid ${colors.selectedBorder};
      background:${colors.selectedBg};
      color:#fff;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      box-shadow:0 6px 20px rgba(0,0,0,0.24);
      line-height:1;
      user-select:none;
      cursor:pointer;
      transform:translateZ(0);
    ">
      <span style="font-weight:900;font-size:13px">${main}</span>
      <span style="font-weight:700;font-size:9px;opacity:0.92;margin-top:2px">${subtitle}</span>
    </div>
  `;

  return el;
};
