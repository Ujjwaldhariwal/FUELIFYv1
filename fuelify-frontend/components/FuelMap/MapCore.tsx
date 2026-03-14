"use client";

import { type Layer, type PickingInfo } from "@deck.gl/core";
import { MapboxOverlay } from "@deck.gl/mapbox";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { type MapRef, useControl, type ViewStateChangeEvent } from "react-map-gl/maplibre";
import {
  createClusterCircleLayer,
  createClusterCountLayer,
  createClusterHaloLayer,
  createNearbyStationLabelLayer,
  createNearbyStationRingLayer,
  createRecentUpdatePulseLayer,
  createSelectedStationHaloLayer,
  createStationAuraLayer,
  createStationLayer,
  createUserLocationLayers,
  buildClusterIndex,
  distanceKmBetween,
  filterStationsByBounds,
  filterStationsByUserRadius,
  getClusters,
  getPriceRange,
  getStationPrice,
  toStationPoints,
} from "./layers";
import MapControls from "./MapControls";
import StationBottomSheet from "./StationBottomSheet";
import type { ClusterPoint, FuelMapProps, FuelMapStyle, FuelMapTooltipState, FuelMapViewState, LatLng, StationPoint } from "./types";
import { DEFAULT_VIEW_STATE, MAP_STYLE_URLS } from "./types";
import { getViewportBounds, useMapViewport } from "./useMapViewport";

const ACTIVE_UPDATE_WINDOW_MS = 2 * 60 * 60 * 1000;
const FLY_TO_DURATION = 800;
const easeCubicInOut = (value: number) =>
  value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;

const styleFromProp = (variant: FuelMapStyle | undefined) => MAP_STYLE_URLS[variant ?? "liberty"];
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const NEARBY_RADIUS_ZOOM_BREAKPOINT = 13;

const DeckOverlay = ({ layers }: { layers: Layer[] }) => {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay({ interleaved: true, layers }));
  overlay.setProps({ interleaved: true, layers });
  return null;
};

export const MapCore = ({
  stations,
  selectedStation,
  onStationSelect,
  userLocation,
  mapStyle = "liberty",
  className,
  selectedFuel = "regular",
  targetCenter,
  onViewportChange,
  onMapInteraction,
}: FuelMapProps) => {
  const mapRef = useRef<MapRef | null>(null);
  const geolocationRequestedRef = useRef(false);

  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<ReturnType<typeof getViewportBounds> | null>(null);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [animationClock, setAnimationClock] = useState(0);
  const [resolvedUserLocation, setResolvedUserLocation] = useState<LatLng | undefined>(userLocation);
  const [tooltip, setTooltip] = useState<FuelMapTooltipState | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { viewState, setViewStateWithDebounce, emitViewportNow } = useMapViewport({
    initialViewState: DEFAULT_VIEW_STATE,
    debounceMs: 200,
    onViewportChange,
  });

  const mapStyleUrl = useMemo(() => styleFromProp(mapStyle), [mapStyle]);

  useEffect(() => {
    setResolvedUserLocation(userLocation);
  }, [userLocation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const viewportMedia = window.matchMedia("(max-width: 767px)");
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncViewport = () => setIsMobile(viewportMedia.matches);
    const syncMotion = () => setReducedMotion(motionMedia.matches);

    syncViewport();
    syncMotion();

    viewportMedia.addEventListener("change", syncViewport);
    motionMedia.addEventListener("change", syncMotion);

    return () => {
      viewportMedia.removeEventListener("change", syncViewport);
      motionMedia.removeEventListener("change", syncMotion);
    };
  }, []);

  useEffect(() => {
    setTilesLoaded(false);
  }, [mapStyleUrl]);

  const stationPoints = useMemo(
    () => toStationPoints(stations, selectedFuel),
    [stations, selectedFuel],
  );

  const clusterIndex = useMemo(() => buildClusterIndex(stationPoints), [stationPoints]);

  const visibleStations = useMemo(
    () => filterStationsByBounds(stationPoints, currentBounds),
    [currentBounds, stationPoints],
  );

  const recentVisibleStations = useMemo(() => {
    const now = Date.now();
    return visibleStations.filter((point) => {
      const lastUpdated = point.station.prices?.lastUpdated;
      if (!lastUpdated) return false;
      const timestamp = new Date(lastUpdated).getTime();
      if (Number.isNaN(timestamp)) return false;
      return now - timestamp <= ACTIVE_UPDATE_WINDOW_MS;
    });
  }, [visibleStations]);

  const zoom = viewState.zoom;
  const nearbyRadiusKm = zoom >= NEARBY_RADIUS_ZOOM_BREAKPOINT ? 5 : 10;
  const markerBlend = clamp01((zoom - 10.7) / 0.7);
  const stationOpacity = markerBlend;
  const clusterOpacity = 1 - markerBlend;
  const clustersShouldRender = clusterOpacity > 0.01 && zoom < 11.5;
  const stationsShouldRender = stationOpacity > 0.01 && zoom > 10.3;

  const clusterFeatures = useMemo(() => getClusters(clusterIndex, currentBounds, zoom), [
    clusterIndex,
    currentBounds,
    zoom,
  ]);

  const clusterPoints = useMemo(
    () =>
      clusterFeatures
        .map((feature) => {
          const properties = feature.properties as {
            cluster?: boolean;
            cluster_id?: number;
            point_count?: number;
          };
          if (
            properties.cluster !== true ||
            typeof properties.cluster_id !== "number" ||
            typeof properties.point_count !== "number"
          ) {
            return null;
          }
          return {
            longitude: feature.geometry.coordinates[0],
            latitude: feature.geometry.coordinates[1],
            clusterId: properties.cluster_id,
            pointCount: properties.point_count,
          } satisfies ClusterPoint;
        })
        .filter((cluster): cluster is ClusterPoint => cluster !== null),
    [clusterFeatures],
  );

  const { min: minPrice, max: maxPrice } = useMemo(
    () => getPriceRange(visibleStations),
    [visibleStations],
  );

  const nearbyVisibleStations = useMemo(
    () => filterStationsByUserRadius(visibleStations, resolvedUserLocation, nearbyRadiusKm),
    [nearbyRadiusKm, resolvedUserLocation, visibleStations],
  );

  const requestUserGeolocation = useCallback(
    (onSuccess?: (coords: LatLng) => void) => {
      if (typeof window === "undefined" || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const next: LatLng = [coords.latitude, coords.longitude];
          setResolvedUserLocation(next);
          onSuccess?.(next);
        },
        () => {
          // Keep map usable when geolocation permission is denied.
        },
        {
          enableHighAccuracy: false,
          timeout: 9000,
          maximumAge: 10 * 60 * 1000,
        },
      );
    },
    [],
  );

  const flyTo = useCallback(
    (target: LatLng, zoomLevel: number, pitch: number, bearing?: number) => {
      const map = mapRef.current;
      if (!map) return;
      map.flyTo({
        center: [target[1], target[0]],
        zoom: zoomLevel,
        pitch,
        bearing: bearing ?? map.getBearing(),
        duration: reducedMotion ? 0 : FLY_TO_DURATION,
        easing: easeCubicInOut,
        essential: true,
      });
    },
    [reducedMotion],
  );

  const handleClusterClick = useCallback(
    (cluster: { clusterId: number; longitude: number; latitude: number }) => {
      const map = mapRef.current;
      if (!map) return;
      onMapInteraction?.();
      const expansionZoom = Math.min(clusterIndex.getClusterExpansionZoom(cluster.clusterId), 14);
      const leaves = clusterIndex.getLeaves(cluster.clusterId, Infinity);

      if (leaves.length > 1) {
        let minLng = Number.POSITIVE_INFINITY;
        let minLat = Number.POSITIVE_INFINITY;
        let maxLng = Number.NEGATIVE_INFINITY;
        let maxLat = Number.NEGATIVE_INFINITY;

        for (const leaf of leaves) {
          const [lng, lat] = leaf.geometry.coordinates;
          minLng = Math.min(minLng, lng);
          minLat = Math.min(minLat, lat);
          maxLng = Math.max(maxLng, lng);
          maxLat = Math.max(maxLat, lat);
        }

        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          {
            padding: isMobile ? 72 : 96,
            duration: reducedMotion ? 0 : FLY_TO_DURATION,
            easing: easeCubicInOut,
          },
        );
        return;
      }

      map.flyTo({
        center: [cluster.longitude, cluster.latitude],
        zoom: expansionZoom,
        duration: reducedMotion ? 0 : FLY_TO_DURATION,
        easing: easeCubicInOut,
        essential: true,
      });
    },
    [clusterIndex, isMobile, onMapInteraction, reducedMotion],
  );

  const handleStationHover = useCallback(
    (info: PickingInfo<StationPoint>) => {
      if (!info.object || info.x === undefined || info.y === undefined) {
        setTooltip(null);
        return;
      }

      if (resolvedUserLocation) {
        const distanceKm = distanceKmBetween(resolvedUserLocation, [
          info.object.latitude,
          info.object.longitude,
        ]);
        if (distanceKm > nearbyRadiusKm) {
          setTooltip(null);
          return;
        }
      }

      setTooltip({
        x: info.x,
        y: info.y,
        station: info.object.station,
        price: info.object.price,
      });
    },
    [nearbyRadiusKm, resolvedUserLocation],
  );

  const handleStationClick = useCallback(
    (station: StationPoint["station"]) => {
      onMapInteraction?.();
      onStationSelect(station);
      if (isMobile) setSheetOpen(true);
    },
    [isMobile, onMapInteraction, onStationSelect],
  );

  const layers = useMemo(() => {
    const mapLayers: Layer[] = [];

    if (clustersShouldRender && clusterPoints.length > 0) {
      mapLayers.push(
        createClusterHaloLayer({
          data: clusterPoints,
          visible: true,
          opacity: clusterOpacity,
        }),
      );
      mapLayers.push(
        createClusterCircleLayer({
          data: clusterPoints,
          visible: true,
          opacity: clusterOpacity,
          onClusterClick: handleClusterClick,
        }),
      );
      mapLayers.push(
        createClusterCountLayer({
          data: clusterPoints,
          visible: true,
          opacity: clusterOpacity,
        }),
      );
    }

    if (stationsShouldRender) {
      mapLayers.push(
        createStationAuraLayer({
          data: visibleStations,
          minPrice,
          maxPrice,
          isMobile,
          visible: true,
          opacity: stationOpacity,
        }),
      );
      mapLayers.push(
        createStationLayer({
          data: visibleStations,
          minPrice,
          maxPrice,
          isMobile,
          visible: true,
          opacity: stationOpacity,
          selectedStationId: selectedStation?._id,
          onStationClick: handleStationClick,
          onStationHover: handleStationHover,
        }),
      );
      if (nearbyVisibleStations.length > 0) {
        mapLayers.push(
          createNearbyStationRingLayer({
            data: nearbyVisibleStations,
            visible: true,
            reducedMotion,
            animationClock,
          }),
        );
        mapLayers.push(
          createNearbyStationLabelLayer({
            data: nearbyVisibleStations,
            visible: zoom >= 12,
          }),
        );
      }
      mapLayers.push(
        createRecentUpdatePulseLayer({
          data: recentVisibleStations,
          visible: true,
          reducedMotion,
          animationClock,
        }),
      );
    }

    const selectedHaloLayer = createSelectedStationHaloLayer(selectedStation, true);
    if (selectedHaloLayer) mapLayers.push(selectedHaloLayer);

    mapLayers.push(...createUserLocationLayers(resolvedUserLocation, reducedMotion, animationClock));
    return mapLayers;
  }, [
    animationClock,
    clusterOpacity,
    clusterPoints,
    clustersShouldRender,
    handleClusterClick,
    handleStationClick,
    handleStationHover,
    isMobile,
    maxPrice,
    minPrice,
    nearbyVisibleStations,
    recentVisibleStations,
    reducedMotion,
    resolvedUserLocation,
    selectedStation,
    stationOpacity,
    stationsShouldRender,
    visibleStations,
    zoom,
  ]);

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!geolocationRequestedRef.current) {
      geolocationRequestedRef.current = true;
      if (!resolvedUserLocation) requestUserGeolocation();
    }

    setCurrentBounds(getViewportBounds(map));
    emitViewportNow(viewState, map);
  }, [emitViewportNow, requestUserGeolocation, resolvedUserLocation, viewState]);

  const handleMapIdle = useCallback(() => {
    setTilesLoaded(true);
  }, []);

  const handleMapError = useCallback(() => {
    setMapError("Basemap is temporarily unavailable. Station overlays remain active.");
  }, []);

  const handleViewStateChange = useCallback(
    (event: ViewStateChangeEvent) => {
      const next = event.viewState as FuelMapViewState;
      const normalized: FuelMapViewState = {
        longitude: next.longitude,
        latitude: next.latitude,
        zoom: next.zoom,
        pitch: typeof next.pitch === "number" ? next.pitch : viewState.pitch,
        bearing: typeof next.bearing === "number" ? next.bearing : viewState.bearing,
      };
      setViewStateWithDebounce(normalized, mapRef.current);
      if (mapRef.current) setCurrentBounds(getViewportBounds(mapRef.current));
    },
    [setViewStateWithDebounce, viewState.bearing, viewState.pitch],
  );

  const handleMoveStart = useCallback(() => {
    onMapInteraction?.();
  }, [onMapInteraction]);

  const zoomIn = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      zoom: map.getZoom() + 1,
      duration: reducedMotion ? 0 : 250,
      easing: easeCubicInOut,
    });
  }, [reducedMotion]);

  const zoomOut = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      zoom: map.getZoom() - 1,
      duration: reducedMotion ? 0 : 250,
      easing: easeCubicInOut,
    });
  }, [reducedMotion]);

  const resetBearing = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      bearing: 0,
      duration: reducedMotion ? 0 : 350,
      easing: easeCubicInOut,
    });
  }, [reducedMotion]);

  const locateMe = useCallback(() => {
    if (resolvedUserLocation) {
      flyTo(resolvedUserLocation, 13, 45, 0);
      return;
    }
    requestUserGeolocation((coords) => {
      flyTo(coords, 13, 45, 0);
    });
  }, [flyTo, requestUserGeolocation, resolvedUserLocation]);

  useEffect(() => {
    if (!targetCenter) return;
    const map = mapRef.current;
    if (!map) return;
    const mapCenter = map.getCenter();
    const drift =
      Math.abs(mapCenter.lat - targetCenter[0]) + Math.abs(mapCenter.lng - targetCenter[1]);
    if (drift < 0.00025) return;
    flyTo(targetCenter, Math.max(zoom, 11.2), Math.max(viewState.pitch, 30));
  }, [flyTo, targetCenter, viewState.pitch, zoom]);

  useEffect(() => {
    if (!selectedStation) return;
    const [longitude, latitude] = selectedStation.coordinates.coordinates;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
    flyTo([latitude, longitude], Math.max(zoom, 12.5), Math.max(viewState.pitch, 32));
    if (isMobile) setSheetOpen(true);
  }, [flyTo, isMobile, selectedStation, viewState.pitch, zoom]);

  useEffect(() => {
    const hasActiveAnimation = !reducedMotion && (recentVisibleStations.length > 0 || !!resolvedUserLocation);
    if (!hasActiveAnimation) {
      setAnimationClock(0.25);
      return;
    }

    let raf = 0;
    const startTime = performance.now();
    const loop = (time: number) => {
      const elapsed = (time - startTime) % 1600;
      setAnimationClock(elapsed / 1600);
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [recentVisibleStations.length, reducedMotion, resolvedUserLocation]);

  const selectedPrice = selectedStation ? getStationPrice(selectedStation, selectedFuel) : null;

  return (
    <div
      className={[
        "relative isolate w-full overflow-hidden bg-[#1a1a2e]",
        "h-[calc(100dvh-var(--fuelify-header-height,0px))] lg:h-full",
        className ?? "",
      ].join(" ")}
      style={{ touchAction: "none", userSelect: "none" }}
    >
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={mapStyleUrl}
        style={{ width: "100%", height: "100%", backgroundColor: "#1a1a2e" }}
        attributionControl={false}
        dragPan
        dragRotate
        scrollZoom
        touchZoomRotate
        pitchWithRotate
        doubleClickZoom
        keyboard={false}
        reuseMaps
        onLoad={handleMapLoad}
        onIdle={handleMapIdle}
        onMoveStart={handleMoveStart}
        onMove={handleViewStateChange}
        onError={handleMapError}
        {...viewState}
      >
        <DeckOverlay layers={layers} />
      </Map>

      <div className="pointer-events-none absolute right-3 top-3 z-[620]">
        <MapControls
          bearing={viewState.bearing}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetBearing={resetBearing}
          onLocateMe={locateMe}
        />
      </div>

      <div
        className={`pointer-events-none absolute inset-0 z-[610] transition-opacity duration-500 ${
          tilesLoaded ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="absolute inset-0 bg-[#1a1a2e]" />
        <div className="skeleton-shimmer absolute inset-0 opacity-30" />
      </div>

      {mapError && (
        <div className="pointer-events-none absolute left-3 top-3 z-[625] rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-secondary)] shadow-[var(--shadow-sm)]">
          {mapError}
        </div>
      )}

      {tooltip && (
        <div
          className="pointer-events-none absolute z-[630] rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-primary)] shadow-[var(--shadow-sm)]"
          style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}
        >
          <p className="max-w-[220px] truncate font-semibold">{tooltip.station.name}</p>
          <p className="mt-0.5 text-[var(--text-secondary)]">
            {tooltip.price !== null ? `$${tooltip.price.toFixed(3)}` : "Price unavailable"}
          </p>
        </div>
      )}

      <StationBottomSheet
        station={selectedStation}
        price={selectedPrice}
        isOpen={sheetOpen && isMobile}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
};

export default MapCore;
