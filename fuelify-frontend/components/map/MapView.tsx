// components/map/MapView.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import useSupercluster from "use-supercluster";
import type { FuelType, Station, StationCluster } from "@/types";
import {
  createMarkerElement,
  getStationPrice,
  readMarkerColors,
} from "./MarkerFactory";
import { createClusterMarkerElement } from "./ClusterMarkerFactory";

const TILE_STYLES: Record<string, maplibregl.StyleSpecification> = {
  light: {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      },
    },
    layers: [
      { id: "carto", type: "raster", source: "carto", minzoom: 0, maxzoom: 19 },
    ],
  },
  dark: {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      },
    },
    layers: [
      { id: "carto", type: "raster", source: "carto", minzoom: 0, maxzoom: 19 },
    ],
  },
};

export interface MapViewportInfo {
  center: [number, number];
  zoom: number;
  bounds: { west: number; south: number; east: number; north: number };
}

interface MapViewProps {
  stations: Station[];
  clusters?: StationCluster[];
  useServerClusters?: boolean;
  selectedFuel: FuelType;
  center: [number, number];
  onStationSelect: (station: Station) => void;
  selectedStationId?: string;
  theme?: "light" | "dark";
  initialZoom?: number;
  onViewportChange?: (viewport: MapViewportInfo) => void;
  onMapInteraction?: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const MapView = ({
  stations,
  clusters = [],
  useServerClusters = false,
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
  const appliedThemeRef = useRef<"light" | "dark">(theme || "dark");

  // Track Map State for Supercluster
  const [zoomLevel, setZoomLevel] = useState(initialZoom);
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(
    null,
  );

  // ─── Stable callback refs ─────────────────────────────────────────────────
  const onViewportChangeRef = useRef(onViewportChange);
  const onMapInteractionRef = useRef(onMapInteraction);
  const onStationSelectRef = useRef(onStationSelect);
  useEffect(() => { onViewportChangeRef.current = onViewportChange; }, [onViewportChange]);
  useEffect(() => { onMapInteractionRef.current = onMapInteraction; }, [onMapInteraction]);
  useEffect(() => { onStationSelectRef.current = onStationSelect; }, [onStationSelect]);

  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(initialZoom);

  // ─── 1. Format Data for Supercluster ──────────────────────────────────────
  const points = useMemo(() => {
    return stations
      .filter((station) => {
        const [lng, lat] = station.coordinates.coordinates;
        return Number.isFinite(lat) && Number.isFinite(lng);
      })
      .map((station) => ({
        type: "Feature" as const,
        properties: {
          cluster: false,
          stationId: station._id,
          price: getStationPrice(station, selectedFuel),
          station: station,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [
            station.coordinates.coordinates[0],
            station.coordinates.coordinates[1],
          ] as [number, number],
        },
      }));
  }, [stations, selectedFuel]);

  // ─── 2. Initialize Supercluster Hook ──────────────────────────────────────
  // options MUST be stable — inline objects/functions cause infinite re-render
  const superclusterOptions = useMemo(
    () => ({
      radius: 65,
      maxZoom: 12,
      map: (props: { price: number | null }) => ({ minPrice: props.price }),
      reduce: (
        accumulated: { minPrice: number | null | undefined },
        props: { minPrice: number | null },
      ) => {
        if (props.minPrice === null) return;
        if (accumulated.minPrice === null || accumulated.minPrice === undefined) {
          accumulated.minPrice = props.minPrice;
        } else {
          accumulated.minPrice = Math.min(accumulated.minPrice, props.minPrice);
        }
      },
    }),
    [],
  );

  const { clusters: superclusters, supercluster } = useSupercluster({
    points,
    bounds: bounds ?? undefined,
    zoom: zoomLevel,
    options: superclusterOptions,
  });

  // ─── Init map ONCE ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || initRef.current) return;
    initRef.current = true;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_STYLES[theme || "dark"],
      center: [initialCenterRef.current[1], initialCenterRef.current[0]],
      zoom: initialZoomRef.current,
      attributionControl: false,
      fadeDuration: 0,
    });

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    map.scrollZoom.setWheelZoomRate(1 / 220);

    const updateMapState = () => {
      const b = map.getBounds();
      const w = b.getWest(), s = b.getSouth(), e = b.getEast(), n = b.getNorth();
      // Only update if values actually changed — avoids re-render with same bounds
      setBounds((prev) =>
        prev && prev[0] === w && prev[1] === s && prev[2] === e && prev[3] === n
          ? prev
          : [w, s, e, n],
      );
      setZoomLevel(map.getZoom());

      if (!onViewportChangeRef.current) return;
      onViewportChangeRef.current({
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

    map.on("load", updateMapState);

    map.on("moveend", () => {
      if (suppressNextMoveRef.current) {
        suppressNextMoveRef.current = false;
        return;
      }
      updateMapState();
    });

    map.on("dragstart", () => onMapInteractionRef.current?.());
    map.on("zoomstart", () => onMapInteractionRef.current?.());

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      initRef.current = false;
    };
  }, []);

  // ─── Theme & Fly-to Effects ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextTheme = theme || "dark";
    if (appliedThemeRef.current === nextTheme) return;
    appliedThemeRef.current = nextTheme;
    map.setStyle(TILE_STYLES[nextTheme]);
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const curr = map.getCenter();
    const drift =
      Math.abs(curr.lat - center[0]) + Math.abs(curr.lng - center[1]);
    if (drift < 0.00035) return;
    suppressNextMoveRef.current = true;
    map.flyTo({
      center: [center[1], center[0]],
      zoom: clamp(map.getZoom(), 8, 14),
      speed: 1.2,
      curve: 1.42,
      essential: true,
    });
  }, [center]);

  useEffect(() => {
    if (!selectedStationId) return;
    const map = mapRef.current;
    if (!map) return;
    const selectedStation = stations.find((s) => s._id === selectedStationId);
    if (!selectedStation) return;
    const [lng, lat] = selectedStation.coordinates.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    suppressNextMoveRef.current = true;
    map.flyTo({
      center: [lng, lat],
      zoom: clamp(Math.max(map.getZoom(), 12.75), 8, 15),
      speed: 1.08,
      curve: 1.42,
      essential: true,
    });
  }, [selectedStationId, stations]);

  // ─── Render markers ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !superclusters) return;

    const renderMarkers = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      const colors = readMarkerColors();

      for (const feature of superclusters) {
        const [lng, lat] = feature.geometry.coordinates;

        // 1. Check if it's a cluster first so TypeScript knows how to behave
        if (feature.properties.cluster) {
          // Cast the ID to a number to satisfy TypeScript
          const clusterId = feature.id as number;
          const clusterProps = feature.properties as {
            point_count?: number;
            minPrice?: number | null;
          };
          const pointCount = clusterProps.point_count ?? 0;
          const minPrice = clusterProps.minPrice ?? null;

          const element = createClusterMarkerElement(pointCount, minPrice ?? null, colors);

          element.addEventListener("click", (e) => {
            e.stopPropagation();
            onMapInteractionRef.current?.();

            // 2. Ensure supercluster is loaded before trying to use it
            if (supercluster) {
              const expansionZoom = Math.min(
                supercluster.getClusterExpansionZoom(clusterId),
                14
              );

              map.easeTo({
                center: [lng, lat],
                zoom: expansionZoom,
                duration: 420,
              });
            }
          });

          const marker = new maplibregl.Marker({ element, anchor: "center" })
            .setLngLat([lng, lat])
            .addTo(map);
          markersRef.current.push(marker);
          
        } else {
          // 3. Since it's not a cluster, TypeScript now knows it's a single station
          // We just cast it to access our custom station data
          const station = (feature.properties as { station: Station }).station;
          const isSelected = station._id === selectedStationId;
          
          const { element, hasPrice } = createMarkerElement(
            station,
            selectedFuel,
            isSelected,
            colors
          );

          element.addEventListener("click", (e) => {
            e.stopPropagation();
            onStationSelectRef.current(station);
          });

          const marker = new maplibregl.Marker({
            element,
            anchor: hasPrice ? "bottom" : "center",
          })
            .setLngLat([lng, lat])
            .addTo(map);
          markersRef.current.push(marker);
        }
      }
    };

    if (map.isStyleLoaded()) {
      renderMarkers();
    } else {
      map.once("styledata", renderMarkers);
    }

    return () => {
      map.off("styledata", renderMarkers);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [superclusters, selectedFuel, selectedStationId, supercluster, theme]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: "var(--bg-primary)" }}
    />
  );
};

export default MapView;
