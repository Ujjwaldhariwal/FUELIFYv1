import type { PickingInfo } from "@deck.gl/core";
import { ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import Supercluster from "supercluster";
import type { FuelType, Station } from "@/types";
import type { ClusterPoint, FuelMapBounds, LatLng, StationPoint } from "./types";

interface SuperclusterStationProperties {
  station: Station;
  price: number | null;
}

const CLUSTER_COLOR_MIN: [number, number, number, number] = [59, 130, 246, 220];
const CLUSTER_COLOR_MAX: [number, number, number, number] = [234, 88, 12, 230];
const PRICE_COLOR_CHEAP: [number, number, number, number] = [34, 197, 94, 220];
const PRICE_COLOR_MID: [number, number, number, number] = [234, 179, 8, 220];
const PRICE_COLOR_EXPENSIVE: [number, number, number, number] = [239, 68, 68, 220];
const PRICE_COLOR_UNKNOWN: [number, number, number, number] = [148, 163, 184, 210];
const STATION_AURA_ALPHA = 78;
const NEARBY_RING_COLOR: [number, number, number, number] = [14, 165, 233, 176];
const NEARBY_LABEL_BG: [number, number, number, number] = [15, 23, 42, 215];
const NEARBY_LABEL_TEXT: [number, number, number, number] = [226, 232, 240, 255];

const lerp = (from: number, to: number, factor: number) => from + (to - from) * factor;

const lerpColor = (
  from: [number, number, number, number],
  to: [number, number, number, number],
  factor: number,
): [number, number, number, number] => [
  Math.round(lerp(from[0], to[0], factor)),
  Math.round(lerp(from[1], to[1], factor)),
  Math.round(lerp(from[2], to[2], factor)),
  Math.round(lerp(from[3], to[3], factor)),
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const toRadians = (value: number) => (value * Math.PI) / 180;

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

export interface NearbyStationPoint extends StationPoint {
  distanceKm: number;
  label: string;
}

const toNearbyLabel = (point: StationPoint, distanceKm: number) => {
  const compactName =
    point.station.name.length > 18
      ? `${point.station.name.slice(0, 17)}...`
      : point.station.name;
  const price = point.price !== null ? `$${point.price.toFixed(2)}` : "No price";
  return `${compactName} · ${price} · ${distanceKm.toFixed(1)}km`;
};

const withAlpha = (
  color: [number, number, number, number],
  alpha: number,
): [number, number, number, number] => [color[0], color[1], color[2], alpha];

export const distanceKmBetween = (origin: LatLng, target: LatLng) => {
  const [originLat, originLng] = origin;
  const [targetLat, targetLng] = target;
  const latDelta = toRadians(targetLat - originLat);
  const lngDelta = toRadians(targetLng - originLng);
  const sinLat = Math.sin(latDelta / 2);
  const sinLng = Math.sin(lngDelta / 2);
  const a =
    sinLat * sinLat +
    Math.cos(toRadians(originLat)) * Math.cos(toRadians(targetLat)) * sinLng * sinLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const filterStationsByUserRadius = (
  points: StationPoint[],
  userLocation: LatLng | undefined,
  radiusKm: number,
) => {
  if (!userLocation || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    return [] as NearbyStationPoint[];
  }

  return points
    .map((point) => {
      const distanceKm = distanceKmBetween(userLocation, [point.latitude, point.longitude]);
      if (distanceKm > radiusKm) return null;
      return {
        ...point,
        distanceKm,
        label: toNearbyLabel(point, distanceKm),
      } satisfies NearbyStationPoint;
    })
    .filter((point): point is NearbyStationPoint => point !== null);
};

export const getStationPrice = (station: Station, fuel: FuelType): number | null => {
  const value = station.prices?.[fuel];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export const toStationPoints = (
  stations: Station[],
  selectedFuel: FuelType,
): StationPoint[] =>
  stations
    .map((station) => {
      const [longitude, latitude] = station.coordinates.coordinates;
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
      return {
        station,
        longitude,
        latitude,
        price: getStationPrice(station, selectedFuel),
      };
    })
    .filter((point): point is StationPoint => point !== null);

export const filterStationsByBounds = (
  points: StationPoint[],
  bounds: FuelMapBounds | null,
) => {
  if (!bounds) return points;
  return points.filter(
    (point) =>
      point.longitude >= bounds.west &&
      point.longitude <= bounds.east &&
      point.latitude >= bounds.south &&
      point.latitude <= bounds.north,
  );
};

export const getPriceRange = (points: StationPoint[]) => {
  const prices = points
    .map((point) => point.price)
    .filter((price): price is number => typeof price === "number");
  if (prices.length === 0) return { min: null, max: null } as const;
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  } as const;
};

export const priceColorForStation = (
  price: number | null,
  minPrice: number | null,
  maxPrice: number | null,
): [number, number, number, number] => {
  if (price === null || minPrice === null || maxPrice === null) return PRICE_COLOR_UNKNOWN;
  if (maxPrice <= minPrice) return PRICE_COLOR_MID;

  const factor = clamp01((price - minPrice) / (maxPrice - minPrice));
  if (factor <= 0.5) return lerpColor(PRICE_COLOR_CHEAP, PRICE_COLOR_MID, factor * 2);
  return lerpColor(PRICE_COLOR_MID, PRICE_COLOR_EXPENSIVE, (factor - 0.5) * 2);
};

export const buildClusterIndex = (points: StationPoint[]) => {
  const index = new Supercluster<SuperclusterStationProperties, Record<string, never>>({
    maxZoom: 16,
    radius: 60,
    minPoints: 2,
  });
  const features: Array<Supercluster.PointFeature<SuperclusterStationProperties>> = points.map(
    (point) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [point.longitude, point.latitude],
      },
      properties: {
        station: point.station,
        price: point.price,
      },
    }),
  );
  index.load(features);
  return index;
};

export const getClusters = (
  clusterIndex: Supercluster<SuperclusterStationProperties, Record<string, never>>,
  bounds: FuelMapBounds | null,
  zoom: number,
) => {
  const bbox: [number, number, number, number] = bounds
    ? [bounds.west, bounds.south, bounds.east, bounds.north]
    : [-180, -85, 180, 85];
  return clusterIndex.getClusters(bbox, Math.round(zoom));
};

const clusterColor = (count: number, maxCount: number): [number, number, number, number] => {
  if (maxCount <= 1) return CLUSTER_COLOR_MIN;
  const factor = clamp01((count - 1) / (maxCount - 1));
  return lerpColor(CLUSTER_COLOR_MIN, CLUSTER_COLOR_MAX, factor);
};

export const clusterFeatureToPoint = (
  feature: Supercluster.ClusterFeature<Record<string, never>>,
): ClusterPoint => ({
  longitude: feature.geometry.coordinates[0],
  latitude: feature.geometry.coordinates[1],
  clusterId: feature.properties.cluster_id,
  pointCount: feature.properties.point_count,
});

interface ClusterLayerOptions {
  data: ClusterPoint[];
  visible: boolean;
  opacity: number;
  onClusterClick: (cluster: ClusterPoint) => void;
}

export const createClusterHaloLayer = ({
  data,
  visible,
  opacity,
}: Pick<ClusterLayerOptions, "data" | "visible" | "opacity">) =>
  new ScatterplotLayer<ClusterPoint>({
    id: "fuelify-clusters-halo",
    data,
    pickable: false,
    visible,
    opacity: opacity * 0.7,
    stroked: false,
    filled: true,
    radiusUnits: "pixels",
    getPosition: (cluster) => [cluster.longitude, cluster.latitude],
    getRadius: (cluster) => 26 + Math.min(28, Math.sqrt(cluster.pointCount) * 5),
    getFillColor: [30, 41, 59, 95],
    transitions: {
      getRadius: 220,
    },
    updateTriggers: {
      getRadius: [opacity],
    },
  });

export const createClusterCircleLayer = ({
  data,
  visible,
  opacity,
  onClusterClick,
}: ClusterLayerOptions) => {
  const maxCount = data.reduce((highest, cluster) => Math.max(highest, cluster.pointCount), 1);
  return new ScatterplotLayer<ClusterPoint>({
    id: "fuelify-clusters-circles",
    data,
    pickable: true,
    stroked: true,
    filled: true,
    visible,
    opacity,
    radiusUnits: "pixels",
    lineWidthUnits: "pixels",
    getPosition: (cluster) => [cluster.longitude, cluster.latitude],
    getRadius: (cluster) => 18 + Math.min(24, Math.sqrt(cluster.pointCount) * 4),
    getLineWidth: 2,
    getFillColor: (cluster) => clusterColor(cluster.pointCount, maxCount),
    getLineColor: [255, 255, 255, 210],
    transitions: {
      getRadius: 220,
      getFillColor: 220,
    },
    updateTriggers: {
      getFillColor: [maxCount],
      getRadius: [opacity],
    },
    onClick: (info: PickingInfo<ClusterPoint>) => {
      if (info.object) onClusterClick(info.object);
    },
  });
};

export const createClusterCountLayer = ({
  data,
  visible,
  opacity,
}: Pick<ClusterLayerOptions, "data" | "visible" | "opacity">) =>
  new TextLayer<ClusterPoint>({
    id: "fuelify-clusters-count",
    data,
    pickable: false,
    visible,
    opacity,
    getPosition: (cluster) => [cluster.longitude, cluster.latitude],
    getText: (cluster) => cluster.pointCount.toLocaleString(),
    getColor: [255, 255, 255, 255],
    getSize: 13,
    sizeUnits: "pixels",
    getTextAnchor: "middle",
    getAlignmentBaseline: "center",
    background: false,
    fontWeight: 700,
  });

interface StationLayerOptions {
  data: StationPoint[];
  minPrice: number | null;
  maxPrice: number | null;
  isMobile: boolean;
  visible: boolean;
  opacity: number;
  selectedStationId?: string;
  onStationClick: (station: Station) => void;
  onStationHover: (info: PickingInfo<StationPoint>) => void;
}

export const createStationAuraLayer = ({
  data,
  minPrice,
  maxPrice,
  isMobile,
  visible,
  opacity,
}: Pick<
  StationLayerOptions,
  "data" | "minPrice" | "maxPrice" | "isMobile" | "visible" | "opacity"
>) =>
  new ScatterplotLayer<StationPoint>({
    id: "fuelify-stations-aura",
    data,
    pickable: false,
    visible,
    opacity: Math.min(0.8, opacity),
    filled: true,
    stroked: false,
    radiusUnits: "pixels",
    getPosition: (point) => [point.longitude, point.latitude],
    getRadius: isMobile ? 16 : 14,
    getFillColor: (point) =>
      withAlpha(priceColorForStation(point.price, minPrice, maxPrice), STATION_AURA_ALPHA),
    transitions: {
      getFillColor: 200,
      getRadius: 200,
    },
    updateTriggers: {
      getFillColor: [minPrice, maxPrice],
      getRadius: [isMobile],
    },
  });

export const createStationLayer = ({
  data,
  minPrice,
  maxPrice,
  isMobile,
  visible,
  opacity,
  selectedStationId,
  onStationClick,
  onStationHover,
}: StationLayerOptions) =>
  new ScatterplotLayer<StationPoint>({
    id: "fuelify-stations",
    data,
    pickable: true,
    visible,
    opacity,
    filled: true,
    stroked: true,
    radiusUnits: "pixels",
    lineWidthUnits: "pixels",
    getPosition: (point) => [point.longitude, point.latitude],
    getRadius: (point) => {
      const baseRadius = isMobile ? 10 : 8;
      return point.station._id === selectedStationId ? baseRadius + 3 : baseRadius;
    },
    getFillColor: (point) => priceColorForStation(point.price, minPrice, maxPrice),
    getLineColor: (point) =>
      point.station._id === selectedStationId ? [255, 255, 255, 255] : [15, 23, 42, 150],
    getLineWidth: (point) => (point.station._id === selectedStationId ? 2.5 : 1),
    transitions: {
      getFillColor: 180,
      getRadius: 180,
    },
    updateTriggers: {
      getFillColor: [minPrice, maxPrice, opacity],
      getRadius: [isMobile, selectedStationId, opacity],
      getLineWidth: [selectedStationId],
      getLineColor: [selectedStationId],
    },
    onClick: (info: PickingInfo<StationPoint>) => {
      if (info.object) onStationClick(info.object.station);
    },
    onHover: onStationHover,
  });

interface PulseLayerOptions {
  data: StationPoint[];
  visible: boolean;
  reducedMotion: boolean;
  animationClock: number;
}

export const createRecentUpdatePulseLayer = ({
  data,
  visible,
  reducedMotion,
  animationClock,
}: PulseLayerOptions) =>
  new ScatterplotLayer<StationPoint>({
    id: "fuelify-station-updates-pulse",
    data,
    pickable: false,
    visible,
    stroked: true,
    filled: false,
    radiusUnits: "pixels",
    lineWidthUnits: "pixels",
    getPosition: (point) => [point.longitude, point.latitude],
    getRadius: (point) => {
      const jitter = (hashString(point.station._id) % 100) / 100;
      const wave = reducedMotion
        ? 0.35
        : 0.2 + 0.8 * Math.abs(Math.sin((animationClock + jitter) * Math.PI * 2));
      return 12 + wave * 10;
    },
    getLineColor: [56, 189, 248, 190],
    getLineWidth: reducedMotion ? 1.25 : 1.8,
    opacity: reducedMotion ? 0.5 : 0.85,
    updateTriggers: {
      getRadius: [animationClock, reducedMotion],
      getLineWidth: [reducedMotion],
    },
  });

interface NearbyLayerOptions {
  data: NearbyStationPoint[];
  visible: boolean;
  reducedMotion: boolean;
  animationClock: number;
}

export const createNearbyStationRingLayer = ({
  data,
  visible,
  reducedMotion,
  animationClock,
}: NearbyLayerOptions) =>
  new ScatterplotLayer<NearbyStationPoint>({
    id: "fuelify-nearby-ring",
    data,
    pickable: false,
    visible,
    stroked: true,
    filled: false,
    radiusUnits: "pixels",
    lineWidthUnits: "pixels",
    getPosition: (point) => [point.longitude, point.latitude],
    getRadius: (point) => {
      const jitter = (hashString(point.station._id) % 90) / 100;
      const wave = reducedMotion
        ? 0.35
        : 0.2 + 0.8 * Math.abs(Math.sin((animationClock + jitter) * Math.PI * 2));
      return 14 + wave * 10;
    },
    getLineColor: NEARBY_RING_COLOR,
    getLineWidth: reducedMotion ? 1.25 : 2,
    opacity: reducedMotion ? 0.55 : 0.9,
    updateTriggers: {
      getRadius: [animationClock, reducedMotion],
      getLineWidth: [reducedMotion],
    },
  });

export const createNearbyStationLabelLayer = ({
  data,
  visible,
}: Pick<NearbyLayerOptions, "data" | "visible">) =>
  new TextLayer<NearbyStationPoint>({
    id: "fuelify-nearby-labels",
    data,
    pickable: false,
    visible,
    getPosition: (point) => [point.longitude, point.latitude],
    getPixelOffset: [0, -22],
    getText: (point) => point.label,
    getColor: NEARBY_LABEL_TEXT,
    getSize: 11,
    sizeUnits: "pixels",
    getTextAnchor: "middle",
    getAlignmentBaseline: "bottom",
    fontWeight: 700,
    fontFamily: "ui-sans-serif",
    maxWidth: 240,
    background: true,
    getBackgroundColor: NEARBY_LABEL_BG,
    backgroundPadding: [7, 4],
    characterSet: "auto",
    updateTriggers: {
      getText: [data.length],
    },
  });

export const createSelectedStationHaloLayer = (
  selectedStation: Station | undefined,
  visible: boolean,
) => {
  if (!selectedStation) return null;
  const [longitude, latitude] = selectedStation.coordinates.coordinates;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return new ScatterplotLayer<{ longitude: number; latitude: number }>({
    id: "fuelify-selected-station-halo",
    data: [{ longitude, latitude }],
    pickable: false,
    visible,
    stroked: true,
    filled: false,
    radiusUnits: "pixels",
    lineWidthUnits: "pixels",
    getPosition: (point) => [point.longitude, point.latitude],
    getRadius: 20,
    getLineWidth: 2.25,
    getLineColor: [255, 255, 255, 220],
  });
};

export const createUserLocationLayers = (
  userLocation: LatLng | undefined,
  reducedMotion: boolean,
  animationClock: number,
) => {
  if (!userLocation) return [] as const;
  const longitude = userLocation[1];
  const latitude = userLocation[0];
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return [] as const;
  const locationData = [{ longitude, latitude }];

  const pulseRadius = reducedMotion
    ? 18
    : 16 + Math.abs(Math.sin(animationClock * Math.PI * 2)) * 8;

  const pulseLayer = new ScatterplotLayer<{ longitude: number; latitude: number }>({
    id: "fuelify-user-location-pulse",
    data: locationData,
    pickable: false,
    stroked: true,
    filled: false,
    radiusUnits: "pixels",
    lineWidthUnits: "pixels",
    getPosition: (point) => [point.longitude, point.latitude],
    getRadius: pulseRadius,
    getLineWidth: 2,
    getLineColor: [59, 130, 246, 150],
    opacity: reducedMotion ? 0.5 : 0.9,
    updateTriggers: {
      getRadius: [pulseRadius],
    },
  });

  const coreLayer = new ScatterplotLayer<{ longitude: number; latitude: number }>({
    id: "fuelify-user-location-dot",
    data: locationData,
    pickable: false,
    stroked: true,
    filled: true,
    radiusUnits: "pixels",
    lineWidthUnits: "pixels",
    getPosition: (point) => [point.longitude, point.latitude],
    getRadius: 7,
    getFillColor: [59, 130, 246, 255],
    getLineColor: [255, 255, 255, 250],
    getLineWidth: 2.5,
  });

  return [pulseLayer, coreLayer] as const;
};
