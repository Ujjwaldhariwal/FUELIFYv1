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

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
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
