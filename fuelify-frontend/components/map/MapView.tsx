//app/components/map/MapView.tsx
'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FuelType, Station } from '@/types';
import { createMarkerElement, readMarkerColors } from './MarkerFactory';

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
        attribution:
          '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      },
    },
    layers: [{ id: 'carto', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 19 }],
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
        attribution:
          '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      },
    },
    layers: [{ id: 'carto', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 19 }],
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
      center: [center[1], center[0]],
      zoom: 12,
      attributionControl: false,
      fadeDuration: 0, // no tile fade — feels snappier
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    // Smooth scroll zoom
    map.scrollZoom.setWheelZoomRate(1 / 200);

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
    map.setStyle(TILE_STYLES[theme || 'dark']);
  }, [theme]);

  /* ── Fly to center (smooth) ─────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Get current zoom — don't zoom out if user is already zoomed in
    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom, 14);

    map.flyTo({
      center: [center[1], center[0]],
      zoom: targetZoom,
      speed: 1.2,        // slower = smoother
      curve: 1.42,       // smooth arc
      easing: (t) => t * (2 - t), // ease-out quad — decelerates smoothly
      essential: true,
    });
  }, [center]);

  /* ── Render markers ─────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderMarkers = () => {
      // Clear existing
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const colors = readMarkerColors();

      // Check if ANY station has a real price — if none do, use placeholders
      const anyRealPrice = stations.some(
        (s) => s.prices?.[selectedFuel] !== null && s.prices?.[selectedFuel] !== undefined
      );
      const usePlaceholder = !anyRealPrice;

      stations.forEach((station) => {
        const [lng, lat] = station.coordinates.coordinates;
        if (!lat || !lng) return;

        const isSelected = station._id === selectedStationId;
        const { element, hasPrice } = createMarkerElement(
          station,
          selectedFuel,
          isSelected,
          colors,
          usePlaceholder,
        );

        // Click → select + smooth fly
        element.addEventListener('click', (e) => {
          e.stopPropagation();
          onStationSelect(station);
        });

        const marker = new maplibregl.Marker({
          element,
          anchor: hasPrice ? 'bottom' : 'center',
        })
          .setLngLat([lng, lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
    };

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