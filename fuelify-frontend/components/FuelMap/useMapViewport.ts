import { useCallback, useEffect, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type { FuelMapBounds, FuelMapViewState, FuelMapViewportInfo } from "./types";
import { DEFAULT_VIEW_STATE } from "./types";

interface UseMapViewportOptions {
  initialViewState?: FuelMapViewState;
  debounceMs?: number;
  onViewportChange?: (viewport: FuelMapViewportInfo) => void;
}

export const getViewportBounds = (map: MapRef): FuelMapBounds => {
  const bounds = map.getBounds();
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
};

export const isLngLatInBounds = (
  longitude: number,
  latitude: number,
  bounds: FuelMapBounds,
) =>
  longitude >= bounds.west &&
  longitude <= bounds.east &&
  latitude >= bounds.south &&
  latitude <= bounds.north;

export const useMapViewport = ({
  initialViewState = DEFAULT_VIEW_STATE,
  debounceMs = 200,
  onViewportChange,
}: UseMapViewportOptions) => {
  const [viewState, setViewState] = useState<FuelMapViewState>(initialViewState);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitViewportNow = useCallback(
    (nextViewState: FuelMapViewState, map: MapRef | null) => {
      if (!onViewportChange || !map) return;
      onViewportChange({
        center: [nextViewState.latitude, nextViewState.longitude],
        zoom: nextViewState.zoom,
        bounds: getViewportBounds(map),
      });
    },
    [onViewportChange],
  );

  const emitViewportDebounced = useCallback(
    (nextViewState: FuelMapViewState, map: MapRef | null) => {
      if (!onViewportChange || !map) return;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(() => {
        emitViewportNow(nextViewState, map);
      }, debounceMs);
    },
    [debounceMs, emitViewportNow, onViewportChange],
  );

  const setViewStateWithDebounce = useCallback(
    (nextViewState: FuelMapViewState, map: MapRef | null) => {
      setViewState(nextViewState);
      emitViewportDebounced(nextViewState, map);
    },
    [emitViewportDebounced],
  );

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    },
    [],
  );

  return {
    viewState,
    setViewState,
    setViewStateWithDebounce,
    emitViewportNow,
  };
};
