// fuelify-frontend/app/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Fuel, Locate, Search, Sun, Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FuelType, Station } from "@/types";
import { fetchNearbyStations } from "@/services/api";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { StationListCard } from "@/components/ui/StationListCard";
import { FuelChips } from "@/components/ui/FuelChips";
import { useTheme } from "@/components/theme/ThemeContext";

const MapView = dynamic(
  () => import("@/components/map/MapView").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => <div className="h-full w-full skeleton-shimmer" />,
  },
);

const DEFAULT_CENTER: [number, number] = [40.4173, -82.9071];

const toMiles = (distanceKm?: number) => {
  if (distanceKm === undefined) return null;
  return distanceKm * 0.621371;
};

export default function HomePage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedFuel, setSelectedFuel] = useState<FuelType>("regular");
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [selectedStationId, setSelectedStationId] = useState<
    string | undefined
  >(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  /* ── Data fetching ──────────────────────────────────────── */
  const loadStations = useCallback(
    async (lat: number, lng: number) => {
      setLoading(true);
      try {
        const response = await fetchNearbyStations(
          lat,
          lng,
          25,
          selectedFuel,
          50,
        );
        setStations(response.stations);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [selectedFuel],
  );

  useEffect(() => {
    loadStations(center[0], center[1]);
  }, [center, loadStations]);

  /* ── Handlers ───────────────────────────────────────────── */
  const handleLocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setCenter([coords.latitude, coords.longitude]),
      () => {},
    );
  };

  const handleSearch = () => {
    if (searchQuery.trim().length < 2) return;
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}&state=OH`);
  };

  /* ── Computed ────────────────────────────────────────────── */
  const bestStation = useMemo(() => {
    return stations
      .filter(
        (s) =>
          s.prices?.[selectedFuel] !== null &&
          s.prices?.[selectedFuel] !== undefined,
      )
      .sort(
        (a, b) =>
          (a.prices?.[selectedFuel] ?? Number.MAX_SAFE_INTEGER) -
          (b.prices?.[selectedFuel] ?? Number.MAX_SAFE_INTEGER),
      )[0];
  }, [selectedFuel, stations]);

  const priceRanges = useMemo(() => {
    const fuels: FuelType[] = [
      "regular",
      "midgrade",
      "premium",
      "diesel",
      "e85",
    ];
    const ranges: Partial<
      Record<FuelType, { min: number | null; max: number | null }>
    > = {};
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

  /* ── Station list ───────────────────────────────────────── */
  const renderStationList = () => (
    <div className="space-y-2 p-3">
      {loading
        ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-2xl skeleton-shimmer" />
          ))
        : stations.map((station) => (
            <StationListCard
              key={station._id}
              station={station}
              distance={toMiles(station.distanceKm ?? undefined) ?? undefined}
              selectedFuel={selectedFuel}
              isActive={station._id === selectedStationId}
              onClick={() => {
                setSelectedStationId(station._id);
                const [lng, lat] = station.coordinates.coordinates;
                if (lat !== undefined && lng !== undefined)
                  setCenter([lat, lng]);
              }}
            />
          ))}
    </div>
  );

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[var(--bg-primary)]">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:absolute lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[380px] lg:flex-col lg:border-r lg:border-[var(--border)] lg:bg-[var(--bg-surface)]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gradient shadow-[var(--shadow-accent)]">
              <Fuel className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-base font-black leading-tight">Fuelify</p>
              <p className="text-xs text-[var(--text-muted)]">
                {stations.length} stations nearby
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{renderStationList()}</div>
      </aside>

      {/* ── Map ── */}
      <div className="absolute inset-0 lg:left-[380px]">
        <MapView
          stations={stations}
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
        />
      </div>

      {/* ── Floating HUD ── */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-[520] px-3 pt-safe sm:px-4 lg:left-[380px]">
        {/* ── Row 1: Search bar ── */}
        <header className="pointer-events-auto mt-3">
          <div className="flex h-14 items-center gap-2 rounded-2xl border border-[var(--border-strong)] p-2 glass shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
            {/* Brand pill */}
            <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-gradient px-3 shadow-[var(--shadow-accent)]">
              <Fuel className="h-4 w-4 text-white" />
              <span className="text-sm font-black text-white tracking-tight">
                Fuelify
              </span>
            </div>

            {/* Search input */}
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

            {/* Theme toggle — SINGLE toggle, no duplicates */}
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
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Locate button */}
            <button
              type="button"
              onClick={handleLocate}
              className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)]",
                "transition-all duration-200 hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]",
                "focus:outline-none active:scale-90",
              ].join(" ")}
              aria-label="Use my location"
            >
              <Locate className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ── Row 2: Fuel chips ── */}
        <section className="pointer-events-auto mt-2">
          <div className="rounded-2xl border border-[var(--border-strong)] p-1.5 glass shadow-[0_4px_20px_rgba(0,0,0,0.10)]">
            <FuelChips
              selected={selectedFuel}
              onSelect={setSelectedFuel}
              priceRanges={priceRanges}
            />
          </div>
        </section>

        {/* ── Best price banner ── */}
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
              Best{" "}
              <strong>${bestStation.prices[selectedFuel]!.toFixed(2)}</strong> ·{" "}
              {bestStation.name}
              {bestStation.distanceKm !== undefined && (
                <span className="ml-1 opacity-80">
                  {(bestStation.distanceKm * 0.621371).toFixed(1)} mi
                </span>
              )}
            </span>
          </button>
        )}
      </div>

      {/* ── Mobile BottomSheet ── */}
      <div className="lg:hidden">
        <BottomSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={`Stations near you (${stations.length})`}
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
