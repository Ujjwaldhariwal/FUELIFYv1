'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FuelType, Station } from '@/types';
import { getBrandLogoUrl, FALLBACK_URL } from '@/components/ui/BrandLogo';

/* ── Tile styles ─────────────────────────────────────────── */
const TILE_STYLES: Record<string, maplibregl.StyleSpecification> = {
  light: {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      },
    },
    layers: [{ id: 'carto-tiles', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 19 }],
  },
  dark: {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      },
    },
    layers: [{ id: 'carto-tiles', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 19 }],
  },
};

/* ── Props ────────────────────────────────────────────────── */
interface MapViewProps {
  stations: Station[];
  selectedFuel: FuelType;
  center: [number, number]; // [lat, lng]
  onStationSelect: (station: Station) => void;
  selectedStationId?: string;
  theme?: 'light' | 'dark';
}

/* ── Helpers ──────────────────────────────────────────────── */
const getPrice = (station: Station, fuel: FuelType): string => {
  const p = station.prices?.[fuel];
  return p !== null && p !== undefined ? `$${p.toFixed(2)}` : '—';
};

const createMarkerElement = (
  station: Station,
  fuel: FuelType,
  isSelected: boolean,
  colors: { bg: string; border: string; text: string; selectedBg: string; selectedBorder: string }
): HTMLDivElement => {
  const el = document.createElement('div');
  el.className = `fuelify-marker${isSelected ? ' fuelify-marker--selected' : ''}`;

  const logoUrl = getBrandLogoUrl(station.brand);
  const price = getPrice(station, fuel);
  const bg = isSelected ? colors.selectedBg : colors.bg;
  const border = isSelected ? colors.selectedBorder : colors.border;
  const textColor = isSelected ? '#FFFFFF' : colors.text;
  const priceColor = price === '—' ? 'rgba(150,150,150,0.5)' : textColor;

  el.innerHTML = `
    <div class="fuelify-marker__body" style="
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px 4px 4px;
      background: ${bg};
      border: 2px solid ${border};
      border-radius: 12px;
      white-space: nowrap;
    ">
      <img
        src="${logoUrl}"
        alt="${station.brand}"
        width="24"
        height="24"
        style="
          width: 24px;
          height: 24px;
          object-fit: contain;
          border-radius: 6px;
          background: #fff;
          padding: 2px;
          display: block;
          flex-shrink: 0;
        "
        onerror="this.src='${FALLBACK_URL}'"
      />
      <span style="
        font-size: 13px;
        font-weight: 700;
        color: ${priceColor};
        letter-spacing: -0.01em;
        line-height: 1;
      ">${price}</span>
    </div>
    <div class="fuelify-marker__arrow" style="
      width: 8px;
      height: 8px;
      background: ${bg};
      border-left: 2px solid ${border};
      border-bottom: 2px solid ${border};
      transform: rotate(-45deg);
      margin: -5px auto 0;
    "></div>
  `;

  return el;
};

/* ── Component ────────────────────────────────────────────── */
export const MapView = ({
  stations,
  selectedFuel,
  center,
  onStationSelect,
  selectedStationId,
  theme,
}: MapViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const initRef = useRef(false);

  /* ── Init map ───────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || initRef.current) return;
    initRef.current = true;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_STYLES[theme || 'dark'],
      center: [center[1], center[0]], // MapLibre is [lng, lat]
      zoom: 12,
      attributionControl: false,
    });

    // Add minimal attribution (bottom-right, compact)
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    // Custom navigation control (zoom only, no compass)
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      initRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Theme switch ───────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const style = TILE_STYLES[theme || 'dark'];

    // setStyle removes everything, so we re-render markers after it loads
    map.setStyle(style);
  }, [theme]);

  /* ── Fly to center ──────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.flyTo({
      center: [center[1], center[0]],
      zoom: 14,
      duration: 800,
      essential: true,
    });
  }, [center]);

  /* ── Render markers ─────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderMarkers = () => {
      // Clear old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Read theme-aware colors from CSS variables
      const styles = getComputedStyle(document.documentElement);
      const colors = {
        bg: styles.getPropertyValue('--marker-bg').trim(),
        border: styles.getPropertyValue('--marker-border').trim(),
        text: styles.getPropertyValue('--marker-text').trim(),
        selectedBg: styles.getPropertyValue('--marker-selected-bg').trim(),
        selectedBorder: styles.getPropertyValue('--marker-selected-border').trim(),
      };

      stations.forEach((station) => {
        const [lng, lat] = station.coordinates.coordinates;
        if (!lat || !lng) return;

        const isSelected = station._id === selectedStationId;

        const el = createMarkerElement(station, selectedFuel, isSelected, colors);

        // Click handler
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onStationSelect(station);
        });

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([lng, lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
    };

    // If map style is loaded, render immediately; otherwise wait for 'styledata' event
    if (map.isStyleLoaded()) {
      renderMarkers();
    } else {
      map.once('styledata', renderMarkers);
    }
  }, [stations, selectedFuel, selectedStationId, onStationSelect, theme]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: 'var(--bg-primary)' }}
    />
  );
};

export default MapView;