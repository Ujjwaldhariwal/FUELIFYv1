"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Fuel, Locate, Search, Sun, Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FuelType, Station, StationCluster } from "@/types";
import {
  fetchNearbyStations,
  fetchStationClustersByViewport,
  fetchStationsByViewport,
} from "@/services/api";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { StationListCard } from "@/components/ui/StationListCard";
import { FuelChips } from "@/components/ui/FuelChips";
import { ModeChip } from "@/components/ui/ModeChip";
import { useTheme } from "@/components/theme/ThemeContext";
import type { MapViewportInfo } from "@/components/map/MapView";

const MapView = dynamic(
  () => import("@/components/map/MapView").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => <div className="h-full w-full skeleton-shimmer" />,
  },
);

const DEFAULT_CENTER: [number, number] = [40.4173, -82.9071];
const DEFAULT_VIEWPORT_LIMIT = 150;
const DEFAULT_NEAR_LIMIT = 180;
const PAGE_SIZE_LIST = 80;
const DEFAULT_NEAR_RADIUS_KM = 10;
const FALLBACK_NEAR_RADIUS_KM = 25;
const ENABLE_LOCAL_DATA_FALLBACK = process.env.NODE_ENV !== "production";

const toMiles = (distanceKm?: number) => {
  if (distanceKm === undefined) return null;
  return distanceKm * 0.621371;
};

const dedupeStations = (items: Station[]) => {
  const seen = new Set<string>();
  const out: Station[] = [];
  for (const item of items) {
    if (seen.has(item._id)) continue;
    seen.add(item._id);
    out.push(item);
  }
  return out;
};

export default function HomePage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [stations, setStations] = useState<Station[]>([]);
  const [clusters, setClusters] = useState<StationCluster[]>([]);
  const [selectedFuel, setSelectedFuel] = useState<FuelType>("regular");
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [selectedStationId, setSelectedStationId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewport, setViewport] = useState<MapViewportInfo | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [nearMeMode, setNearMeMode] = useState(true);
  const [listPage, setListPage] = useState(1);
  const [listPages, setListPages] = useState(1);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE_LIST);

  const inFlightControllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lowZoomClusterMode = !nearMeMode && Boolean(viewport && viewport.zoom <= 9);

  const locateUser = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next: [number, number] = [coords.latitude, coords.longitude];
        setUserLocation(next);
        setCenter(next);
        setNearMeMode(true);
      },
      () => {
        setNearMeMode(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000,
      },
    );
  }, []);

  useEffect(() => {
    locateUser();
  }, [locateUser]);

  const fetchListPage = useCallback(
    async (page: number, append: boolean, signal?: AbortSignal) => {
      const applyDefaultOhioFallback = async () => {
        const fallback = await fetchNearbyStations(
          DEFAULT_CENTER[0],
          DEFAULT_CENTER[1],
          FALLBACK_NEAR_RADIUS_KM,
          selectedFuel,
          DEFAULT_VIEWPORT_LIMIT,
          signal,
        );
        setNearMeMode(false);
        setViewport(null);
        setCenter(DEFAULT_CENTER);
        setListPages(fallback.pages || 1);
        setListPage(1);
        setStations(fallback.stations);
        setClusters([]);
      };

      if (nearMeMode && userLocation) {
        const response = await fetchNearbyStations(
          userLocation[0],
          userLocation[1],
          DEFAULT_NEAR_RADIUS_KM,
          selectedFuel,
          DEFAULT_NEAR_LIMIT,
          signal,
        );

        // If no nearby coverage exists for current user location, fall back to seeded Ohio data.
        if ((response.total || 0) === 0 && ENABLE_LOCAL_DATA_FALLBACK) {
          await applyDefaultOhioFallback();
          return;
        }

        setListPages(response.pages || 1);
        setListPage(page);
        setStations((prev) => (append ? dedupeStations([...prev, ...response.stations]) : response.stations));
        setClusters([]);
        return;
      }

      if (viewport) {
        if (lowZoomClusterMode && page === 1) {
          const clusterResponse = await fetchStationClustersByViewport(
            viewport.bounds,
            selectedFuel,
            viewport.zoom,
            500,
            signal,
          );
          setClusters(clusterResponse.clusters);
        } else if (!lowZoomClusterMode) {
          setClusters([]);
        }

        const response = await fetchStationsByViewport(
          viewport.bounds,
          selectedFuel,
          DEFAULT_VIEWPORT_LIMIT,
          viewport.zoom,
          page,
          signal,
        );
        if ((response.total || 0) === 0 && page === 1 && ENABLE_LOCAL_DATA_FALLBACK) {
          await applyDefaultOhioFallback();
          return;
        }
        setListPages(response.pages || 1);
        setListPage(page);
        setStations((prev) => (append ? dedupeStations([...prev, ...response.stations]) : response.stations));
        return;
      }

      const fallback = await fetchNearbyStations(
        center[0],
        center[1],
        25,
        selectedFuel,
        DEFAULT_VIEWPORT_LIMIT,
        signal,
      );
      setListPages(fallback.pages || 1);
      setListPage(page);
      setStations((prev) => (append ? dedupeStations([...prev, ...fallback.stations]) : fallback.stations));
      setClusters([]);
    },
    [center, lowZoomClusterMode, nearMeMode, selectedFuel, userLocation, viewport],
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE_LIST);
    setListPage(1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (inFlightControllerRef.current) inFlightControllerRef.current.abort();

    const controller = new AbortController();
    inFlightControllerRef.current = controller;

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        await fetchListPage(1, false, controller.signal);
      } catch (error: any) {
        if (error?.code !== "ERR_CANCELED") {
          console.error(error);
        }
      } finally {
        setLoading(false);
      }
    }, 260);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      controller.abort();
    };
  }, [fetchListPage]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || listPage >= listPages) return;
    setLoadingMore(true);
    try {
      await fetchListPage(listPage + 1, true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchListPage, listPage, listPages, loadingMore]);

  const handleSearch = () => {
    if (searchQuery.trim().length < 2) return;
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}&state=OH`);
  };

  const handleModeToggle = useCallback(() => {
    if (nearMeMode) {
      setNearMeMode(false);
      return;
    }

    if (userLocation) {
      setCenter(userLocation);
      setNearMeMode(true);
      return;
    }

    locateUser();
  }, [locateUser, nearMeMode, userLocation]);

  const bestStation = useMemo(() => {
    return stations
      .filter((s) => s.prices?.[selectedFuel] !== null && s.prices?.[selectedFuel] !== undefined)
      .sort(
        (a, b) =>
          (a.prices?.[selectedFuel] ?? Number.MAX_SAFE_INTEGER) -
          (b.prices?.[selectedFuel] ?? Number.MAX_SAFE_INTEGER),
      )[0];
  }, [selectedFuel, stations]);

  const priceRanges = useMemo(() => {
    const fuels: FuelType[] = ["regular", "midgrade", "premium", "diesel", "e85"];
    const ranges: Partial<Record<FuelType, { min: number | null; max: number | null }>> = {};
    fuels.forEach((fuel) => {
      const prices = stations
        .map((s) => s.prices?.[fuel])
        .filter((p): p is number => p !== null && p !== undefined);
      ranges[fuel] =
        prices.length > 0
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : { min: null, max: null };
    });
    return ranges;
  }, [stations]);

  const flyToBest = () => {
    if (!bestStation) return;
    const [lng, lat] = bestStation.coordinates.coordinates;
    if (lat === undefined || lng === undefined) return;
    setCenter([lat, lng]);
    setSelectedStationId(bestStation._id);
  };

  const listStations = useMemo(() => stations.slice(0, visibleCount), [stations, visibleCount]);

  const renderStationList = () => (
    <div className="space-y-2 p-3">
      {loading
        ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-2xl skeleton-shimmer" />
          ))
        : listStations.map((station) => (
            <StationListCard
              key={station._id}
              station={station}
              distance={toMiles(station.distanceKm ?? undefined) ?? undefined}
              selectedFuel={selectedFuel}
              isActive={station._id === selectedStationId}
              onClick={() => {
                setSelectedStationId(station._id);
                const [lng, lat] = station.coordinates.coordinates;
                if (lat !== undefined && lng !== undefined) setCenter([lat, lng]);
              }}
            />
          ))}

      {!loading && listStations.length === 0 && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
          No stations found in this view. Pan map or tap locate.
        </p>
      )}

      {!loading && listPage < listPages && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-60"
        >
          {loadingMore ? "Loading..." : "Load more stations in this area"}
        </button>
      )}

      {!loading && listStations.length < stations.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE_LIST, stations.length))}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)]"
        >
          Show more loaded stations
        </button>
      )}
    </div>
  );

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[var(--bg-primary)]">
      <aside className="hidden lg:absolute lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[380px] lg:flex-col lg:border-r lg:border-[var(--border)] lg:bg-[var(--bg-surface)]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gradient shadow-[var(--shadow-accent)]">
              <Fuel className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-base font-black leading-tight">Fuelify</p>
              <p className="text-xs text-[var(--text-muted)]">
                {stations.length} stations {nearMeMode ? "within 10km" : "in view"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{renderStationList()}</div>
      </aside>

      <div className="absolute inset-0 lg:left-[380px]">
        <MapView
          stations={stations}
          clusters={clusters}
          useServerClusters={lowZoomClusterMode}
          selectedFuel={selectedFuel}
          center={center}
          onStationSelect={(station) => {
            setSelectedStationId(station._id);
            const [lng, lat] = station.coordinates.coordinates;
            if (lat !== undefined && lng !== undefined) setCenter([lat, lng]);
            setSheetOpen(true);
          }}
          selectedStationId={selectedStationId}
          theme={theme}
          initialZoom={11.5}
          onViewportChange={setViewport}
          onMapInteraction={() => setNearMeMode(false)}
        />
      </div>

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-[520] px-3 pt-safe sm:px-4 lg:left-[380px]">
        <header className="pointer-events-auto mt-3">
          <div className="flex h-14 items-center gap-2 rounded-2xl border border-[var(--border-strong)] p-2 glass shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
            <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-gradient px-3 shadow-[var(--shadow-accent)]">
              <Fuel className="h-4 w-4 text-white" />
              <span className="text-sm font-black text-white tracking-tight">Fuelify</span>
            </div>

            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search stations..."
                className={[
                  "h-10 w-full rounded-xl border border-[var(--border)] pl-9 pr-3 text-sm",
                  "bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                  "focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]",
                  "transition-all duration-200",
                ].join(" ")}
              />
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)]",
                "transition-all duration-200 hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]",
                "focus:outline-none active:scale-90",
              ].join(" ")}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={locateUser}
              className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)]",
                "transition-all duration-200 hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]",
                "focus:outline-none active:scale-90",
              ].join(" ")}
              aria-label="Use my location"
              title="Re-center and show stations within 10km"
            >
              <Locate className="h-4 w-4" />
            </button>
          </div>
        </header>

        <section className="pointer-events-auto mt-2 flex items-center gap-2">
          <div className="rounded-2xl border border-[var(--border-strong)] p-1.5 glass shadow-[0_4px_20px_rgba(0,0,0,0.10)] flex-1">
            <FuelChips selected={selectedFuel} onSelect={setSelectedFuel} priceRanges={priceRanges} />
          </div>
          <ModeChip mode={nearMeMode ? "nearby" : "mapview"} onToggle={handleModeToggle} />
        </section>

        {bestStation && bestStation.prices[selectedFuel] && (
          <button
            type="button"
            onClick={flyToBest}
            className={[
              "pointer-events-auto mt-2 flex items-center gap-2 rounded-xl px-4 py-2.5",
              "border border-[var(--color-success)]/30 bg-[var(--color-success-muted)]",
              "text-[var(--color-success)]",
              "text-xs font-bold backdrop-blur-sm",
              "transition-all duration-200 hover:bg-[var(--color-success)]/20 active:scale-95",
              "shadow-[0_2px_14px_rgba(16,185,129,0.18)]",
              "focus:outline-none",
            ].join(" ")}
          >
            <span className="text-base leading-none">↓</span>
            <span>
              Best <strong>${bestStation.prices[selectedFuel]!.toFixed(2)}</strong> · {bestStation.name}
              {bestStation.distanceKm !== undefined && (
                <span className="ml-1 opacity-80">{(bestStation.distanceKm * 0.621371).toFixed(1)} mi</span>
              )}
            </span>
          </button>
        )}
      </div>

      <div className="lg:hidden">
        <BottomSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={`Stations ${nearMeMode ? "within 10km" : "in view"} (${stations.length})`}
          snapPoints={[130, "50vh", "90vh"]}
        >
          {renderStationList()}
        </BottomSheet>

        {!sheetOpen && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={[
              "fixed bottom-6 left-1/2 z-[700] -translate-x-1/2",
              "flex h-12 items-center gap-2 rounded-full px-6",
              "bg-brand-gradient text-white text-sm font-bold",
              "shadow-[var(--shadow-accent)]",
              "transition-all duration-200 hover:shadow-[0_6px_24px_rgba(255,99,71,0.45)] active:scale-95",
            ].join(" ")}
          >
            <Fuel className="h-4 w-4" />
            See {stations.length} Stations
          </button>
        )}
      </div>
    </main>
  );
}
