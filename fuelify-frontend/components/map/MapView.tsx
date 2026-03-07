'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FuelType, Station } from '@/types';
import {
  createClusterMarkerElement,
  createMarkerElement,
  getStationPrice,
  readMarkerColors,
} from './MarkerFactory';

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

export interface MapViewportInfo {
  center: [number, number];
  zoom: number;
  bounds: { west: number; south: number; east: number; north: number };
}

interface MapViewProps {
  stations: Station[];
  selectedFuel: FuelType;
  center: [number, number];
  onStationSelect: (station: Station) => void;
  selectedStationId?: string;
  theme?: 'light' | 'dark';
  initialZoom?: number;
  onViewportChange?: (viewport: MapViewportInfo) => void;
  onMapInteraction?: () => void;
}

type DisplayPoint =
  | { kind: 'station'; station: Station; lat: number; lng: number }
  | { kind: 'cluster'; lat: number; lng: number; count: number; minPrice: number | null };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getClusterStepDegrees = (zoom: number) => {
  if (zoom >= 11) return 0;
  if (zoom >= 10) return 0.08;
  if (zoom >= 9) return 0.16;
  if (zoom >= 8) return 0.35;
  return 0.7;
};

const buildDisplayPoints = (stations: Station[], selectedFuel: FuelType, zoom: number): DisplayPoint[] => {
  const step = getClusterStepDegrees(zoom);
  if (step === 0) {
    return stations
      .map((station) => {
        const [lng, lat] = station.coordinates.coordinates;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { kind: 'station', station, lat, lng } as DisplayPoint;
      })
      .filter((item): item is DisplayPoint => item !== null);
  }

  const buckets = new Map<
    string,
    {
      count: number;
      latSum: number;
      lngSum: number;
      minPrice: number | null;
      station: Station | null;
    }
  >();

  for (const station of stations) {
    const [lng, lat] = station.coordinates.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const latBucket = Math.floor(lat / step);
    const lngBucket = Math.floor(lng / step);
    const key = `${latBucket}:${lngBucket}`;
    const price = getStationPrice(station, selectedFuel);

    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        count: 1,
        latSum: lat,
        lngSum: lng,
        minPrice: price,
        station,
      });
      continue;
    }

    existing.count += 1;
    existing.latSum += lat;
    existing.lngSum += lng;
    existing.minPrice = existing.minPrice === null ? price : price === null ? existing.minPrice : Math.min(existing.minPrice, price);
    existing.station = existing.station || station;
  }

  const points: DisplayPoint[] = [];
  for (const bucket of buckets.values()) {
    const lat = bucket.latSum / bucket.count;
    const lng = bucket.lngSum / bucket.count;

    if (bucket.count === 1 && bucket.station) {
      points.push({ kind: 'station', station: bucket.station, lat, lng });
      continue;
    }

    points.push({
      kind: 'cluster',
      lat,
      lng,
      count: bucket.count,
      minPrice: bucket.minPrice,
    });
  }

  return points;
};

export const MapView = ({
  stations,
  selectedFuel,
  center,
  onStationSelect,
  selectedStationId,
  theme,
  initialZoom = 11.5,
  onViewportChange,
  onMapInteraction,
}: MapViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const initRef = useRef(false);
  const suppressNextMoveRef = useRef(false);
  const [zoomLevel, setZoomLevel] = useState(initialZoom);

  const displayPoints = useMemo(
    () => buildDisplayPoints(stations, selectedFuel, zoomLevel),
    [stations, selectedFuel, zoomLevel]
  );

  useEffect(() => {
    if (!containerRef.current || initRef.current) return;
    initRef.current = true;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_STYLES[theme || 'dark'],
      center: [center[1], center[0]],
      zoom: initialZoom,
      attributionControl: false,
      fadeDuration: 0,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.scrollZoom.setWheelZoomRate(1 / 220);

    const emitViewport = () => {
      if (!onViewportChange) return;
      const b = map.getBounds();
      onViewportChange({
        center: [map.getCenter().lat, map.getCenter().lng],
        zoom: map.getZoom(),
        bounds: {
          west: b.getWest(),
          south: b.getSouth(),
          east: b.getEast(),
          north: b.getNorth(),
        },
      });
    };

    map.on('load', () => {
      setZoomLevel(map.getZoom());
      emitViewport();
    });

    map.on('moveend', () => {
      setZoomLevel(map.getZoom());
      if (suppressNextMoveRef.current) {
        suppressNextMoveRef.current = false;
        return;
      }
      emitViewport();
    });

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
      emitViewport();
    });

    map.on('dragstart', () => onMapInteraction?.());
    map.on('zoomstart', () => onMapInteraction?.());

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      initRef.current = false;
    };
  }, [center, initialZoom, onMapInteraction, onViewportChange, theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(TILE_STYLES[theme || 'dark']);
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextCenter = [center[1], center[0]] as [number, number];
    const curr = map.getCenter();
    const drift = Math.abs(curr.lat - center[0]) + Math.abs(curr.lng - center[1]);
    if (drift < 0.00035) return;

    suppressNextMoveRef.current = true;
    map.flyTo({
      center: nextCenter,
      zoom: clamp(map.getZoom(), 8, 14),
      speed: 1.2,
      curve: 1.42,
      easing: (t) => t * (2 - t),
      essential: true,
    });
  }, [center]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderMarkers = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const colors = readMarkerColors();

      const anyRealPrice = stations.some(
        (s) => s.prices?.[selectedFuel] !== null && s.prices?.[selectedFuel] !== undefined
      );
      const usePlaceholder = !anyRealPrice;

      for (const point of displayPoints) {
        if (point.kind === 'cluster') {
          const element = createClusterMarkerElement(point.count, point.minPrice, colors);
          element.addEventListener('click', (e) => {
            e.stopPropagation();
            onMapInteraction?.();
            map.easeTo({
              center: [point.lng, point.lat],
              zoom: clamp(map.getZoom() + 1.25, map.getZoom(), 14),
              duration: 420,
            });
          });
          const marker = new maplibregl.Marker({ element, anchor: 'center' }).setLngLat([point.lng, point.lat]).addTo(map);
          markersRef.current.push(marker);
          continue;
        }

        const { station, lat, lng } = point;
        const isSelected = station._id === selectedStationId;
        const { element, hasPrice } = createMarkerElement(station, selectedFuel, isSelected, colors, usePlaceholder);
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
      }
    };

    if (map.isStyleLoaded()) {
      renderMarkers();
    } else {
      map.once('styledata', renderMarkers);
    }
  }, [displayPoints, onMapInteraction, onStationSelect, selectedFuel, selectedStationId, stations, theme]);

  return <div ref={containerRef} className="h-full w-full" style={{ background: 'var(--bg-primary)' }} />;
};

export default MapView;
