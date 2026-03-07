
// fuelify-frontend/components/map/MarkerFactory.ts

import { getBrandLogoUrl, FALLBACK_URL } from '@/components/ui/BrandLogo';
import type { FuelType, Station } from '@/types';

/* ── Types ────────────────────────────────────────────────── */
export interface MarkerColors {
  bg: string;
  border: string;
  text: string;
  selectedBg: string;
  selectedBorder: string;
}

/* ── Read CSS tokens ──────────────────────────────────────── */
export const readMarkerColors = (): MarkerColors => {
  const s = getComputedStyle(document.documentElement);
  return {
    bg:             s.getPropertyValue('--marker-bg').trim(),
    border:         s.getPropertyValue('--marker-border').trim(),
    text:           s.getPropertyValue('--marker-text').trim(),
    selectedBg:     s.getPropertyValue('--marker-selected-bg').trim(),
    selectedBorder: s.getPropertyValue('--marker-selected-border').trim(),
  };
};

/* ── Get price for a station ──────────────────────────────── */
export const getStationPrice = (station: Station, fuel: FuelType): number | null => {
  const p = station.prices?.[fuel];
  return p !== null && p !== undefined ? p : null;
};

/* ── Placeholder price for demo (seeded by station id for consistency) ── */
const getPlaceholderPrice = (stationId: string): number => {
  // Simple hash from station ID to get a consistent "random" price
  let hash = 0;
  for (let i = 0; i < stationId.length; i++) {
    hash = ((hash << 5) - hash + stationId.charCodeAt(i)) | 0;
  }
  // Range: $2.79 — $3.99
  const base = 2.79;
  const range = 1.20;
  const normalized = Math.abs(hash % 1000) / 1000;
  return Math.round((base + normalized * range) * 100) / 100;
};

/* ── Create marker DOM element ────────────────────────────── */
export const createMarkerElement = (
  station: Station,
  fuel: FuelType,
  isSelected: boolean,
  colors: MarkerColors,
  usePlaceholder: boolean = false,
): { element: HTMLDivElement; hasPrice: boolean } => {
  const realPrice = getStationPrice(station, fuel);
  const displayPrice = realPrice ?? (usePlaceholder ? getPlaceholderPrice(station._id) : null);
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
    /* ── PILL: logo + price + pointer ── */
    el.innerHTML =
      `<div style="display:flex;align-items:center;gap:4px;padding:3px 7px 3px 3px;background:${bg};border:1.5px solid ${border};border-radius:20px;white-space:nowrap;box-shadow:${shadow};">` +
        `<img src="${logoUrl}" alt="" width="20" height="20" style="width:20px;height:20px;object-fit:contain;border-radius:50%;background:#fff;padding:1px;display:block;flex-shrink:0;" onerror="this.src='${FALLBACK_URL}'" loading="lazy"/>` +
        `<span style="font-size:11.5px;font-weight:800;color:${textColor};letter-spacing:-0.03em;line-height:1;font-variant-numeric:tabular-nums;">$${displayPrice!.toFixed(2)}</span>` +
      `</div>` +
      `<div style="width:6px;height:6px;margin:-3.5px auto 0;background:${bg};border-left:1.5px solid ${border};border-bottom:1.5px solid ${border};transform:rotate(-45deg);"></div>`;
  } else {
    /* ── DOT: logo only ── */
    el.innerHTML =
      `<div style="width:28px;height:28px;border-radius:50%;background:${bg};border:1.5px solid ${border};display:flex;align-items:center;justify-content:center;box-shadow:${shadow};">` +
        `<img src="${logoUrl}" alt="" width="18" height="18" style="width:18px;height:18px;object-fit:contain;border-radius:3px;display:block;" onerror="this.src='${FALLBACK_URL}'" loading="lazy"/>` +
      `</div>`;
  }

  return { element: el, hasPrice };
};