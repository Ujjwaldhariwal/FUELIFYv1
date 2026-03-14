import type { FuelType, Station } from "@/types";

export type FuelMapStyle = "liberty" | "positron" | "dark";

// App-level coordinates are [latitude, longitude] to match existing page state.
export type LatLng = [number, number];

export interface FuelMapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface FuelMapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface FuelMapViewportInfo {
  center: LatLng;
  zoom: number;
  bounds: FuelMapBounds;
}

export interface FuelMapProps {
  stations: Station[];
  selectedStation?: Station;
  onStationSelect: (station: Station) => void;
  userLocation?: LatLng;
  mapStyle?: FuelMapStyle;
  className?: string;
  selectedFuel?: FuelType;
  targetCenter?: LatLng;
  onViewportChange?: (viewport: FuelMapViewportInfo) => void;
  onMapInteraction?: () => void;
}

export interface StationPoint {
  station: Station;
  longitude: number;
  latitude: number;
  price: number | null;
}

export interface ClusterPoint {
  longitude: number;
  latitude: number;
  clusterId: number;
  pointCount: number;
}

export interface FuelMapTooltipState {
  x: number;
  y: number;
  station: Station;
  price: number | null;
}

export const DEFAULT_VIEW_STATE: FuelMapViewState = {
  longitude: -82.9,
  latitude: 40.0,
  zoom: 7,
  pitch: 30,
  bearing: 0,
};

export const MAP_STYLE_URLS: Record<FuelMapStyle, string> = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  positron: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};
